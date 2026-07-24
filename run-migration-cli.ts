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
                    console.log("Creating locations table...");
                    await db`CREATE TABLE IF NOT EXISTS locations (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                      name TEXT NOT NULL DEFAULT '',
                      address TEXT NOT NULL DEFAULT '',
                      phone TEXT NOT NULL DEFAULT '',
                      is_active BOOLEAN NOT NULL DEFAULT false,
                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )`;
                    console.log("Creating team_members table...");
                    await db`CREATE TABLE IF NOT EXISTS team_members (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                      location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
                      name TEXT NOT NULL DEFAULT '',
                      email TEXT NOT NULL DEFAULT '',
                      role TEXT NOT NULL DEFAULT 'reviewer' CHECK (role IN ('owner', 'manager', 'reviewer')),
                      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined')),
                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )`;
                    await db`ALTER TABLE reviews ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL`;
                    await db`ALTER TABLE responses ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en'`;
                    await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS active_location_id UUID REFERENCES locations(id) ON DELETE SET NULL`;
                    await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT NOT NULL DEFAULT ''`;
                    await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT NOT NULL DEFAULT ''`;
                    console.log("Creating platform_connections table...");
                    await db`CREATE TABLE IF NOT EXISTS platform_connections (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
                      platform TEXT NOT NULL CHECK (platform IN ('google', 'yelp')),
                      access_token TEXT NOT NULL DEFAULT '',
                      refresh_token TEXT NOT NULL DEFAULT '',
                      token_expires_at TIMESTAMPTZ,
                      connected BOOLEAN NOT NULL DEFAULT false,
                      connected_at TIMESTAMPTZ,
                      last_synced_at TIMESTAMPTZ,
                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )`;
                    console.log("Creating email_campaigns table...");
                    await db`CREATE TABLE IF NOT EXISTS email_campaigns (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      type TEXT NOT NULL DEFAULT 'launch_announcement',
                      subject TEXT NOT NULL DEFAULT '',
                      sent_to TEXT NOT NULL DEFAULT 'all',
                      recipient_count INTEGER NOT NULL DEFAULT 0,
                      success_count INTEGER NOT NULL DEFAULT 0,
                      fail_count INTEGER NOT NULL DEFAULT 0,
                      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )`;
                    console.log("Creating email_log table...");
                    await db`CREATE TABLE IF NOT EXISTS email_log (
                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                      campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
                      email TEXT NOT NULL DEFAULT '',
                      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
                      error TEXT NOT NULL DEFAULT '',
                      sent_at TIMESTAMPTZ
                    )`;
                    console.log("Migration finished successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

run();
