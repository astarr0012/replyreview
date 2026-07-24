import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { useState } from "react";
import { getPaymentLink, getSubscriptionQuota, updateSubscriptionTier } from "~/routes/api/-stripe-checkout";
import { getCampaignOverview, prepareTestEmail, prepareLaunchCampaign, simulateLaunchCampaign, markEmailsSent } from "~/routes/api/-email-campaign";

const USER_ID = "00000000-0000-0000-0000-000000000000";

const getProfile = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const [user] = await db`
      SELECT id, email, name, business_name, subscription_tier, subscription_status, created_at
      FROM users WHERE id = ${USER_ID}
    `;
    if (!user) return null;
    return { ...user, created_at: String(user.created_at) };
  } catch { return null; }
});

const updateProfile = createServerFn({ method: "POST" })
  .validator((data: any) => ({
    name: String(data.name ?? "").trim(),
    business_name: String(data.business_name ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    try {
      const db = sql();
      await db`UPDATE users SET name = ${data.name}, business_name = ${data.business_name} WHERE id = ${USER_ID}`;
      return { ok: true, message: "Profile updated successfully." };
    } catch { return { ok: false, message: "Failed to update profile." }; }
  });

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
  loader: async () => {
    const [profile, quota] = await Promise.all([getProfile(), getSubscriptionQuota()]);
    let campaignOverview = null;
    try { campaignOverview = await getCampaignOverview(); } catch { /* ignore */ }
    return { profile, quota, campaignOverview };
  },
});

const TIERS = [
  { key: "free", label: "Free", price: "$0", priceLabel: "Free", desc: "Explore the dashboard", responses: "—", features: [] },
  { key: "starter", label: "Starter", price: "$19", priceLabel: "$19/mo", desc: "For growing businesses", responses: "30/mo", features: ["30 responses / month", "Manual CSV import", "Tone presets"] },
  { key: "pro", label: "Pro", price: "$39", priceLabel: "$39/mo", desc: "For active businesses", responses: "100/mo", features: ["100 responses / month", "Analytics & drill-downs", "Up to 3 locations", "Multi-user access", "Brand voice training"] },
  { key: "agency", label: "Agency", price: "$99", priceLabel: "$99/mo", desc: "For agencies & teams", responses: "500/mo", features: ["500 responses / month", "Unlimited locations", "Priority support", "White-label option", "Advanced analytics"] },
];

