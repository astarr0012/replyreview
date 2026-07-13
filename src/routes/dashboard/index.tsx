import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

const getStats = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const [totalReviews] = await db`SELECT COUNT(*)::int as count FROM reviews`;
    const [totalResponses] = await db`SELECT COUNT(*)::int as count FROM responses`;
    const [postedResponses] = await db`SELECT COUNT(*)::int as count FROM responses WHERE status = 'posted'`;
    const [recentReviews] = await db`SELECT * FROM reviews ORDER BY created_at DESC LIMIT 5`;
    return {
      totalReviews: totalReviews?.count ?? 0,
      totalResponses: totalResponses?.count ?? 0,
      postedResponses: postedResponses?.count ?? 0,
      recentReviews: recentReviews ?? [],
    };
  } catch {
    return { totalReviews: 0, totalResponses: 0, postedResponses: 0, recentReviews: [] };
  }
});

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
  loader: () => getStats(),
});

function DashboardHome() {
  const stats = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
      <p className="mt-2 text-slate-600">Your review response activity at a glance.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <StatCard label="Reviews Collected" value={stats.totalReviews} color="bg-blue-50 text-blue-700" />
        <StatCard label="Responses Generated" value={stats.totalResponses} color="bg-emerald-50 text-emerald-700" />
        <StatCard label="Published" value={stats.postedResponses} color="bg-violet-50 text-violet-700" />
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Recent Reviews</h2>
          <a href="/dashboard/history" className="text-sm font-medium text-emerald-600 hover:text-emerald-500">
            View all →
          </a>
        </div>
        {stats.recentReviews.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-12 text-center">
            <p className="text-slate-500">No reviews yet. Import your first review to get started.</p>
            <a
              href="/dashboard/new"
              className="mt-4 inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Generate your first response
            </a>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {stats.recentReviews.map((r: any) => (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{r.author_name}</span>
                    <Stars rating={r.rating} />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {r.platform}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{r.review_text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 inline-block rounded-full px-3 py-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 text-amber-400" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={i <= rating ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 ${i > rating ? "text-slate-300" : ""}`}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}
