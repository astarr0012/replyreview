import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

const getHistory = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const rows = await db`
      SELECT r.id, r.platform, r.author_name, r.rating, r.review_text,
             rs.ai_generated_text, rs.tone, rs.status, rs.created_at
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

export const Route = createFileRoute("/dashboard/history")({
  component: HistoryPage,
  loader: () => getHistory(),
});

function HistoryPage() {
  const items = Route.useLoaderData();

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
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Author</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Rating</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {item.platform}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-900">{item.author_name || "—"}</td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-amber-500">{item.rating}/5</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      item.status === "posted" ? "bg-emerald-100 text-emerald-700" :
                      item.status === "approved" ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="max-w-xs truncate px-5 py-4 text-sm text-slate-500">
                    {item.ai_generated_text?.slice(0, 80)}...
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
