import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { useState } from "react";

const USER_ID = "00000000-0000-0000-0000-000000000000";

/* ---------- Server Functions ---------- */

const getLocationsData = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const [user] = await db`
      SELECT subscription_tier, active_location_id FROM users WHERE id = ${USER_ID}
    `;
    const locations = await db`
      SELECT * FROM locations WHERE user_id = ${USER_ID} ORDER BY created_at ASC
    `;
    const teamMembers = await db`
      SELECT tm.*, l.name as location_name
      FROM team_members tm LEFT JOIN locations l ON tm.location_id = l.id
      WHERE tm.user_id = ${USER_ID} ORDER BY tm.created_at DESC
    `;
    // Get platform connections for all locations
    const locationIds = (locations ?? []).map((l: any) => l.id);
    let connections: any[] = [];
    if (locationIds.length > 0) {
      connections = await db`
        SELECT * FROM platform_connections WHERE location_id = ANY(${locationIds}::uuid[])
      `;
    }
    return {
      tier: user?.subscription_tier ?? "free",
      activeLocationId: user?.active_location_id ?? null,
      locations: (locations ?? []).map((l: any) => ({ ...l, created_at: String(l.created_at) })),
      teamMembers: (teamMembers ?? []).map((m: any) => ({ ...m, created_at: String(m.created_at) })),
      connections: (connections ?? []).map((c: any) => ({ ...c, connected_at: c.connected_at ? String(c.connected_at) : null, last_synced_at: c.last_synced_at ? String(c.last_synced_at) : null })),
    };
  } catch {
    return { tier: "free", activeLocationId: null, locations: [], teamMembers: [], connections: [] };
  }
});

const addLocation = createServerFn({ method: "POST" })
  .validator((d: any) => ({ name: String(d.name ?? "").trim(), address: String(d.address ?? "").trim(), phone: String(d.phone ?? "").trim() }))
  .handler(async ({ data }) => {
    if (!data.name) return { ok: false, message: "Location name is required." };
    try {
      const db = sql();
      await db`INSERT INTO locations (user_id, name, address, phone) VALUES (${USER_ID}, ${data.name}, ${data.address}, ${data.phone})`;
      return { ok: true, message: "Location added." };
    } catch { return { ok: false, message: "Failed to add location." }; }
  });

const setActiveLocation = createServerFn({ method: "POST" })
  .validator((d: any) => ({ locationId: String(d.locationId ?? "") }))
  .handler(async ({ data }) => {
    try { const db = sql(); await db`UPDATE users SET active_location_id = ${data.locationId} WHERE id = ${USER_ID}`; return { ok: true }; }
    catch { return { ok: false }; }
  });

const removeLocation = createServerFn({ method: "POST" })
  .validator((d: any) => ({ locationId: String(d.locationId ?? "") }))
  .handler(async ({ data }) => {
    try { const db = sql(); await db`DELETE FROM locations WHERE id = ${data.locationId} AND user_id = ${USER_ID}`; return { ok: true }; }
    catch { return { ok: false }; }
  });

const inviteMember = createServerFn({ method: "POST" })
  .validator((d: any) => ({ name: String(d.name ?? "").trim(), email: String(d.email ?? "").trim(), role: String(d.role ?? "reviewer") }))
  .handler(async ({ data }) => {
    if (!data.name || !data.email) return { ok: false, message: "Name and email required." };
    try { const db = sql(); await db`INSERT INTO team_members (user_id, name, email, role, status) VALUES (${USER_ID}, ${data.name}, ${data.email}, ${data.role}, 'pending')`; return { ok: true, message: "Invitation sent." }; }
    catch { return { ok: false, message: "Failed to invite member." }; }
  });

const removeMember = createServerFn({ method: "POST" })
  .validator((d: any) => ({ memberId: String(d.memberId ?? "") }))
  .handler(async ({ data }) => {
    try { const db = sql(); await db`DELETE FROM team_members WHERE id = ${data.memberId} AND user_id = ${USER_ID}`; return { ok: true }; }
    catch { return { ok: false }; }
  });

