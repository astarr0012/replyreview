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
    { href: "/dashboard/import", label: "Import", icon: UploadIcon },
    { href: "/dashboard/history", label: "History", icon: ClockIcon },
    { href: "/dashboard/brand-voice", label: "Brand Voice", icon: VoiceIcon },
    { href: "/dashboard/support", label: "Support", icon: SupportIcon },
    { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
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

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function SupportIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
    </svg>
  );
}