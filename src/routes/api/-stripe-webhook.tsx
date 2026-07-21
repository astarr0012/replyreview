import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { handleStripeWebhook } from "./stripe-webhook";

export const Route = createAPIFileRoute("/api/stripe-webhook")({
  POST: async ({ request }) => {
    try {
      const body = await request.text();
      const sig = request.headers.get("stripe-signature") || "";

      const Stripe = require("stripe");
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

      let event;
      if (endpointSecret) {
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
      } else {
        // Fallback: parse without verification (dev only)
        event = JSON.parse(body);
      }

      await handleStripeWebhook(event);

      return json({ received: true });
    } catch (err: any) {
      console.error("[stripe-webhook] error:", err);
      return json({ error: err.message }, { status: 400 });
    }
  },
});