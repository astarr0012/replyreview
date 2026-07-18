import { sql } from "./src/db";

async function run() {
  try {
    const db = sql();
    console.log("Starting migration...");
    
    console.log("Creating waitlist table...");
    await db`CREATE TABLE IF NOT EXISTS waitlist (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    
    console.log("Creating users table...");
    await db`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      business_name TEXT NOT NULL DEFAULT '',
      stripe_customer_id TEXT,
      subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'pro', 'agency')),
      subscription_status TEXT NOT NULL DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'inactive', 'canceled', 'past_due')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    
    console.log("Creating reviews table...");
    await db`CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL CHECK (platform IN ('google', 'yelp')),
      author_name TEXT NOT NULL DEFAULT '',
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      review_text TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    
    console.log("Creating responses table...");
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
    
    console.log("Creating brand_voices table...");
    await db`CREATE TABLE IF NOT EXISTS brand_voices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Default',
      tone_preset TEXT NOT NULL DEFAULT 'professional' CHECK (tone_preset IN ('warm', 'professional', 'apologetic', 'enthusiastic')),
      business_name TEXT NOT NULL DEFAULT '',
      sample_replies JSONB DEFAULT '[]',
      UNIQUE(user_id, name)
          )`;

            console.log("Creating alerts table...");
            await db`CREATE TABLE IF NOT EXISTS alerts (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
              type TEXT NOT NULL DEFAULT 'new_review' CHECK (type IN ('new_review', 'negative_review', 'response_due')),
              priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
              message TEXT NOT NULL DEFAULT '',
              email_sent BOOLEAN NOT NULL DEFAULT false,
              email_sent_at TIMESTAMPTZ,
              acknowledged BOOLEAN NOT NULL DEFAULT false,
              acknowledged_at TIMESTAMPTZ,
              created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                  )`;
                    console.log("Creating support_tickets table...");
                    await db`CREATE TABLE IF NOT EXISTS support_tickets (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                      subject TEXT NOT NULL DEFAULT '',
                      message TEXT NOT NULL DEFAULT '',
                      priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
                      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )`;
                    console.log("Migration finished successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

run();
