import Link from "next/link";
import {
  LayoutDashboard,
  ShoppingCart,
  Crown,
  Settings,
  Users,
  LogOut,
  Wallet,
  FileText,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const adminNavItems = [
  {
    href: "/admin",
    label: "Overview",
    shortLabel: "Home",
    icon: LayoutDashboard,
    accentClass: "group-hover:text-[#1DB954]",
  },
  {
    href: "/admin/orders",
    label: "Orders",
    shortLabel: "Orders",
    icon: ShoppingCart,
    accentClass: "group-hover:text-[#1DB954]",
  },
  {
    href: "/admin/page-requests",
    label: "Page Requests",
    shortLabel: "Pages",
    icon: FileText,
    accentClass: "group-hover:text-blue-400",
    linkClass: "hover:bg-blue-950/20 hover:text-blue-400",
    chevronClass: "text-blue-500",
  },
  {
    href: "/admin/services",
    label: "Services",
    shortLabel: "Services",
    icon: Settings,
    accentClass: "group-hover:text-[#1DB954]",
  },
  {
    href: "/admin/customers",
    label: "Customers",
    shortLabel: "Clients",
    icon: Users,
    accentClass: "group-hover:text-[#1DB954]",
  },
  {
    href: "/admin/topups",
    label: "Wallet Top-Ups",
    shortLabel: "Top-Ups",
    icon: Wallet,
    accentClass: "group-hover:text-[#1DB954]",
    linkClass: "hover:bg-emerald-950/20 hover:text-[#1DB954]",
    chevronClass: "text-[#1DB954]",
  },
  {
    href: "/admin/vip",
    label: "VIP Subscriptions",
    shortLabel: "VIP",
    icon: Crown,
    accentClass: "group-hover:text-[#1DB954]",
    linkClass: "hover:bg-slate-900/30 hover:text-[#1DB954]",
    chevronClass: "text-[#1DB954]",
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email?.endsWith("@boostsocial.com")) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#121212] text-slate-300 lg:flex">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-800/80 bg-[#121212]/95 px-4 py-3 backdrop-blur-md lg:hidden">
        <Link href="/admin" className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1DB954] text-sm font-black text-black">
            C
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black uppercase tracking-tight text-white">
              CYNETWORK
            </span>
            <span className="block truncate text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
              Admin Android App
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle compact />
          <form action="/auth/signout" method="post">
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800/80 bg-[#181818]/80 text-slate-400 transition-all duration-300 hover:border-red-500/40 hover:text-red-400"
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </header>

      {/* Spotify Deep Matte Black Sidebar */}
      <aside className="fixed z-20 hidden h-full w-64 flex-col border-r border-slate-850/80 bg-[#181818]/95 text-slate-400 backdrop-blur-md lg:flex">
        <div className="p-6 pb-4 border-b border-slate-850/60">
          <Link href="/" className="text-xl font-black text-white tracking-tight flex items-center gap-2 group">
            <span className="bg-[#1DB954] text-black w-7 h-7 rounded-full flex items-center justify-center font-black text-sm group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">C</span>
            <span className="flex items-center">
              {"CYNETWORK".split("").map((letter, idx) => (
                <span
                  key={idx}
                  className="inline-block transition-all duration-300 transform hover:scale-130 hover:text-[#1DB954] hover:-translate-y-0.5 cursor-default select-none font-black text-white"
                  style={{
                    transitionDelay: `${idx * 15}ms`
                  }}
                >
                  {letter}
                </span>
              ))}
            </span>
          </Link>
          <div className="text-[9px] mt-1.5 text-slate-500 font-extrabold uppercase tracking-widest pl-1">Admin Control Panel</div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5 mt-6">
          {adminNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between rounded-xl px-4 py-3 text-slate-350 transition-all duration-300 hover:bg-slate-800/40 hover:text-white ${item.linkClass ?? ""}`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={`text-slate-500 transition-colors ${item.accentClass}`} />
                  <span className="font-semibold text-xs uppercase tracking-wider">{item.label}</span>
                </div>
                <ChevronRight
                  size={12}
                  className={`-translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 ${item.chevronClass ?? "text-slate-550"}`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-850/60 space-y-1">
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-red-950/20 text-slate-400 hover:text-red-400 transition-all duration-300 text-left cursor-pointer group">
              <LogOut size={18} className="text-slate-500 group-hover:text-red-400 transition-colors" />
              <span className="font-semibold text-xs uppercase tracking-wider">Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="relative min-h-screen flex-grow overflow-hidden px-4 py-5 pb-28 sm:px-6 lg:ml-64 lg:p-8">
        {/* Soft decorative background glows */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full spotify-glow-blob pointer-events-none opacity-40"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full spotify-glow-blob pointer-events-none opacity-20"></div>
        
        <div className="relative z-10">
          {children}
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-800/80 bg-[#121212]/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-md lg:hidden">
        <div className="flex gap-1 overflow-x-auto">
          {adminNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-w-[4.7rem] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-slate-400 transition-all hover:bg-slate-800/60 hover:text-white"
              >
                <Icon size={18} className="text-[#1DB954]" />
                <span className="text-[9px] font-black uppercase tracking-wide">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
