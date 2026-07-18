import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { useState } from "react";

const USER_ID = "00000000-0000-0000-0000-000000000000";

const getProfile = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const [user] = await db`
      SELECT id, email, name, business_name, subscription_tier, subscription_status, created_at
      FROM users WHERE id = ${USER_ID}
    `;
    if (!user) return null;
    return {
      ...user,
      created_at: String(user.created_at),
    };
  } catch {
    return null;
  }
});

const updateProfile = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    return {
      name: String(d.name ?? "").trim(),
      business_name: String(d.business_name ?? "").trim(),
    };
  })
  .handler(async ({ data }) => {
    try {
      const db = sql();
      await db`
        UPDATE users SET name = ${data.name}, business_name = ${data.business_name}
        WHERE id = ${USER_ID}
      `;
      return { ok: true, message: "Profile updated successfully." };
    } catch (err) {
      console.error("[updateProfile] error:", err);
      return { ok: false, message: "Failed to update profile." };
    }
  });

const cancelSubscription = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const db = sql();
    await db`
      UPDATE users SET subscription_status = 'canceled' WHERE id = ${USER_ID}
    `;
    return { ok: true, message: "Subscription canceled. You'll keep access through the end of your billing period." };
  } catch (err) {
    console.error("[cancelSubscription] error:", err);
    return { ok: false, message: "Failed to cancel subscription." };
  }
});

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
  loader: () => getProfile(),
});

function SettingsPage() {
  const initial = Route.useLoaderData();
  const [profile, setProfile] = useState({
    name: initial?.name ?? "",
    business_name: initial?.business_name ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState<{ ok: boolean; message: string } | null>(null);

  if (!initial) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex h-40 items-center justify-center">
          <p className="text-slate-400">Loading profile...</p>
        </div>
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg(null);
    const result = await updateProfile({ data: profile });
    setSaveMsg(result);
    setSaving(false);
  };

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You'll keep access through the end of your billing period.")) return;
    setCancelling(true);
    setCancelMsg(null);
    const result = await cancelSubscription();
    setCancelMsg(result);
    setCancelling(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Account Settings</h1>
      <p className="mt-2 text-slate-600">Manage your profile, business details, and subscription.</p>

      {/* Profile Section */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-500">Your personal and business information.</p>

        <form onSubmit={handleSave} className="mt-6 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">
                Your Name
              </label>
              <input
                id="name"
                type="text"
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={initial.email}
                disabled
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 shadow-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="business_name" className="block text-sm font-medium text-slate-700">
              Business Name
            </label>
            <input
              id="business_name"
              type="text"
              value={profile.business_name}
              onChange={(e) => setProfile((p) => ({ ...p, business_name: e.target.value }))}
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="My Local Business"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {saveMsg && (
              <span className={`text-sm ${saveMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                {saveMsg.message}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Subscription Section */}
      <div className="mt-14">
        <h2 className="text-xl font-semibold text-slate-900">Subscription & Billing</h2>
        <p className="mt-1 text-sm text-slate-500">Your current plan, status, and billing details.</p>

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
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Billing Cycle</p>
              <p className="mt-1 text-sm font-medium text-slate-900">Monthly</p>
              <p className="text-xs text-slate-500">Billed on the same day each month</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Member Since</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {new Date(initial.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            </div>
          </div>

          {/* Plan features summary */}
          <div className="mt-6 border-t border-slate-100 pt-6">
            <p className="text-sm font-medium text-slate-700">Plan Features</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {initial.subscription_tier === "free" && (
                <>
                  <li className="flex items-center gap-2">✦ Explore the dashboard</li>
                  <li className="flex items-center gap-2">✦ Upgrade to unlock responses</li>
                </>
              )}
              {initial.subscription_tier === "starter" && (
                <>
                  <li className="flex items-center gap-2">✦ 30 review responses / month</li>
                  <li className="flex items-center gap-2">✦ Manual review import</li>
                  <li className="flex items-center gap-2">✦ Tone presets</li>
                </>
              )}
              {initial.subscription_tier === "pro" && (
                <>
                  <li className="flex items-center gap-2">✦ 100 review responses / month</li>
                  <li className="flex items-center gap-2">✦ Auto-sync with Google & Yelp</li>
                  <li className="flex items-center gap-2">✦ Custom brand voice training</li>
                  <li className="flex items-center gap-2">✦ Multi-user access</li>
                </>
              )}
              {initial.subscription_tier === "agency" && (
                <>
                  <li className="flex items-center gap-2">✦ 500 review responses / month</li>
                  <li className="flex items-center gap-2">✦ Multi-location management</li>
                  <li className="flex items-center gap-2">✦ White-label option</li>
                  <li className="flex items-center gap-2">✦ Priority support</li>
                </>
              )}
            </ul>
          </div>

          {/* Cancel action */}
          <div className="mt-6 border-t border-slate-100 pt-6">
            {isCanceled ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">Subscription Canceled</p>
                <p className="mt-1 text-sm text-slate-500">
                  Your subscription has been canceled. You'll retain access through the end of your current billing period.
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Cancel Subscription</p>
                  <p className="text-xs text-slate-500">Cancel anytime. No hidden fees.</p>
                </div>
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                >
                  {cancelling ? "Canceling..." : "Cancel"}
                </button>
              </div>
            )}
            {cancelMsg && (
              <p className={`mt-3 text-sm ${cancelMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                {cancelMsg.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}