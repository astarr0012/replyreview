import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { useState } from "react";

const USER_ID = "00000000-0000-0000-0000-000000000000";

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
      FROM team_members tm
      LEFT JOIN locations l ON tm.location_id = l.id
      WHERE tm.user_id = ${USER_ID}
      ORDER BY tm.created_at DESC
    `;
    return {
      tier: user?.subscription_tier ?? "free",
      activeLocationId: user?.active_location_id ?? null,
      locations: (locations ?? []).map((l: any) => ({ ...l, created_at: String(l.created_at) })),
      teamMembers: (teamMembers ?? []).map((m: any) => ({ ...m, created_at: String(m.created_at) })),
    };
  } catch {
    return { tier: "free", activeLocationId: null, locations: [], teamMembers: [] };
  }
});

const addLocation = createServerFn({ method: "POST" })
  .validator((data: any) => ({
    name: String(data.name ?? "").trim(),
    address: String(data.address ?? "").trim(),
    phone: String(data.phone ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    if (!data.name) return { ok: false, message: "Location name is required." };
    try {
      const db = sql();
      await db`
        INSERT INTO locations (user_id, name, address, phone)
        VALUES (${USER_ID}, ${data.name}, ${data.address}, ${data.phone})
      `;
      return { ok: true, message: "Location added." };
    } catch {
      return { ok: false, message: "Failed to add location." };
    }
  });

const setActiveLocation = createServerFn({ method: "POST" })
  .validator((data: any) => ({ locationId: String(data.locationId ?? "") }))
  .handler(async ({ data }) => {
    try {
      const db = sql();
      await db`UPDATE users SET active_location_id = ${data.locationId} WHERE id = ${USER_ID}`;
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

const removeLocation = createServerFn({ method: "POST" })
  .validator((data: any) => ({ locationId: String(data.locationId ?? "") }))
  .handler(async ({ data }) => {
    try {
      const db = sql();
      await db`DELETE FROM locations WHERE id = ${data.locationId} AND user_id = ${USER_ID}`;
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

const inviteMember = createServerFn({ method: "POST" })
  .validator((data: any) => ({
    name: String(data.name ?? "").trim(),
    email: String(data.email ?? "").trim(),
    role: String(data.role ?? "reviewer"),
  }))
  .handler(async ({ data }) => {
    if (!data.name || !data.email) return { ok: false, message: "Name and email required." };
    try {
      const db = sql();
      await db`
        INSERT INTO team_members (user_id, name, email, role, status)
        VALUES (${USER_ID}, ${data.name}, ${data.email}, ${data.role}, 'pending')
      `;
      return { ok: true, message: "Invitation sent." };
    } catch {
      return { ok: false, message: "Failed to invite member." };
    }
  });

const removeMember = createServerFn({ method: "POST" })
  .validator((data: any) => ({ memberId: String(data.memberId ?? "") }))
  .handler(async ({ data }) => {
    try {
      const db = sql();
      await db`DELETE FROM team_members WHERE id = ${data.memberId} AND user_id = ${USER_ID}`;
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

export const Route = createFileRoute("/dashboard/locations")({
  component: LocationsPage,
  loader: () => getLocationsData(),
});

function LocationsPage() {
  const data = Route.useLoaderData();
  const isProOrAgency = data.tier === "pro" || data.tier === "agency";
  const activeLoc = data.locations.find((l: any) => l.id === data.activeLocationId);

  const [newLoc, setNewLoc] = useState({ name: "", address: "", phone: "" });
  const [newMember, setNewMember] = useState({ name: "", email: "", role: "reviewer" });
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [locMsg, setLocMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [memberMsg, setMemberMsg] = useState<{ ok: boolean; message: string } | null>(null);

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

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true); setLocMsg(null);
    const res = await addLocation({ data: newLoc });
    setLocMsg(res);
    if (res.ok) setNewLoc({ name: "", address: "", phone: "" });
    setAdding(false);
    // Reload
    window.location.reload();
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true); setMemberMsg(null);
    const res = await inviteMember({ data: newMember });
    setMemberMsg(res);
    if (res.ok) setNewMember({ name: "", email: "", role: "reviewer" });
    setInviting(false);
    window.location.reload();
  };

  const handleSetActive = async (id: string) => {
    await setActiveLocation({ data: { locationId: id } });
    window.location.reload();
  };

  const handleRemoveLoc = async (id: string) => {
    if (!confirm("Remove this location?")) return;
    await removeLocation({ data: { locationId: id } });
    window.location.reload();
  };

  const handleRemoveMember = async (id: string) => {
    if (!confirm("Remove this team member?")) return;
    await removeMember({ data: { memberId: id } });
    window.location.reload();
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Locations & Team</h1>
          <p className="mt-2 text-slate-600">Manage your business locations and invite team members.</p>
        </div>
        {activeLoc && (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Active: {activeLoc.name}
          </span>
        )}
      </div>

      {/* Locations */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">Locations ({data.locations.length})</h2>
        <p className="mt-1 text-sm text-slate-500">Register your business locations.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.locations.map((loc: any) => (
            <div key={loc.id} className={`rounded-xl border p-5 shadow-sm ${
              loc.id === data.activeLocationId ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200 bg-white"
            }`}>
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
              <div className="mt-3 flex gap-2">
                {loc.id !== data.activeLocationId && (
                  <button onClick={() => handleSetActive(loc.id)} className="text-xs font-medium text-emerald-600 hover:text-emerald-500">Set active</button>
                )}
                <button onClick={() => handleRemoveLoc(loc.id)} className="text-xs font-medium text-red-500 hover:text-red-400">Remove</button>
              </div>
            </div>
          ))}

          {/* Add location card */}
          <form onSubmit={handleAddLocation} className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">Add Location</h3>
            <div className="mt-3 space-y-2">
              <input type="text" placeholder="Location name" value={newLoc.name} onChange={(e) => setNewLoc(p => ({ ...p, name: e.target.value }))}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" required />
              <input type="text" placeholder="Address" value={newLoc.address} onChange={(e) => setNewLoc(p => ({ ...p, address: e.target.value }))}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
              <input type="text" placeholder="Phone" value={newLoc.phone} onChange={(e) => setNewLoc(p => ({ ...p, phone: e.target.value }))}
                className="block w-full rounded-lg border border-slate-200 px-3 py-2 text-xs shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
            </div>
            <button type="submit" disabled={adding || !newLoc.name}
              className="mt-3 w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">Add Location</button>
            {locMsg && <p className={`mt-1 text-xs ${locMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{locMsg.message}</p>}
          </form>
        </div>
      </div>

      {/* Team Members */}
      <div className="mt-14">
        <h2 className="text-xl font-semibold text-slate-900">Team Members ({data.teamMembers.length})</h2>
        <p className="mt-1 text-sm text-slate-500">Invite team members with specific roles.</p>

        <div className="mt-4 space-y-3">
          {data.teamMembers.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{m.name}</p>
                  <p className="text-xs text-slate-500">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600">{m.role}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  m.status === "active" ? "bg-emerald-100 text-emerald-700" :
                  m.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                }`}>{m.status}</span>
                {m.location_name && <span className="text-xs text-slate-400">{m.location_name}</span>}
                <button onClick={() => handleRemoveMember(m.id)} className="text-xs font-medium text-red-500 hover:text-red-400">Remove</button>
              </div>
            </div>
          ))}
        </div>

        {/* Invite form */}
        <form onSubmit={handleInvite} className="mt-4 rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 shadow-sm">
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
            <button type="submit" disabled={inviting || !newMember.name || !newMember.email}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">Send Invite</button>
          </div>
          {memberMsg && <p className={`mt-1 text-xs ${memberMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{memberMsg.message}</p>}
        </form>
      </div>
    </div>
  );
}