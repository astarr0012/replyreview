import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

const getStats = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();

    // Pending alerts (reviews needing responses)
    const pendingAlerts = await db`
      SELECT a.id, a.type, a.priority, a.message, a.created_at,
             r.platform, r.author_name, r.rating, r.review_text
      FROM alerts a
      LEFT JOIN reviews r ON a.review_id = r.id
      WHERE a.acknowledged = false
      ORDER BY a.priority DESC, a.created_at DESC
      LIMIT 10
    `;
    const [alertCount] = await db`SELECT COUNT(*)::int as count FROM alerts WHERE acknowledged = false`;

    // Basic counts
    const [totalReviews] = await db`SELECT COUNT(*)::int as count FROM reviews`;
    const [totalResponses] = await db`SELECT COUNT(*)::int as count FROM responses`;
    const [postedResponses] = await db`SELECT COUNT(*)::int as count FROM responses WHERE status = 'posted'`;
    const [draftResponses] = await db`SELECT COUNT(*)::int as count FROM responses WHERE status = 'draft'`;

    // Average rating overall
    const [avgRating] = await db`SELECT ROUND(AVG(rating)::numeric, 1)::text as avg FROM reviews`;
    const [minRating] = await db`SELECT MIN(rating)::int as min FROM reviews`;
    const [maxRating] = await db`SELECT MAX(rating)::int as max FROM reviews`;

    // Sentiment breakdown (positive: 4-5, neutral: 3, negative: 1-2)
    const [positiveCount] = await db`SELECT COUNT(*)::int as count FROM reviews WHERE rating >= 4`;
    const [neutralCount] = await db`SELECT COUNT(*)::int as count FROM reviews WHERE rating = 3`;
    const [negativeCount] = await db`SELECT COUNT(*)::int as count FROM reviews WHERE rating <= 2`;

    // Rating trend — last 8 weeks grouped
    const ratingTrend = await db`
      SELECT
        DATE_TRUNC('week', created_at)::date as week_start,
        COUNT(*)::int as count,
        ROUND(AVG(rating)::numeric, 1)::text as avg_rating
      FROM reviews
      WHERE created_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY week_start
      ORDER BY week_start ASC
    `;

    // Response rate — reviews with/without responses
    const [respondedCount] = await db`
      SELECT COUNT(DISTINCT r.id)::int as count
      FROM reviews r
      INNER JOIN responses rs ON rs.review_id = r.id
    `;

    // Platform breakdown
    const platformBreakdown = await db`
      SELECT platform, COUNT(*)::int as count
      FROM reviews
      GROUP BY platform
    `;

    // Recent reviews
    const recentReviews = await db`
      SELECT r.*, rs.status as response_status
      FROM reviews r
      LEFT JOIN responses rs ON rs.review_id = r.id
      ORDER BY r.created_at DESC
      LIMIT 5
    `;

    return {
      totalReviews: totalReviews?.count ?? 0,
      totalResponses: totalResponses?.count ?? 0,
      postedResponses: postedResponses?.count ?? 0,
      draftResponses: draftResponses?.count ?? 0,
      averageRating: avgRating?.avg ?? null,
      minRating: minRating?.min ?? null,
      maxRating: maxRating?.max ?? null,
      positiveCount: positiveCount?.count ?? 0,
      neutralCount: neutralCount?.count ?? 0,
      negativeCount: negativeCount?.count ?? 0,
      respondedCount: respondedCount?.count ?? 0,
      ratingTrend: (ratingTrend ?? []).map((r: any) => ({
        ...r,
        week_start: String(r.week_start),
      })),
      platformBreakdown: platformBreakdown ?? [],
      pendingAlerts: (pendingAlerts ?? []).map((a: any) => ({
        ...a,
        created_at: String(a.created_at),
      })),
      alertCount: alertCount?.count ?? 0,
      recentReviews: (recentReviews ?? []).map((r: any) => ({
        ...r,
        created_at: String(r.created_at),
      })),
    };
  } catch (err) {
    console.error("[dashboard stats] error:", err);
    return {
      totalReviews: 0,
      totalResponses: 0,
      postedResponses: 0,
      draftResponses: 0,
      averageRating: null,
      minRating: null,
      maxRating: null,
      positiveCount: 0,
      neutralCount: 0,
      negativeCount: 0,
      respondedCount: 0,
      ratingTrend: [],
      platformBreakdown: [],
      pendingAlerts: [],
      alertCount: 0,
      recentReviews: [],
    };
  }
});

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
  loader: () => getStats(),
});