/* ---------- Platform Connection Functions ---------- */

const connectPlatform = createServerFn({ method: "POST" })
  .validator((d: any) => ({ locationId: String(d.locationId ?? ""), platform: String(d.platform ?? "google") }))
  .handler(async ({ data }) => {
    try {
      const db = sql();
      const [existing] = await db`
        SELECT id FROM platform_connections WHERE location_id = ${data.locationId} AND platform = ${data.platform}
      `;
      if (existing) {
        await db`UPDATE platform_connections SET connected = true, connected_at = NOW() WHERE id = ${existing.id}`;
      } else {
        await db`
          INSERT INTO platform_connections (location_id, platform, connected, connected_at)
          VALUES (${data.locationId}, ${data.platform}, true, NOW())
        `;
        // Seed sample reviews for the connected platform in dev mode
        await seedSampleReviews(data.locationId, data.platform);
      }
      return { ok: true, message: `Connected to ${data.platform === "google" ? "Google Business Profile" : "Yelp"}!` };
    } catch { return { ok: false, message: "Failed to connect." }; }
  });

const disconnectPlatform = createServerFn({ method: "POST" })
  .validator((d: any) => ({ locationId: String(d.locationId ?? ""), platform: String(d.platform ?? "google") }))
  .handler(async ({ data }) => {
    try {
      const db = sql();
      await db`UPDATE platform_connections SET connected = false, access_token = '', refresh_token = '' WHERE location_id = ${data.locationId} AND platform = ${data.platform}`;
      return { ok: true, message: `Disconnected from ${data.platform === "google" ? "Google" : "Yelp"}.` };
    } catch { return { ok: false, message: "Failed to disconnect." }; }
  });

const syncPlatform = createServerFn({ method: "POST" })
  .validator((d: any) => ({ locationId: String(d.locationId ?? ""), platform: String(d.platform ?? "google") }))
  .handler(async ({ data }) => {
    try {
      const db = sql();
      // Update last synced timestamp
      await db`UPDATE platform_connections SET last_synced_at = NOW() WHERE location_id = ${data.locationId} AND platform = ${data.platform}`;
      // In dev mode, seed sample reviews on sync
      await seedSampleReviews(data.locationId, data.platform);
      return { ok: true, message: `Synced with ${data.platform === "google" ? "Google" : "Yelp"}!` };
    } catch { return { ok: false, message: "Sync failed." }; }
  });

