import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

// Map Stripe price IDs back to tiers
const PRICE_TO_TIER: Record<string, string> = {};

function getPriceMap(): Record<string, string> {
  if (Object.keys(PRICE_TO_TIER).length === 0) {
    const prices: Record<string, string> = {
      starter: process.env.STRIPE_PRICE_STARTER || "",
      pro: process.env.STRIPE_PRICE_PRO || "",
      agency: process.env.STRIPE_PRICE_AGENCY || "",
    };
    for (const [tier, priceId] of Object.entries(prices)) {
      if (priceId) PRICE_TO_TIER[priceId] = tier;
    }
  }
  return PRICE_TO_TIER;
}

/**
 * Handle Stripe webhook events inline (called from the route).
 * This processes subscription lifecycle events and updates the database.
 */
export async function handleStripeWebhook(event: any) {
  try {
    const db = sql();
    const priceMap = getPriceMap();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const lineItems = session.line_items?.data || [];
        const priceId = lineItems[0]?.price?.id || session.metadata?.tier;
        const tier = priceMap[priceId] || session.metadata?.tier || "starter";

        if (userId) {
          await db`
            UPDATE users SET 
              subscription_tier = ${tier},
              subscription_status = 'active',
              stripe_customer_id = ${session.customer},
              stripe_subscription_id = ${session.subscription || ""}
            WHERE id = ${userId}
          `;
          console.log(`[stripe-webhook] checkout completed: user=${userId}, tier=${tier}`);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subId = invoice.subscription;

        if (customerId && subId) {
          // Refresh subscription details
          try {
            const Stripe = require("stripe");
            const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
            const subscription = await stripe.subscriptions.retrieve(subId);
            const priceId = subscription.items?.data?.[0]?.price?.id;
            const tier = priceMap[priceId] || "starter";

            await db`
              UPDATE users SET 
                subscription_status = 'active',
                subscription_tier = ${tier},
                stripe_subscription_id = ${subId}
              WHERE stripe_customer_id = ${customerId}
            `;
            console.log(`[stripe-webhook] invoice paid: customer=${customerId}, tier=${tier}`);
          } catch (e) {
            console.error("[stripe-webhook] failed to refresh sub:", e);
          }
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const status = sub.status === "active" || sub.status === "trialing" ? "active"
          : sub.status === "past_due" ? "past_due"
          : sub.status === "canceled" || sub.status === "unpaid" ? "canceled"
          : "inactive";

        const priceId = sub.items?.data?.[0]?.price?.id;
        const tier = priceMap[priceId] || "free";

        await db`
          UPDATE users SET 
            subscription_status = ${status},
            subscription_tier = ${tier}
          WHERE stripe_customer_id = ${sub.customer}
        `;
        console.log(`[stripe-webhook] sub ${event.type}: customer=${sub.customer}, status=${status}, tier=${tier}`);
        break;
      }

      default:
        console.log(`[stripe-webhook] unhandled event: ${event.type}`);
    }

    return true;
  } catch (err) {
    console.error("[stripe-webhook] error:", err);
    return false;
  }
}