function DashboardHome() {
  const stats = Route.useLoaderData();
  const totalReviewed = stats.positiveCount + stats.neutralCount + stats.negativeCount;
  const responseRate = stats.totalReviews > 0 ? Math.round((stats.respondedCount / stats.totalReviews) * 100) : 0;
  const hasData = stats.totalReviews > 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
      <p className="mt-2 text-slate-600">Your review response activity at a glance.</p>

      {/* Stat cards row */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Reviews Collected"
          value={stats.totalReviews}
          color="bg-blue-50 text-blue-700"
          icon={<ReviewIcon />}
        />
        <StatCard
          label="Responses Generated"
          value={stats.totalResponses}
          color="bg-emerald-50 text-emerald-700"
          icon={<ResponseIcon />}
        />
        <StatCard
          label="Published"
          value={stats.postedResponses}
          color="bg-violet-50 text-violet-700"
          icon={<PublishedIcon />}
        />
        <StatCard
          label="Avg Rating"
          value={stats.averageRating ? `${stats.averageRating} / 5` : "—"}
          color="bg-amber-50 text-amber-700"
          icon={<StarIcon />}
        />
      </div>

      {/* Analytics widgets */}
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Widget 1: Sentiment Breakdown */}
        <AnalyticsWidget title="Sentiment Breakdown" subtitle="How customers feel">
          {!hasData ? (
            <EmptyWidget message="No reviews to analyze yet." />
          ) : (
            <div className="space-y-4">
              <SentimentBar
                label="Positive"
                count={stats.positiveCount}
                total={totalReviewed}
                color="bg-emerald-500"
                textColor="text-emerald-700"
              />
              <SentimentBar
                label="Neutral"
                count={stats.neutralCount}
                total={totalReviewed}
                color="bg-amber-400"
                textColor="text-amber-700"
              />
              <SentimentBar
                label="Negative"
                count={stats.negativeCount}
                total={totalReviewed}
                color="bg-red-400"
                textColor="text-red-700"
              />
              <div className="pt-2 text-center text-xs text-slate-500">
                Based on {totalReviewed} review{totalReviewed !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </AnalyticsWidget>

        {/* Widget 2: Response Rate */}
        <AnalyticsWidget title="Response Rate" subtitle="Reviews you've replied to">
          {!hasData ? (
            <EmptyWidget message="Import reviews to track your response rate." />
          ) : (
            <div className="flex flex-col items-center">
              <div className="relative mt-2 flex h-32 w-32 items-center justify-center">
                {/* SVG ring chart */}
                <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="10"
                    strokeDasharray={`${responseRate * 3.267} 326.7`}
                    strokeLinecap="round"
                    className="text-emerald-500 transition-all duration-700"
                  />
                </svg>
                <span className="text-3xl font-bold text-slate-900">{responseRate}%</span>
              </div>
              <div className="mt-3 flex items-center gap-6 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {stats.respondedCount} responded
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                  {stats.totalReviews - stats.respondedCount} pending
                </span>
              </div>
            </div>
          )}
        </AnalyticsWidget>

        {/* Widget 3: Rating Trend */}
        <AnalyticsWidget title="Rating Trend" subtitle="Last 8 weeks">
          {!hasData ? (
            <EmptyWidget message="No reviews yet to show a trend." />
          ) : stats.ratingTrend.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-slate-400">No reviews in the last 8 weeks.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.ratingTrend.map((week: any) => {
                const pct = (parseFloat(week.avg_rating) / 5) * 100;
                return (
                  <div key={week.week_start} className="flex items-center gap-3">
                    <span className="w-10 flex-shrink-0 text-right text-[11px] font-medium text-slate-500">
                      {formatWeekLabel(week.week_start)}
                    </span>
                    <div className="flex-1">
                      <div className="h-5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-14 flex-shrink-0 text-right text-xs font-semibold text-slate-700">
                      {week.avg_rating}
                    </span>
                    <span className="w-6 flex-shrink-0 text-right text-[11px] text-slate-400">
                      {week.count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </AnalyticsWidget>
      </div>

      {/* Platform breakdown */}
      {stats.platformBreakdown.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {stats.platformBreakdown.map((p: any) => (
            <div
              key={p.platform}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm"
            >
              <PlatformDot platform={p.platform} />
              <span className="text-sm font-medium capitalize text-slate-700">{p.platform}</span>
              <span className="ml-auto text-sm font-semibold text-slate-900">{p.count} review{p.count !== 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      )}

      {/* Alert notifications */}
      {stats.pendingAlerts.length > 0 && (
        <div className="mt-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">Pending Alerts</h2>
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                {stats.alertCount} needs attention
              </span>
            </div>
            <Link to="/dashboard" className="text-sm font-medium text-emerald-600 hover:text-emerald-500">
              Refresh →
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {stats.pendingAlerts.map((alert: any) => (
              <div
                key={alert.id}
                className={`rounded-xl border p-4 ${
                  alert.priority === "high" || alert.priority === "urgent"
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <AlertIcon priority={alert.priority} />
                    <div>
                      <span className="text-sm font-semibold text-slate-900">
                        {alert.author_name || "Unknown"}
                      </span>
                      {alert.rating && <Stars rating={alert.rating} />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.platform && (
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                        {alert.platform}
                      </span>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      alert.priority === "high" || alert.priority === "urgent"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}>
                      {alert.priority}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{alert.message}</p>
                {alert.review_text && (
                  <p className="mt-1 text-xs text-slate-500 italic line-clamp-2">
                    "{alert.review_text}"
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-400">
                  <span>{formatTimeAgo(alert.created_at)}</span>
                  <a href="/dashboard/new" className="font-medium text-emerald-600 hover:text-emerald-500">
                    Respond now →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent reviews */}
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
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      {r.platform}
                    </span>
                    {r.response_status && (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.response_status === "posted"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {r.response_status}
                      </span>
                    )}
                  </div>
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

/* ---------- Sub-components ---------- */

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className={`mt-1 inline-block rounded-full px-3 py-1 text-2xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${color}`}>{icon}</div>
      </div>
    </div>
  );
}

function AnalyticsWidget({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyWidget({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-xl bg-slate-50">
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

function SentimentBar({ label, count, total, color, textColor }: { label: string; count: number; total: number; color: string; textColor: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <span className={`font-semibold ${textColor}`}>
          {count} ({pct}%)
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PlatformDot({ platform }: { platform: string }) {
  const color = platform === "google" ? "bg-[#4285F4]" : "bg-[#d32323]";
  return <span className={`grid h-6 w-6 place-items-center rounded-full ${color} text-[9px] font-bold text-white`}>{platform === "google" ? "G" : "Y"}</span>;
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 text-amber-400" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={i <= rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className={`h-3.5 w-3.5 ${i > rating ? "text-slate-300" : ""}`}
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function formatWeekLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTimeAgo(dateStr: string) {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function AlertIcon({ priority }: { priority: string }) {
  const isUrgent = priority === "high" || priority === "urgent";
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 ${isUrgent ? "text-red-500" : "text-amber-500"}`}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/* ---------- Inline SVG icons ---------- */

function ReviewIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ResponseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function PublishedIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}