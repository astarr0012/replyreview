import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

const USER_ID = "00000000-0000-0000-0000-000000000000";

/* Stripe price IDs — set these via environment or use test-mode defaults */
const STRIPE_PRICES: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || "",
  pro: process.env.STRIPE_PRICE_PRO || "",
  agency: process.env.STRIPE_PRICE_AGENCY || "",
};

const PRICE_TO_TIER: Record<string, string> = {};
// Reverse map built from STRIPE_PRICES on first call

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Lazy-init reverse map
  if (Object.keys(PRICE_TO_TIER).length === 0) {
    for (const [tier, priceId] of Object.entries(STRIPE_PRICES)) {
      if (priceId) PRICE_TO_TIER[priceId] = tier;
    }
  }
  const Stripe = require("stripe");
  return new Stripe(key);
}

export const createStripeCheckout = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    return {
      tier: String(d.tier ?? "starter"),
      successUrl: String(d.successUrl ?? "/dashboard/settings?checkout=success"),
      cancelUrl: String(d.cancelUrl ?? "/dashboard/settings?checkout=canceled"),
    };
  })
  .handler(async ({ data }) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        // No Stripe key — simulate upgrade for development
        const db = sql();
        await db`
          UPDATE users SET 
            subscription_tier = ${data.tier},
            subscription_status = 'active',
            stripe_customer_id = 'dev_mode',
            stripe_subscription_id = 'dev_mode'
          WHERE id = ${USER_ID}
        `;
        return { ok: true, url: "/dashboard/settings?checkout=success" };
      }

      const priceId = STRIPE_PRICES[data.tier];
      if (!priceId) {
        return { ok: false, message: `No price configured for tier: ${data.tier}` };
      }

      // Get or create customer
      const db = sql();
      const [user] = await db`
        SELECT stripe_customer_id, email FROM users WHERE id = ${USER_ID}
      `;

      let customerId = user?.stripe_customer_id || "";

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user?.email || "customer@example.com",
          metadata: { user_id: USER_ID },
        });
        customerId = customer.id;
        await db`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${USER_ID}`;
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
        metadata: { user_id: USER_ID, tier: data.tier },
      });

      return { ok: true, url: session.url };
    } catch (err: any) {
      console.error("[createCheckout] error:", err);
      return { ok: false, message: err.message || "Failed to create checkout session." };
    }
  });

export const createBillingPortal = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    return {
      returnUrl: String(d.returnUrl ?? "/dashboard/settings"),
    };
  })
  .handler(async ({ data }) => {
    try {
      const stripe = getStripe();
      if (!stripe) {
        return { ok: false, message: "Stripe not configured. Use settings to manage subscription." };
      }

      const db = sql();
      const [user] = await db`
        SELECT stripe_customer_id FROM users WHERE id = ${USER_ID}
      `;

      if (!user?.stripe_customer_id || user.stripe_customer_id === "dev_mode") {
        return { ok: false, message: "No billing customer found." };
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: data.returnUrl,
      });

      return { ok: true, url: session.url };
    } catch (err: any) {
      console.error("[createPortal] error:", err);
      return { ok: false, message: err.message || "Failed to open billing portal." };
    }
  });

export const getSubscriptionQuota = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const [user] = await db`
      SELECT subscription_tier FROM users WHERE id = ${USER_ID}
    `;
    const tier = user?.subscription_tier ?? "free";

    const limits: Record<string, { label: string; responses: number }> = {
      free: { label: "Free", responses: 0 },
      starter: { label: "Starter", responses: 30 },
      pro: { label: "Pro", responses: 100 },
      agency: { label: "Agency", responses: 500 },
    };

    const limit = limits[tier] || limits.free;

    // Count current month's responses
    const [usage] = await db`
      SELECT COUNT(*)::int as count FROM responses
      WHERE user_id = ${USER_ID}
        AND created_at >= DATE_TRUNC('month', NOW())
    `;

    return {
      tier,
      label: limit.label,
      limit: limit.responses,
      used: usage?.count ?? 0,
      remaining: Math.max(0, limit.responses - (usage?.count ?? 0)),
      isUnlimited: limit.responses === 0 && tier === "free" ? false : limit.responses === 0,
    };
  } catch {
    return { tier: "free", label: "Free", limit: 0, used: 0, remaining: 0, isUnlimited: false };
  }
});