"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Crown,
  ExternalLink,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShoppingCart,
  Smartphone,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { NavigationProgress } from "@/components/NavigationProgress";

type AdminNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: typeof LayoutDashboard;
  tone: "green" | "blue" | "purple" | "orange";
};

const navGroups: { title: string; description: string; items: AdminNavItem[] }[] = [
  {
    title: "Operations",
    description: "Daily order and payment work",
    items: [
      {
        href: "/admin",
        label: "Overview",
        shortLabel: "Home",
        description: "Revenue, activity, and system health",
        icon: LayoutDashboard,
        tone: "green",
      },
      {
        href: "/admin/orders",
        label: "Orders",
        shortLabel: "Orders",
        description: "Approve, process, sync, and track orders",
        icon: ShoppingCart,
        tone: "orange",
      },
      {
        href: "/admin/topups",
        label: "Wallet Top-Ups",
        shortLabel: "Top-Ups",
        description: "Approve GCash wallet deposits",
        icon: Wallet,
        tone: "green",
      },
    ],
  },
  {
    title: "Catalog",
    description: "What customers can buy",
    items: [
      {
        href: "/admin/services",
        label: "Services",
        shortLabel: "Services",
        description: "Edit service cards and SMM mapping",
        icon: Settings,
        tone: "green",
      },
      {
        href: "/admin/app",
        label: "Mobile App",
        shortLabel: "App",
        description: "Edit APK screen, theme, and versions",
        icon: Smartphone,
        tone: "blue",
      },
      {
        href: "/admin/page-requests",
        label: "Page Requests",
        shortLabel: "Pages",
        description: "Custom page order pipeline",
        icon: FileText,
        tone: "blue",
      },
      {
        href: "/admin/vip",
        label: "VIP Subscriptions",
        shortLabel: "VIP",
        description: "Approve paid VIP accounts",
        icon: Crown,
        tone: "purple",
      },
    ],
  },
  {
    title: "Customers",
    description: "People, wallet balances, and chat",
    items: [
      {
        href: "/admin/customers",
        label: "Customers",
        shortLabel: "Clients",
        description: "Profiles, balances, and admin chat",
        icon: Users,
        tone: "blue",
      },
    ],
  },
];

const bottomNavItems = [
  navGroups[0].items[0],
  navGroups[0].items[1],
  navGroups[0].items[2],
  navGroups[2].items[0],
  navGroups[1].items[1],
];

const toneClasses = {
  green: "text-[#1DB954] bg-[#1DB954]/10 border-[#1DB954]/25",
  blue: "text-blue-400 bg-blue-500/10 border-blue-500/25",
  purple: "text-purple-400 bg-purple-500/10 border-purple-500/25",
  orange: "text-orange-400 bg-orange-500/10 border-orange-500/25",
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavLink({
  item,
  active,
  compact = false,
  onNavigate,
}: {
  item: AdminNavItem;
  active: boolean;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`group flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200 ${
        active
          ? "border-[#1DB954]/35 bg-[#1DB954]/10 text-white"
          : "border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-800/40 hover:text-white"
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
          active ? toneClasses[item.tone] : "border-slate-800 bg-[#121212] text-slate-500 group-hover:text-slate-200"
        }`}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-black uppercase tracking-wider">
          {compact ? item.shortLabel : item.label}
        </span>
        {!compact && (
          <span className="mt-0.5 block truncate text-[10px] font-semibold text-slate-500">
            {item.description}
          </span>
        )}
      </span>
      {!compact && (
        <ChevronRight
          size={14}
          className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${
            active ? "text-[#1DB954]" : "text-slate-650"
          }`}
        />
      )}
    </Link>
  );
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className={`flex items-center justify-center gap-3 rounded-xl border border-red-500/10 bg-red-500/5 text-red-300 transition-all duration-200 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-200 active:scale-95 ${
          compact ? "h-10 w-10 p-0" : "px-4 py-3 text-left"
        }`}
        title="Sign Out"
        aria-label="Sign Out"
      >
        <LogOut size={18} />
        {!compact && <span className="text-xs font-black uppercase tracking-wider">Sign Out</span>}
      </button>
    </form>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-bg text-fg lg:flex">
      <NavigationProgress />
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#121212]/95 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#181818] text-slate-300 transition hover:border-[#1DB954]/35 hover:text-[#1DB954] active:scale-95"
            aria-label="Open admin menu"
          >
            <Menu size={20} />
          </button>
          <Link href="/admin" className="flex min-w-0 flex-1 items-center justify-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1DB954] text-sm font-black text-black">
              PB
            </span>
            <span className="min-w-0 text-center">
              <span className="block truncate text-sm font-black uppercase tracking-tight text-white">
                PinoyBoosting
              </span>
              <span className="block truncate text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
                Admin workspace
              </span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle compact />
            <SignOutButton compact />
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            aria-label="Close admin menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(22rem,88vw)] flex-col border-r border-slate-800 bg-[#151515] shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-850 px-4 py-4">
              <div className="min-w-0">
                <p className="text-sm font-black uppercase tracking-tight text-white">Admin Menu</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Organized controls</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-[#121212] text-slate-400 transition hover:text-white"
                aria-label="Close admin menu"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
              {navGroups.map((group) => (
                <section key={group.title} className="space-y-2">
                  <div className="px-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{group.title}</p>
                    <p className="text-[10px] font-semibold text-slate-600">{group.description}</p>
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <AdminNavLink
                        key={item.href}
                        item={item}
                        active={isActivePath(pathname, item.href)}
                        onNavigate={() => setMobileMenuOpen(false)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </nav>
            <div className="space-y-2 border-t border-slate-850 p-4">
              <Link
                href="/"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#121212] px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300 transition hover:border-[#1DB954]/35 hover:text-[#1DB954]"
              >
                Visit Website <ExternalLink size={14} />
              </Link>
              <SignOutButton />
            </div>
          </aside>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-850/80 bg-[#181818]/95 text-slate-400 backdrop-blur-md lg:flex">
        <div className="border-b border-slate-850/60 p-6">
          <Link href="/admin" className="group flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1DB954] text-sm font-black text-black transition group-hover:scale-105">
              PB
            </span>
            <span className="min-w-0">
              <span className="block truncate text-lg font-black tracking-tight text-white">PinoyBoosting</span>
              <span className="block text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
                Admin Control Panel
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {navGroups.map((group) => (
            <section key={group.title} className="space-y-2">
              <div className="px-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{group.title}</p>
                <p className="text-[10px] font-semibold text-slate-600">{group.description}</p>
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <AdminNavLink key={item.href} item={item} active={isActivePath(pathname, item.href)} />
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="space-y-2 border-t border-slate-850/60 p-4">
          <ThemeToggle />
          <Link
            href="/"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#121212] px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-300 transition hover:border-[#1DB954]/35 hover:text-[#1DB954]"
          >
            Visit Website <ExternalLink size={14} />
          </Link>
          <SignOutButton />
        </div>
      </aside>

      <main className="relative min-h-screen flex-grow overflow-hidden px-3 pb-28 pt-5 sm:px-5 lg:ml-72 lg:p-8">
        <div className="pointer-events-none absolute right-0 top-0 h-80 w-80 rounded-full bg-[#1DB954]/5 blur-3xl" />
        <div className="relative z-10 mx-auto w-full max-w-[1500px]">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800/80 bg-[#121212]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-md lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-all ${
                  active
                    ? "bg-[#1DB954]/10 text-[#1DB954]"
                    : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <Icon size={18} />
                <span className="max-w-full truncate text-[9px] font-black uppercase tracking-wide">
                  {item.shortLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
