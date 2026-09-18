"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Flag, LayoutDashboard, LogOut, Menu, UserCog, Users, X } from "lucide-react";
import type { AdminWhoAmI } from "@/lib/types";

// SUPER_ADMIN_ONLY lists the items gated behind SuperAdminOnlyGuard server-side
// (/admin/stats/**, /admin/admins) — filtered out below for a plain ADMIN so the nav
// doesn't link to a page that will just 403. Users is open to both roles (day-to-day
// moderation); Reports is still SUPER_ADMIN-only today but left visible here rather than
// assumed permanent.
const SUPER_ADMIN_ONLY = new Set(["/dashboard", "/admins"]);
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/reports", label: "Reports", icon: Flag },
  { href: "/admins", label: "Admins", icon: UserCog },
];

export function DashboardShell({
  who,
  children,
}: {
  who: AdminWhoAmI | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the drawer on every navigation (covers back/forward too, not just link taps),
  // and never leave it open behind a route the user didn't reach through it.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock background scroll while the drawer is open, like any mobile nav sheet.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const nav = who?.role === "SUPER_ADMIN" ? NAV : NAV.filter((item) => !SUPER_ADMIN_ONLY.has(item.href));
  const currentLabel = nav.find((item) => pathname.startsWith(item.href))?.label ?? "ConvoX Admin";

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile-only topbar: hamburger + current section + avatar. The sidebar itself is a
          fixed off-canvas drawer below lg, and a normal static column at lg and up. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="focus-ring -ml-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <span className="truncate text-sm font-semibold text-ink">{currentLabel}</span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
          {(who?.username ?? "?").slice(0, 1).toUpperCase()}
        </div>
      </header>

      {/* Backdrop — tapping it (or picking a nav link) closes the drawer. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shrink-0 flex-col bg-ink text-slate-200 transition-transform duration-200 ease-out lg:static lg:w-64 lg:max-w-none lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no need for next/image here */}
            <img src="/convox-logo.png" alt="ConvoX" className="h-8 w-8 rounded-lg" />
            <span className="text-sm font-semibold text-white">ConvoX Admin</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-3 py-4">
          <div className="mb-3 flex items-center gap-2.5 px-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
              {(who?.username ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{who?.username ?? "Admin"}</p>
              <p className="truncate text-xs text-slate-400">{who?.email ?? ""}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 bg-canvas">{children}</main>
    </div>
  );
}
