import Link from "next/link";
import { LayoutDashboard, ShoppingCart, Settings, Users, LogOut, Wallet, FileText, ChevronRight } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-[#121212] text-slate-300 flex">
      {/* Spotify Deep Matte Black Sidebar */}
      <aside className="w-64 bg-[#181818]/95 border-r border-slate-850/80 backdrop-blur-md text-slate-400 flex flex-col fixed h-full z-10">
        <div className="p-6 pb-4 border-b border-slate-850/60">
          <Link href="/" className="text-xl font-black text-white tracking-tight flex items-center gap-2 group">
            <span className="bg-[#1DB954] text-black w-7 h-7 rounded-full flex items-center justify-center font-black text-sm group-hover:scale-105 transition-transform">B</span>
            BoostSocial
          </Link>
          <div className="text-[9px] mt-1.5 text-slate-500 font-extrabold uppercase tracking-widest pl-1">Admin Control Panel</div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1.5 mt-6">
          <Link 
            href="/admin" 
            className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-800/40 text-slate-350 hover:text-white transition-all duration-300 group"
          >
            <div className="flex items-center gap-3">
              <LayoutDashboard size={18} className="text-slate-500 group-hover:text-[#1DB954] transition-colors" />
              <span className="font-semibold text-xs uppercase tracking-wider">Overview</span>
            </div>
            <ChevronRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-slate-550" />
          </Link>

          <Link 
            href="/admin/orders" 
            className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-800/40 text-slate-350 hover:text-white transition-all duration-300 group"
          >
            <div className="flex items-center gap-3">
              <ShoppingCart size={18} className="text-slate-500 group-hover:text-[#1DB954] transition-colors" />
              <span className="font-semibold text-xs uppercase tracking-wider">Orders</span>
            </div>
            <ChevronRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-slate-550" />
          </Link>

          <Link 
            href="/admin/page-requests" 
            className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-blue-950/20 text-slate-350 hover:text-blue-400 transition-all duration-300 group"
          >
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-blue-500/60 group-hover:text-blue-400 transition-colors" />
              <span className="font-semibold text-xs uppercase tracking-wider text-slate-350 group-hover:text-blue-400">Page Requests</span>
            </div>
            <ChevronRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-blue-500" />
          </Link>

          <Link 
            href="/admin/services" 
            className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-800/40 text-slate-350 hover:text-white transition-all duration-300 group"
          >
            <div className="flex items-center gap-3">
              <Settings size={18} className="text-slate-500 group-hover:text-[#1DB954] transition-colors" />
              <span className="font-semibold text-xs uppercase tracking-wider">Services</span>
            </div>
            <ChevronRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-slate-550" />
          </Link>

          <Link 
            href="/admin/customers" 
            className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-800/40 text-slate-350 hover:text-white transition-all duration-300 group"
          >
            <div className="flex items-center gap-3">
              <Users size={18} className="text-slate-500 group-hover:text-[#1DB954] transition-colors" />
              <span className="font-semibold text-xs uppercase tracking-wider">Customers</span>
            </div>
            <ChevronRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-slate-550" />
          </Link>

          <Link 
            href="/admin/topups" 
            className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-emerald-950/20 text-slate-350 hover:text-[#1DB954] transition-all duration-300 group"
          >
            <div className="flex items-center gap-3">
              <Wallet size={18} className="text-[#1DB954]/60 group-hover:text-[#1DB954] transition-colors" />
              <span className="font-semibold text-xs uppercase tracking-wider text-slate-350 group-hover:text-[#1DB954]">Wallet Top-Ups</span>
            </div>
            <ChevronRight size={12} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-[#1DB954]" />
          </Link>
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
      <main className="flex-grow ml-64 p-8 min-h-screen relative overflow-hidden">
        {/* Soft decorative background glows */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full spotify-glow-blob pointer-events-none opacity-40"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full spotify-glow-blob pointer-events-none opacity-20"></div>
        
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
