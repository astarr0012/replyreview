import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

const USER_ID = "00000000-0000-0000-0000-000000000000";

/* Stripe Payment Links — provided by the owner */
const STRIPE_PAYMENT_LINKS: Record<string, string> = {
  starter: "https://buy.stripe.com/00w5kDaOlcWtgzn3vJ7kc03",
  pro: "https://buy.stripe.com/5kQ00j2hP6y55UJgiv7kc04",
  agency: "https://buy.stripe.com/bJe3cv4pXe0xfvj2rF7kc05",
};

/* Tier limits for quota enforcement */
const TIER_LIMITS: Record<string, { label: string; responses: number; locations: number }> = {
  free: { label: "Free", responses: 0, locations: 0 },
  starter: { label: "Starter", responses: 30, locations: 0 },
  pro: { label: "Pro", responses: 100, locations: 3 },
  agency: { label: "Agency", responses: 500, locations: 999 },
};

/* Get the payment link for a given tier */
export const getPaymentLink = createServerFn({ method: "POST" })
  .validator((data: any) => ({ tier: String(data.tier ?? "starter") }))
  .handler(async ({ data }) => {
    const link = STRIPE_PAYMENT_LINKS[data.tier];
    if (!link) return { ok: false, message: `No payment link for tier: ${data.tier}` };
    return { ok: true, url: link };
  });

/* Get subscription quota with usage */
export const getSubscriptionQuota = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const [user] = await db`
      SELECT subscription_tier, subscription_status FROM users WHERE id = ${USER_ID}
    `;
    const tier = user?.subscription_tier ?? "free";
    const status = user?.subscription_status ?? "active";
    const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;

    // Count current month's responses
    const [usage] = await db`
      SELECT COUNT(*)::int as count FROM responses
      WHERE user_id = ${USER_ID}
        AND created_at >= DATE_TRUNC('month', NOW())
    `;

    // Count locations
    const [locCount] = await db`
      SELECT COUNT(*)::int as count FROM locations WHERE user_id = ${USER_ID}
    `;

    return {
      tier,
      status,
      label: limit.label,
      limit: limit.responses,
      used: usage?.count ?? 0,
      remaining: Math.max(0, limit.responses - (usage?.count ?? 0)),
      locationLimit: limit.locations,
      locationCount: locCount?.count ?? 0,
      isLimitReached: limit.responses > 0 && (usage?.count ?? 0) >= limit.responses,
      isUnlimited: limit.responses === 0 && tier === "free" ? false : limit.responses === 0,
    };
  } catch {
    return { tier: "free", status: "active", label: "Free", limit: 0, used: 0, remaining: 0, locationLimit: 0, locationCount: 0, isLimitReached: false, isUnlimited: false };
  }
});

/* Check if user can generate a response */
export const canGenerateResponse = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const [user] = await db`
      SELECT subscription_tier, subscription_status FROM users WHERE id = ${USER_ID}
    `;
    const tier = user?.subscription_tier ?? "free";
    const status = user?.subscription_status ?? "active";

    if (status === "canceled" || status === "past_due") {
      return { allowed: false, reason: "Your subscription is " + status + ". Renew to continue generating responses." };
    }

    const limit = TIER_LIMITS[tier] || TIER_LIMITS.free;
    if (limit.responses === 0) {
      return { allowed: false, reason: tier === "free" ? "Free plan does not include response generation. Upgrade to start." : "No response limit configured." };
    }

    const [usage] = await db`
      SELECT COUNT(*)::int as count FROM responses
      WHERE user_id = ${USER_ID}
        AND created_at >= DATE_TRUNC('month', NOW())
    `;

    if ((usage?.count ?? 0) >= limit.responses) {
      return { allowed: false, reason: `You've reached your monthly limit of ${limit.responses} responses. Upgrade to continue generating.` };
    }

    return { allowed: true, remaining: limit.responses - (usage?.count ?? 0) };
  } catch {
    return { allowed: false, reason: "Could not verify subscription." };
  }
});

/* Dev Sandbox: instantly switch subscription tier for testing */
export const updateSubscriptionTier = createServerFn({ method: "POST" })
  .validator((data: any) => ({
    tier: String(data.tier ?? "free"),
    status: String(data.status ?? "active"),
  }))
  .handler(async ({ data }) => {
    try {
      const db = sql();
      const validTiers = ["free", "starter", "pro", "agency"];
      const validStatuses = ["active", "canceled", "past_due", "inactive"];

      if (!validTiers.includes(data.tier)) return { ok: false, message: "Invalid tier." };
      if (!validStatuses.includes(data.status)) return { ok: false, message: "Invalid status." };

      await db`
        UPDATE users SET subscription_tier = ${data.tier}, subscription_status = ${data.status}
        WHERE id = ${USER_ID}
      `;
      return { ok: true, message: `Subscription updated to ${data.tier} (${data.status})` };
    } catch (err: any) {
      return { ok: false, message: err.message || "Failed to update." };
    }
  });