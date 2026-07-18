import { Outlet, createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

const getAlertCount = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const [result] = await db`SELECT COUNT(*)::int as count FROM alerts WHERE acknowledged = false`;
    const [urgent] = await db`SELECT COUNT(*)::int as count FROM alerts WHERE acknowledged = false AND priority IN ('high', 'urgent')`;
    return { total: result?.count ?? 0, urgent: urgent?.count ?? 0 };
  } catch {
    return { total: 0, urgent: 0 };
  }
});

function DashboardLayout() {
  const location = useLocation();
  const pathname = location.pathname;
  const [alertCount, setAlertCount] = useState({ total: 0, urgent: 0 });
  const [alertsOpen, setAlertsOpen] = useState(false);

  useEffect(() => {
    getAlertCount().then(setAlertCount);
    const interval = setInterval(() => {
      getAlertCount().then(setAlertCount);
    }, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: HomeIcon },
    { href: "/dashboard/new", label: "New Response", icon: PlusIcon },
    { href: "/dashboard/history", label: "History", icon: ClockIcon },
    { href: "/dashboard/brand-voice", label: "Brand Voice", icon: VoiceIcon },
  ];

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Alert banner */}
      {alertCount.total > 0 && (
        <div className={`${alertCount.urgent > 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"} border-b px-6 py-2`}>
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <BellIcon className={`h-4 w-4 ${alertCount.urgent > 0 ? "text-red-500" : "text-amber-500"}`} />
              <span className={alertCount.urgent > 0 ? "text-red-800 font-medium" : "text-amber-800"}>
                {alertCount.urgent > 0
                  ? `${alertCount.urgent} urgent review${alertCount.urgent !== 1 ? "s" : ""} need${alertCount.urgent === 1 ? "s" : ""} your attention`
                  : `${alertCount.total} pending alert${alertCount.total !== 1 ? "s" : ""}`}
              </span>
            </div>
            <a
              href="/dashboard"
              className={`text-xs font-semibold underline-offset-2 hover:underline ${
                alertCount.urgent > 0 ? "text-red-700" : "text-amber-700"
              }`}
            >
              View details →
            </a>
          </div>
        </div>
      )}

      {/* Top nav */}
      <header className={`sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur ${alertCount.total > 0 ? "" : ""}`}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 text-[10px] font-bold text-white">R</span>
            ReviewReply
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    isActive ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
            {/* Alert bell button */}
            <button
              onClick={() => setAlertsOpen(!alertsOpen)}
              className="relative ml-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Alerts"
            >
              <BellIcon className="h-4 w-4" />
              {alertCount.total > 0 && (
                <span className={`absolute -right-0.5 -top-0.5 grid min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-bold text-white ${
                  alertCount.urgent > 0 ? "bg-red-500" : "bg-amber-500"
                }`}>
                  {alertCount.total}
                </span>
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <Outlet />
    </div>
  );
}

/* ---------- Icons ---------- */

function HomeIcon({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function PlusIcon({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>;
}
function ClockIcon({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function VoiceIcon({ className }: { className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 4v16M8 8v8M16 8v8M4 12v0M20 12v0"/></svg>;
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}