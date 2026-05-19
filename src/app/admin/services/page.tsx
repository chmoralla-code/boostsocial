import { createClient } from "@/utils/supabase/server";
import { ServicesTable } from "./ServicesTable";
import { Settings } from "lucide-react";

export default async function ServicesPage() {
  const supabase = await createClient();

  const { data: services } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-slate-300">
      <div className="flex items-center gap-3 border-b border-slate-850/60 pb-6">
        <div className="bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 p-2.5 rounded-xl shadow-sm">
          <Settings size={20} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Service Catalog</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Configure service tiers, pricing, delivery descriptions, and custom forms.</p>
        </div>
      </div>
      <ServicesTable initialServices={services || []} />
    </div>
  );
}