function SettingsPage() {
  const { profile: initial, quota } = Route.useLoaderData();
  const [profile, setProfile] = useState({
    name: initial?.name ?? "",
    business_name: initial?.business_name ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [stripeMsg, setStripeMsg] = useState<string | null>(null);

  // Sandbox state
  const [sandboxTier, setSandboxTier] = useState(initial?.subscription_tier ?? "free");
  const [sandboxStatus, setSandboxStatus] = useState(initial?.subscription_status ?? "active");
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxMsg, setSandboxMsg] = useState<{ ok: boolean; message: string } | null>(null);

  // Campaign state
  const [campaignEmail, setCampaignEmail] = useState("");
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignMsg, setCampaignMsg] = useState<{ ok: boolean; message: string } | null>(null);

  if (!initial) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex h-40 items-center justify-center"><p className="text-slate-400">Loading profile...</p></div>
      </div>
    );
  }

  const tierLabel = initial.subscription_tier === "free" ? "Free"
    : initial.subscription_tier === "starter" ? "Starter"
    : initial.subscription_tier === "pro" ? "Pro"
    : initial.subscription_tier === "agency" ? "Agency" : "Free";

  const statusColor = initial.subscription_status === "active" ? "bg-emerald-100 text-emerald-700"
    : initial.subscription_status === "canceled" ? "bg-red-100 text-red-700"
    : initial.subscription_status === "past_due" ? "bg-amber-100 text-amber-700"
    : "bg-slate-100 text-slate-600";

  const isPaid = initial.subscription_tier !== "free";

  const handleUpgrade = async (tier: string) => {
    setStripeMsg(null);
    const res = await getPaymentLink({ data: { tier } });
    if (res.ok && res.url) {
      window.open(res.url, "_blank");
    } else {
      setStripeMsg(res.message || "Something went wrong.");
    }
  };

  const handleSandboxSave = async () => {
    setSandboxLoading(true);
    setSandboxMsg(null);
    const res = await updateSubscriptionTier({ data: { tier: sandboxTier, status: sandboxStatus } });
    setSandboxMsg(res);
    setSandboxLoading(false);
    if (res.ok) {
      // Reload after a moment to reflect changes
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    const result = await updateProfile({ data: profile });
    setSaveMsg(result);
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Account Settings</h1>
      <p className="mt-2 text-slate-600">Manage your profile, business details, and subscription.</p>

      {/* Profile Section */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-500">Your personal and business information.</p>
        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">Your Name</label>
              <input id="name" type="text" value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" placeholder="Jane Smith" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
              <input id="email" type="email" value={initial.email} disabled
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 shadow-sm" />
            </div>
          </div>
          <div>
            <label htmlFor="business_name" className="block text-sm font-medium text-slate-700">Business Name</label>
            <input id="business_name" type="text" value={profile.business_name}
              onChange={(e) => setProfile((p) => ({ ...p, business_name: e.target.value }))}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200" placeholder="My Local Business" />
          </div>
          <div className="flex items-center gap-4">
            <button type="submit" disabled={saving}
              className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {saveMsg && <span className={`text-sm ${saveMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{saveMsg.message}</span>}
          </div>
        </form>
      </div>

      {/* Subscription Section */}
      <div className="mt-14">
        <h2 className="text-xl font-semibold text-slate-900">Subscription & Billing</h2>
        <p className="mt-1 text-sm text-slate-500">Your current plan, usage, and billing details.</p>

        {/* Current plan card */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Current Plan</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{tierLabel}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Status</p>
              <p className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${statusColor}`}>
                {initial.subscription_status.charAt(0).toUpperCase() + initial.subscription_status.slice(1)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Monthly Usage</p>
              <div className="mt-1 flex items-center gap-3">
                <p className="text-sm font-medium text-slate-900">
                  {quota.used} / {quota.limit === 0 && quota.tier === "free" ? "—" : quota.limit}
                </p>
                {quota.limit > 0 && (
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (quota.used / quota.limit) * 100)}%` }} />
                  </div>
                )}
              </div>
              {quota.isLimitReached ? (
                <p className="mt-1 text-xs text-red-600">Limit reached! Upgrade to continue generating responses.</p>
              ) : quota.remaining > 0 && quota.remaining < 10 ? (
                <p className="mt-1 text-xs text-amber-600">Only {quota.remaining} responses remaining this month!</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Member Since</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {new Date(initial.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Pricing Plans Grid */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-slate-900">Choose Your Plan</h3>
          <p className="mt-1 text-sm text-slate-500">Select the plan that fits your business needs.</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t) => {
              const isCurrentTier = t.key === initial.subscription_tier;
              const isDowngrade = t.key === "free" || (t.key === "starter" && initial.subscription_tier === "free");
              return (
                <div key={t.key} className={`relative flex flex-col rounded-2xl border p-5 shadow-sm ${
                  isCurrentTier ? "border-emerald-300 bg-emerald-50/50 ring-2 ring-emerald-200" : "border-slate-200 bg-white"
                } ${t.key === "pro" ? "ring-1 ring-amber-200" : ""}`}>
                  {t.key === "pro" && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">Popular</span>
                  )}
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.label}</p>
                  <p className="mt-1 text-3xl font-bold text-slate-900">{t.price}<span className="text-base font-medium text-slate-400">/mo</span></p>
                  <p className="mt-2 text-xs text-slate-500">{t.desc}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">{t.responses} responses</p>
                  <ul className="mt-4 flex-1 space-y-1.5">
                    {t.features.map((f, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5">
                    {isCurrentTier ? (
                      <span className="flex items-center justify-center rounded-full bg-emerald-100 px-4 py-2 text-xs font-semibold text-emerald-700">Active Plan</span>
                    ) : t.key === "free" ? (
                      <span className="block text-center text-xs text-slate-400">—</span>
                    ) : (
                      <a
                        href={t.key === "starter" ? "https://buy.stripe.com/00w5kDaOlcWtgzn3vJ7kc03" : t.key === "pro" ? "https://buy.stripe.com/5kQ00j2hP6y55UJgiv7kc04" : "https://buy.stripe.com/bJe3cv4pXe0xfvj2rF7kc05"}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleUpgrade(t.key)}
                        className="flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        Subscribe — {t.priceLabel}
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Developer Sandbox Toggle */}
      <div className="mt-14 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-amber-700">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-amber-900">Developer Sandbox / Testing</h3>
            <p className="text-sm text-amber-700">Instantly switch your subscription tier and status to test different plan features without making a real purchase.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-amber-800">Subscription Tier</label>
            <select value={sandboxTier} onChange={(e) => setSandboxTier(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200">
              <option value="free">Free</option>
              <option value="starter">Starter ($19/mo)</option>
              <option value="pro">Pro ($39/mo)</option>
              <option value="agency">Agency ($99/mo)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-amber-800">Subscription Status</label>
            <select value={sandboxStatus} onChange={(e) => setSandboxStatus(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-200">
              <option value="active">Active</option>
              <option value="canceled">Canceled</option>
              <option value="past_due">Past Due</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={handleSandboxSave} disabled={sandboxLoading}
              className="w-full rounded-full bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500 disabled:opacity-60">
              {sandboxLoading ? "Applying..." : "Apply Sandbox Change"}
            </button>
          </div>
        </div>
        {sandboxMsg && (
          <p className={`mt-3 text-sm font-medium ${sandboxMsg.ok ? "text-emerald-700" : "text-red-700"}`}>
            {sandboxMsg.message}
          </p>
        )}
        {stripeMsg && <p className="mt-2 text-sm text-red-600">{stripeMsg}</p>}
      </div>

      {/* Email Campaign Section */}
      <div className="mt-14 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sky-100 p-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-sky-700">
              <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-sky-900">📢 Email Campaigns / Waitlist Launch</h3>
            <p className="text-sm text-sky-700">Manage waitlist announcements and send launch emails to your subscribers.</p>
          </div>
        </div>

        {/* Campaign overview stats */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-sky-200 bg-white p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-sky-600">Waitlist Subscribers</p>
            <p className="mt-1 text-3xl font-bold text-sky-900">{campaignOverview?.waitlistCount ?? 0}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-white p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-sky-600">Campaigns Sent</p>
            <p className="mt-1 text-3xl font-bold text-sky-900">{campaignOverview?.campaigns?.length ?? 0}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-white p-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wider text-sky-600">Total Emails Sent</p>
            <p className="mt-1 text-3xl font-bold text-sky-900">
              {campaignOverview?.campaigns?.reduce((sum: number, c: any) => sum + c.success_count, 0) ?? 0}
            </p>
          </div>
        </div>

        {/* Test email send */}
        <div className="mt-5">
          <p className="text-sm font-medium text-sky-800">🔬 Send Test Email</p>
          <p className="text-xs text-sky-600">Send a preview of the launch announcement to a single email address first.</p>
          <div className="mt-2 flex gap-3">
            <input type="email" placeholder="test@example.com" value={campaignEmail}
              onChange={(e) => setCampaignEmail(e.target.value)}
              className="block flex-1 rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200" />
            <button onClick={async () => {
              setCampaignLoading(true); setCampaignMsg(null);
              const res = await prepareTestEmail({ data: { email: campaignEmail } });
              setCampaignMsg(res);
              if (res.ok && "html" in res) {
                // The server prepared the email — ready for sending
              }
              setCampaignLoading(false);
            }} disabled={campaignLoading || !campaignEmail.includes("@")}
              className="rounded-full bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 disabled:opacity-60">
              {campaignLoading ? "Preparing..." : "Send Test 📧"}
            </button>
          </div>
        </div>

        {/* Launch campaign */}
        <div className="mt-5 border-t border-sky-200 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-sky-800">📢 Launch Announcement Campaign</p>
              <p className="text-xs text-sky-600">Send the full launch announcement to all waitlist subscribers.</p>
            </div>
            <button onClick={async () => {
              if (!confirm("Send launch announcement to ALL waitlist subscribers?")) return;
              setCampaignLoading(true); setCampaignMsg(null);
              const res = await prepareLaunchCampaign();
              setCampaignMsg(res);
              if (res.ok && "emails" in res && Array.isArray(res.emails)) {
                // Campaign prepared — ready to send via email tool
              }
              setCampaignLoading(false);
            }} disabled={campaignLoading || (campaignOverview?.waitlistCount ?? 0) === 0}
              className="rounded-full bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-60">
              {campaignLoading ? "Preparing..." : "📢 Send Launch Campaign"}
            </button>
          </div>
        </div>

        {/* Campaign history */}
        {campaignOverview?.campaigns && campaignOverview.campaigns.length > 0 && (
          <div className="mt-5 border-t border-sky-200 pt-5">
            <p className="text-sm font-medium text-sky-800">Campaign History</p>
            <div className="mt-2 space-y-2">
              {campaignOverview.campaigns.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-sky-100 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900 capitalize">{c.type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-500">{c.sent_to === "all" ? `Sent to ${c.recipient_count} subscribers` : `Sent to ${c.sent_to}`}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-emerald-600">{c.success_count} sent</span>
                    {c.fail_count > 0 && <span className="text-red-600">{c.fail_count} failed</span>}
                    <span className="text-slate-400">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {campaignMsg && (
          <p className={`mt-3 text-sm font-medium ${campaignMsg.ok ? "text-emerald-700" : "text-red-700"}`}>
            {campaignMsg.message}
          </p>
        )}
      </div>
    </div>
  );
}