async function seedSampleReviews(locationId: string, platform: string) {
  const db = sql();
  const sampleReviews = platform === "google" ? [
    { author: "Maria Santos", rating: 5, text: "Amazing service! The team went above and beyond to help me. Will definitely be coming back!", date: "2026-07-15" },
    { author: "James Wilson", rating: 4, text: "Great experience overall. The staff was friendly and professional. Minor wait time but worth it.", date: "2026-07-12" },
    { author: "Sarah Chen", rating: 5, text: "Best place in town! I've been coming here for years and they never disappoint.", date: "2026-07-10" },
    { author: "Mike Thompson", rating: 3, text: "Decent experience. The product was good but the service could be faster. Would try again.", date: "2026-07-08" },
    { author: "Emily Davis", rating: 2, text: "Had some issues with my order. The staff was apologetic but it took longer than expected to resolve.", date: "2026-07-05" },
    { author: "David Kim", rating: 5, text: "Absolutely love this place! The attention to detail and customer care is unmatched.", date: "2026-07-03" },
    { author: "Lisa Anderson", rating: 4, text: "Very satisfied with my visit. Clean environment and knowledgeable staff.", date: "2026-06-30" },
    { author: "Robert Martinez", rating: 1, text: "Very disappointed. The service was slow and the staff seemed disinterested. Not coming back.", date: "2026-06-28" },
    { author: "Jennifer Brown", rating: 5, text: "Exceeded my expectations! The team really cares about their customers.", date: "2026-06-25" },
    { author: "Chris Taylor", rating: 4, text: "Good value for money. Would recommend to friends and family.", date: "2026-06-22" },
  ] : [
    { author: "Alex Rivera", rating: 5, text: "Hands down the best service in town! Five stars all the way!", date: "2026-07-14" },
    { author: "Jordan Lee", rating: 4, text: "Really impressed with the quality. A few small improvements would make it perfect.", date: "2026-07-11" },
    { author: "Taylor Brooks", rating: 5, text: "I've been to many places but this one stands out. Exceptional quality and service.", date: "2026-07-09" },
    { author: "Morgan Reed", rating: 3, text: "It was okay. Nothing special but nothing bad either. Average experience.", date: "2026-07-07" },
    { author: "Casey Morgan", rating: 2, text: "Not what I expected. The website showed different prices than what I was charged.", date: "2026-07-04" },
    { author: "Riley Cooper", rating: 5, text: "Incredible experience from start to finish! Highly recommend to everyone.", date: "2026-07-02" },
    { author: "Avery Quinn", rating: 4, text: "Great atmosphere and friendly staff. Will definitely return.", date: "2026-06-29" },
    { author: "Drew Harper", rating: 1, text: "Terrible experience. Would give zero stars if possible. Avoid this place.", date: "2026-06-27" },
    { author: "Parker Stone", rating: 5, text: "Perfect every single time. This is what excellent service looks like.", date: "2026-06-24" },
    { author: "Sydney Blake", rating: 4, text: "Really good! The team was accommodating and professional.", date: "2026-06-21" },
  ];

  // Check if reviews already exist for this location/platform combo
  const [existing] = await db`
    SELECT COUNT(*)::int as count FROM reviews WHERE location_id = ${locationId} AND platform = ${platform}
  `;

  if ((existing?.count ?? 0) === 0) {
    for (const review of sampleReviews) {
      await db`
        INSERT INTO reviews (user_id, location_id, platform, author_name, rating, review_text, created_at)
        VALUES (${USER_ID}, ${locationId}, ${platform}, ${review.author}, ${review.rating}, ${review.text}, ${review.date}::timestamptz)
      `;
    }
    console.log(`[seed] Seeded ${sampleReviews.length} ${platform} reviews for location ${locationId}`);
  }
}

/* ---------- Route ---------- */

export const Route = createFileRoute("/dashboard/locations")({
  component: LocationsPage,
  loader: () => getLocationsData(),
});

/* ---------- Component ---------- */

