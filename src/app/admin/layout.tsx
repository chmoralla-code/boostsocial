import Link from "next/link";
import { LayoutDashboard, ShoppingCart, Settings, Users, LogOut, Wallet } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col fixed h-full z-10">
        <div className="p-6">
          <Link href="/" className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            BoostSocial
          </Link>
          <div className="text-xs mt-1 text-slate-500 uppercase tracking-widest">Admin Panel</div>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          <Link href="/admin" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors">
            <LayoutDashboard size={20} />
            <span className="font-medium">Overview</span>
          </Link>
          <Link href="/admin/orders" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors">
            <ShoppingCart size={20} />
            <span className="font-medium">Orders</span>
          </Link>
          <Link href="/admin/services" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors">
            <Settings size={20} />
            <span className="font-medium">Services</span>
          </Link>
          <Link href="/admin/customers" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors">
            <Users size={20} />
            <span className="font-medium">Customers</span>
          </Link>
          <Link href="/admin/topups" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 hover:text-white transition-colors text-[#1DB954]">
            <Wallet size={20} />
            <span className="font-medium">Wallet Top-Ups</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <form action="/auth/signout" method="post">
            <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-slate-800 hover:text-white transition-colors text-left">
              <LogOut size={20} />
              <span className="font-medium">Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
