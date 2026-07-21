import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { useState } from "react";
import { createStripeCheckout, createBillingPortal, getSubscriptionQuota } from "~/routes/api/-stripe-checkout";

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
    return { profile, quota };
  },
});

const TIERS = [
  { key: "free", label: "Free", price: "$0", desc: "Explore the dashboard", responses: "—" },
  { key: "starter", label: "Starter", price: "$19", desc: "For growing businesses", responses: "30/mo" },
  { key: "pro", label: "Pro", price: "$39", desc: "For active businesses", responses: "100/mo" },
  { key: "agency", label: "Agency", price: "$99", desc: "For agencies & teams", responses: "500/mo" },
];

function SettingsPage() {
  const { profile: initial, quota } = Route.useLoaderData();
  const [profile, setProfile] = useState({
    name: initial?.name ?? "",
    business_name: initial?.business_name ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [stripeMsg, setStripeMsg] = useState<string | null>(null);
  const hasStripe = !!process.env.STRIPE_SECRET_KEY;

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

  const isCanceled = initial.subscription_status === "canceled";
  const isPaid = initial.subscription_tier !== "free";

  const handleUpgrade = async (tier: string) => {
    setCheckoutLoading(tier);
    setStripeMsg(null);
    const res = await createStripeCheckout({ data: { tier, successUrl: `${window.location.origin}/dashboard/settings?checkout=success`, cancelUrl: `${window.location.origin}/dashboard/settings?checkout=canceled` } });
    if (res.ok && res.url) {
      window.location.href = res.url;
    } else {
      setStripeMsg(res.message || "Something went wrong.");
    }
    setCheckoutLoading(null);
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    setStripeMsg(null);
    const res = await createBillingPortal({ data: { returnUrl: window.location.origin + "/dashboard/settings" } });
    if (res.ok && res.url) {
      window.location.href = res.url;
    } else {
      setStripeMsg(res.message || "Billing portal not available.");
    }
    setPortalLoading(false);
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
              {quota.remaining > 0 && quota.remaining < 10 && (
                <p className="mt-1 text-xs text-amber-600">Only {quota.remaining} responses remaining this month!</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Member Since</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {new Date(initial.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>

          {/* Billing actions */}
          <div className="mt-6 border-t border-slate-100 pt-6">
            {!hasStripe ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-800">Stripe not yet configured</p>
                <p className="mt-1 text-xs text-amber-700">Set STRIPE_SECRET_KEY environment variable to enable real billing. For now, subscription changes update directly in the database.</p>
              </div>
            ) : isCanceled ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Subscription Canceled</p>
                <p className="mt-1 text-sm text-slate-500">You'll retain access through the end of your current billing period.</p>
              </div>
            ) : isPaid ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Manage Subscription</p>
                  <p className="text-xs text-slate-500">View invoices, change plans, or update payment method.</p>
                </div>
                <button onClick={handlePortal} disabled={portalLoading}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                  {portalLoading ? "Loading..." : "Manage in Stripe"}
                </button>
              </div>
            ) : null}
            {stripeMsg && <p className={`mt-3 text-sm ${stripeMsg.includes("not available") || stripeMsg.includes("wrong") ? "text-red-600" : "text-slate-600"}`}>{stripeMsg}</p>}
          </div>
        </div>

        {/* Plan comparison / upgrade cards */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((t) => {
            const isCurrentTier = t.key === initial.subscription_tier;
            const isDowngrade = t.key === "free" || (t.key === "starter" && initial.subscription_tier === "free");
            const canUpgrade = !isCurrentTier && !isDowngrade;
            return (
              <div key={t.key} className={`rounded-2xl border p-5 shadow-sm ${
                isCurrentTier ? "border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200" : "border-slate-200 bg-white"
              }`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.label}</p>
                <p className="mt-1 text-3xl font-bold text-slate-900">{t.price}<span className="text-base font-medium text-slate-400">/mo</span></p>
                <p className="mt-2 text-xs text-slate-500">{t.desc}</p>
                <p className="mt-1 text-xs text-slate-400">{t.responses} responses</p>
                <div className="mt-4">
                  {isCurrentTier ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700">Current Plan</span>
                  ) : canUpgrade ? (
                    <button onClick={() => handleUpgrade(t.key)} disabled={checkoutLoading === t.key}
                      className="inline-flex items-center rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                      {checkoutLoading === t.key ? "Loading..." : `Upgrade to ${t.label}`}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}