function LocationsPage() {
  const data = Route.useLoaderData();
  const isProOrAgency = data.tier === "pro" || data.tier === "agency";
  const activeLoc = data.locations.find((l: any) => l.id === data.activeLocationId);

  const [newLoc, setNewLoc] = useState({ name: "", address: "", phone: "" });
  const [newMember, setNewMember] = useState({ name: "", email: "", role: "reviewer" });
  const [connecting, setConnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connMsg, setConnMsg] = useState<{ ok: boolean; message: string } | null>(null);

  if (!isProOrAgency) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Locations & Team</h1>
        <p className="mt-2 text-slate-600">Manage your business locations and team members.</p>
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto h-12 w-12 text-slate-300">
            <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Upgrade to Pro or Agency</h3>
          <p className="mt-2 text-sm text-slate-500">Multi-location and multi-user management is available on Pro and Agency plans.</p>
          <a href="/dashboard/settings" className="mt-6 inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Upgrade Now</a>
        </div>
      </div>
    );
  }

  const getConnection = (locId: string, platform: string) =>
    data.connections.find((c: any) => c.location_id === locId && c.platform === platform);

  const handleConnect = async (locId: string, platform: string) => {
    setConnecting(`${locId}-${platform}`);
    setConnMsg(null);
    const res = await connectPlatform({ data: { locationId: locId, platform } });
    setConnMsg(res);
    setConnecting(null);
    setTimeout(() => window.location.reload(), 800);
  };

  const handleDisconnect = async (locId: string, platform: string) => {
    if (!confirm(`Disconnect from ${platform === "google" ? "Google" : "Yelp"}?`)) return;
    setConnecting(`${locId}-${platform}`);
    setConnMsg(null);
    const res = await disconnectPlatform({ data: { locationId: locId, platform } });
    setConnMsg(res);
    setConnecting(null);
    setTimeout(() => window.location.reload(), 800);
  };

  const handleSync = async (locId: string, platform: string) => {
    setSyncing(`${locId}-${platform}`);
    setConnMsg(null);
    const res = await syncPlatform({ data: { locationId: locId, platform } });
    setConnMsg(res);
    setSyncing(null);
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Locations & Team</h1>
          <p className="mt-2 text-slate-600">Manage your business locations, connect platforms, and invite team members.</p>
        </div>
        {activeLoc && (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Active: {activeLoc.name}
          </span>
        )}
      </div>

      {connMsg && (
        <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${connMsg.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {connMsg.message}
        </div>
      )}

      {/* Locations */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">Locations ({data.locations.length})</h2>
        <p className="mt-1 text-sm text-slate-500">Register your business locations and connect them to Google & Yelp.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.locations.map((loc: any) => {
            const googleConn = getConnection(loc.id, "google");
            const yelpConn = getConnection(loc.id, "yelp");
            return (
              <div key={loc.id} className={`rounded-xl border p-5 shadow-sm ${
                loc.id === data.activeLocationId ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-white"
              }`}>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-slate-400">
                      <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-slate-900">{loc.name}</h3>
                  </div>
                  {loc.id === data.activeLocationId && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span>
                  )}
                </div>
                {loc.address && <p className="mt-2 text-xs text-slate-500">{loc.address}</p>}
                {loc.phone && <p className="text-xs text-slate-500">{loc.phone}</p>}

                {/* Platform Connections */}
                <div className="mt-4 space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Connected Platforms</p>
                  {/* Google */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-[#4285F4] text-[9px] font-bold text-white">G</span>
                      <span className="text-xs font-medium text-slate-700">Google</span>
                      {googleConn?.connected ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">Connected</span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-semibold text-slate-500">Not connected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {googleConn?.connected ? (
                        <>
                          <button onClick={() => handleSync(loc.id, "google")} disabled={syncing === `${loc.id}-google`}
                            className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60">
                            {syncing === `${loc.id}-google` ? "..." : "Sync"}
                          </button>
                          <button onClick={() => handleDisconnect(loc.id, "google")}
                            className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-50">Disconnect</button>
                        </>
                      ) : (
                        <button onClick={() => handleConnect(loc.id, "google")} disabled={connecting === `${loc.id}-google`}
                          className="rounded-full bg-[#4285F4] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#3367D6] disabled:opacity-60">
                          {connecting === `${loc.id}-google` ? "..." : "Connect"}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Yelp */}
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-[#d32323] text-[9px] font-bold text-white">Y</span>
                      <span className="text-xs font-medium text-slate-700">Yelp</span>
                      {yelpConn?.connected ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-semibold text-emerald-700">Connected</span>
                      ) : (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-semibold text-slate-500">Not connected</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {yelpConn?.connected ? (
                        <>
                          <button onClick={() => handleSync(loc.id, "yelp")} disabled={syncing === `${loc.id}-yelp`}
                            className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-60">
                            {syncing === `${loc.id}-yelp` ? "..." : "Sync"}
                          </button>
                          <button onClick={() => handleDisconnect(loc.id, "yelp")}
                            className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-50">Disconnect</button>
                        </>
                      ) : (
                        <button onClick={() => handleConnect(loc.id, "yelp")} disabled={connecting === `${loc.id}-yelp`}
                          className="rounded-full bg-[#d32323] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#b01e1e] disabled:opacity-60">
                          {connecting === `${loc.id}-yelp` ? "..." : "Connect"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Location actions */}
                <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                  {loc.id !== data.activeLocationId && (
                    <button onClick={() => { setActiveLocation({ data: { locationId: loc.id } }); window.location.reload(); }}
                      className="text-xs font-medium text-emerald-600 hover:text-emerald-500">Set active</button>
                  )}
                  <button onClick={() => { removeLocation({ data: { locationId: loc.id } }); window.location.reload(); }}
                    className="text-xs font-medium text-red-500 hover:text-red-400">Remove</button>
                </div>
              </div>
            );
          })}

          {/* Add location card */}
          <form onSubmit={async (e) => { e.preventDefault(); setConnMsg(null); const res = await addLocation({ data: newLoc }); if (res.ok) setNewLoc({ name: "", address: "", phone: "" }); window.location.reload(); }}
            className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Add Location</h3>
            <div className="mt-3 space-y-2">
              <input type="text" placeholder="Location name" value={newLoc.name} onChange={(e) => setNewLoc(p => ({ ...p, name: e.target.value }))}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" required />
              <input type="text" placeholder="Address" value={newLoc.address} onChange={(e) => setNewLoc(p => ({ ...p, address: e.target.value }))}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
              <input type="text" placeholder="Phone" value={newLoc.phone} onChange={(e) => setNewLoc(p => ({ ...p, phone: e.target.value }))}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
            </div>
            <button type="submit" disabled={!newLoc.name}
              className="mt-3 w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">Add Location</button>
          </form>
        </div>
      </div>

      {/* Dev Mode Info */}
      <div className="mt-8 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-5">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-amber-600">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-sm font-medium text-amber-800">Dev Mode — Platform Sync Simulator</p>
        </div>
        <p className="mt-1.5 text-xs text-amber-700">
          Click "Connect" on any location to simulate connecting to Google or Yelp. This will automatically seed 10 sample reviews per platform for testing.
          Use the "Sync" button to re-sync and pull fresh sample data. In production, set <code className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-mono">GOOGLE_OAUTH_CLIENT_ID</code> and <code className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-mono">YELP_API_KEY</code> env vars for real API integration.
        </p>
      </div>

      {/* Team Members */}
      <div className="mt-14">
        <h2 className="text-xl font-semibold text-slate-900">Team Members ({data.teamMembers.length})</h2>
        <p className="mt-1 text-sm text-slate-500">Invite team members with specific roles.</p>
        <div className="mt-4 space-y-3">
          {data.teamMembers.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">{m.name.charAt(0).toUpperCase()}</div>
                <div><p className="text-sm font-semibold text-slate-900">{m.name}</p><p className="text-xs text-slate-500">{m.email}</p></div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600">{m.role}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${m.status === "active" ? "bg-emerald-100 text-emerald-700" : m.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{m.status}</span>
                {m.location_name && <span className="text-xs text-slate-400">{m.location_name}</span>}
                <button onClick={() => { removeMember({ data: { memberId: m.id } }); window.location.reload(); }} className="text-xs font-medium text-red-500 hover:text-red-400">Remove</button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={async (e) => { e.preventDefault(); const res = await inviteMember({ data: newMember }); if (res.ok) setNewMember({ name: "", email: "", role: "reviewer" }); window.location.reload(); }}
          className="mt-4 rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700">Invite Team Member</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <input type="text" placeholder="Name" value={newMember.name} onChange={(e) => setNewMember(p => ({ ...p, name: e.target.value }))}
              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" required />
            <input type="email" placeholder="Email" value={newMember.email} onChange={(e) => setNewMember(p => ({ ...p, email: e.target.value }))}
              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" required />
            <select value={newMember.role} onChange={(e) => setNewMember(p => ({ ...p, role: e.target.value }))}
              className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
              <option value="reviewer">Reviewer</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
            <button type="submit" disabled={!newMember.name || !newMember.email}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">Send Invite</button>
          </div>
        </form>
      </div>
    </div>
  );
}