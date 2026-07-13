import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { useState } from "react";

const getBrandVoice = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const rows = await db`SELECT * FROM brand_voices WHERE user_id = '00000000-0000-0000-0000-000000000000' LIMIT 1`;
    return rows[0] || null;
  } catch {
    return null;
  }
});

const saveBrandVoice = createServerFn({ method: "POST" })
  .validator((data: any) => ({
    name: String(data.name || "Default"),
    tone_preset: String(data.tone_preset || "professional"),
    business_name: String(data.business_name || ""),
  }))
  .handler(async ({ data }) => {
    try {
      const db = sql();
      await db`
        INSERT INTO brand_voices (user_id, name, tone_preset, business_name)
        VALUES ('00000000-0000-0000-0000-000000000000', ${data.name}, ${data.tone_preset}, ${data.business_name})
        ON CONFLICT (user_id, name)
        DO UPDATE SET tone_preset = ${data.tone_preset}, business_name = ${data.business_name}
      `;
      return { ok: true, message: "Brand voice saved!" };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  });

export const Route = createFileRoute("/dashboard/brand-voice")({
  component: BrandVoicePage,
  loader: () => getBrandVoice(),
});

function BrandVoicePage() {
  const saved = Route.useLoaderData();
  const [form, setForm] = useState({
    name: saved?.name || "Default",
    tone_preset: saved?.tone_preset || "professional",
    business_name: saved?.business_name || "",
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await saveBrandVoice({ data: form });
    setMessage(res.ok ? { ok: true, text: res.message } : { ok: false, text: res.message });
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Brand Voice</h1>
      <p className="mt-2 text-slate-600">Train ReviewReply to sound like you — every time.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-slate-700">Profile Name</label>
          <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Default Tone</label>
          <select value={form.tone_preset} onChange={(e) => setForm((f) => ({ ...f, tone_preset: e.target.value }))}
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
            <option value="warm">Warm & Friendly</option>
            <option value="professional">Polished & Professional</option>
            <option value="apologetic">Apologetic & Sincere</option>
            <option value="enthusiastic">Enthusiastic & Energetic</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">Business Name</label>
          <input type="text" value={form.business_name} onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
            placeholder="Your Business Name"
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
          <p className="mt-1.5 text-xs text-slate-500">Used in every AI-generated response for a personal touch.</p>
        </div>

        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {message.text}
          </div>
        )}

        <button type="submit" className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
          Save Brand Voice
        </button>
      </form>
    </div>
  );
}
