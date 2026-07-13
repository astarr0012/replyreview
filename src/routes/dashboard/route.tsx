import { Outlet, createFileRoute, Link, useLocation } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const location = useLocation();
  const pathname = location.pathname;

  const navItems = [
    { href: "/dashboard", label: "Overview", icon: HomeIcon },
    { href: "/dashboard/new", label: "New Response", icon: PlusIcon },
    { href: "/dashboard/history", label: "History", icon: ClockIcon },
    { href: "/dashboard/brand-voice", label: "Brand Voice", icon: VoiceIcon },
  ];

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
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
          </nav>
        </div>
      </header>

      {/* Page content */}
      <Outlet />
    </div>
  );
}

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
