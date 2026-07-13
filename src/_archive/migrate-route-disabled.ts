import { json } from "@tanstack/react-start";
import { createAPIFileRoute } from "@tanstack/react-start/api";
import { sql } from "~/db";

export const Route = createAPIFileRoute("/api/migrate")({
  GET: async () => {
    try {
      const db = sql();

      await db`CREATE TABLE IF NOT EXISTS waitlist (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;

      await db`CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL DEFAULT '',
        stripe_customer_id TEXT,
        subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'agency')),
        subscription_status TEXT NOT NULL DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'canceled', 'past_due')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;

      await db`CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform TEXT NOT NULL CHECK (platform IN ('google', 'yelp')),
        author_name TEXT NOT NULL DEFAULT '',
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_text TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;

      await db`CREATE TABLE IF NOT EXISTS responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        review_id UUID REFERENCES reviews(id) ON DELETE SET NULL,
        ai_generated_text TEXT NOT NULL DEFAULT '',
        edited_text TEXT NOT NULL DEFAULT '',
        tone TEXT NOT NULL DEFAULT 'professional',
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'posted')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;

      await db`CREATE TABLE IF NOT EXISTS brand_voices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL DEFAULT 'Default',
        tone_preset TEXT NOT NULL DEFAULT 'professional' CHECK (tone_preset IN ('warm', 'professional', 'apologetic', 'enthusiastic')),
        business_name TEXT NOT NULL DEFAULT '',
        sample_replies JSONB DEFAULT '[]',
        UNIQUE(user_id, name)
      )`;

      return json({ ok: true, message: "All tables created successfully" });
    } catch (error) {
      console.error("[migrate] error:", error);
      return json({ ok: false, message: String(error) }, { status: 500 });
    }
  },
});
