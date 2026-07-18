import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import * as React from "react";

const runMigrate = createServerFn({ method: "POST" }).handler(async () => {
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
      business_name TEXT NOT NULL DEFAULT '',
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
    await db`CREATE TABLE IF NOT EXISTS support_tickets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await db`CREATE TABLE IF NOT EXISTS locations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
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
    return { ok: true, message: "All tables created successfully" };
  } catch (error) {
    console.error("[migrate] error:", error);
    return { ok: false, message: String(error) };
  }
});

export const Route = createFileRoute("/api/migrate")({
  component: MigratePage,
});

function MigratePage() {
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleMigrate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await runMigrate();
      setResult(res);
    } catch (e) {
      setResult({ ok: false, message: String(e) });
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-3xl font-bold text-slate-900">Database Migration</h1>
      <p className="mt-2 text-slate-600">Create the database tables required by ReviewReply.</p>
      <button
        onClick={handleMigrate}
        disabled={loading}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
      >
        {loading ? "Running..." : "Run Migration"}
      </button>
      {result && (
        <div className={`mt-6 rounded-xl border p-4 ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          <p className="font-semibold">{result.ok ? "Success" : "Error"}</p>
          <p className="mt-1 text-sm">{result.message}</p>
        </div>
      )}
    </div>
  );
}