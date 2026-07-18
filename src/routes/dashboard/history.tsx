import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import * as React from "react";

const LANGUAGE_MAP: Record<string, { label: string; color: string }> = {
  en: { label: "EN", color: "bg-blue-100 text-blue-700" },
  es: { label: "ES", color: "bg-red-100 text-red-700" },
  fr: { label: "FR", color: "bg-indigo-100 text-indigo-700" },
  de: { label: "DE", color: "bg-amber-100 text-amber-700" },
  zh: { label: "ZH", color: "bg-rose-100 text-rose-700" },
  ja: { label: "JA", color: "bg-pink-100 text-pink-700" },
  ko: { label: "KO", color: "bg-purple-100 text-purple-700" },
  pt: { label: "PT", color: "bg-green-100 text-green-700" },
  it: { label: "IT", color: "bg-sky-100 text-sky-700" },
  ru: { label: "RU", color: "bg-stone-100 text-stone-700" },
  ar: { label: "AR", color: "bg-orange-100 text-orange-700" },
  vi: { label: "VI", color: "bg-teal-100 text-teal-700" },
  th: { label: "TH", color: "bg-cyan-100 text-cyan-700" },
  nl: { label: "NL", color: "bg-lime-100 text-lime-700" },
  pl: { label: "PL", color: "bg-violet-100 text-violet-700" },
  tr: { label: "TR", color: "bg-yellow-100 text-yellow-700" },
  auto: { label: "AUTO", color: "bg-slate-100 text-slate-600" },
};

const getHistory = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const rows = await db`
      SELECT r.id AS review_id, r.platform, r.author_name, r.rating, r.review_text,
             rs.id AS response_id, rs.ai_generated_text, rs.tone, rs.language, rs.status, rs.created_at
      FROM responses rs
      LEFT JOIN reviews r ON rs.review_id = r.id
      ORDER BY rs.created_at DESC
      LIMIT 50
    `;
    return rows.map((row: any) => ({
      ...row,
      created_at: String(row.created_at),
    }));
  } catch {
    return [];
  }
});

const toggleStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    return {
      responseId: String(d.responseId ?? ""),
      reviewId: String(d.reviewId ?? ""),
      currentStatus: String(d.currentStatus ?? "draft"),
    };
  })
  .handler(async ({ data }) => {
    try {
      const db = sql();
      const newStatus = data.currentStatus === "posted" ? "draft" : "posted";
      await db`UPDATE responses SET status = ${newStatus} WHERE id = ${data.responseId}`;
      if (newStatus === "posted" && data.reviewId) {
        await db`UPDATE alerts SET acknowledged = true WHERE review_id = ${data.reviewId}`;
      }
      return { ok: true, newStatus };
    } catch (err: any) {
      console.error("[toggleStatus] error:", err);
      return { ok: false, message: err.message || "Failed to toggle status." };
    }
  });

export const Route = createFileRoute("/dashboard/history")({
  component: HistoryPage,
  loader: () => getHistory(),
});

function LanguageBadge({ lang }: { lang: string }) {
  const info = LANGUAGE_MAP[lang] || LANGUAGE_MAP.en;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${info.color}`}>
      {info.label}
    </span>
  );
}

function HistoryPage() {
  const items = Route.useLoaderData();
  const [statusMap, setStatusMap] = React.useState<Record<string, string>>({});
  const [toggleLoading, setToggleLoading] = React.useState<string | null>(null);

  const getStatus = (item: any) => statusMap[item.response_id] || item.status;

  async function handleToggle(item: any) {
    setToggleLoading(item.response_id);
    const res = await toggleStatus({
      data: {
        responseId: item.response_id,
        reviewId: item.review_id,
        currentStatus: getStatus(item),
      },
    });
    if (res.ok) {
      setStatusMap((m) => ({ ...m, [item.response_id]: res.newStatus }));
    }
    setToggleLoading(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Response History</h1>
      <p className="mt-2 text-slate-600">Every response you've generated, searchable and sortable.</p>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500">No responses yet.</p>
          <a href="/dashboard/new" className="mt-4 inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            Generate your first response
          </a>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Platform</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Lang</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Author</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Rating</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Preview</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item: any) => (
                <tr key={item.response_id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {item.platform}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <LanguageBadge lang={item.language || "en"} />
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-900">{item.author_name || "—"}</td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-amber-500">{item.rating}/5</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      getStatus(item) === "posted" ? "bg-emerald-100 text-emerald-700" :
                      getStatus(item) === "approved" ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {getStatus(item)}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-5 py-4 text-sm text-slate-500">
                    {item.ai_generated_text?.slice(0, 80)}...
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <button
                      onClick={() => handleToggle(item)}
                      disabled={toggleLoading === item.response_id}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition disabled:opacity-60 ${
                        getStatus(item) === "posted"
                          ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          : "bg-emerald-600 text-white hover:bg-emerald-500"
                      }`}
                    >
                      {toggleLoading === item.response_id ? (
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : getStatus(item) === "posted" ? (
                        "Mark as Draft"
                      ) : (
                        "Approve & Post"
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}