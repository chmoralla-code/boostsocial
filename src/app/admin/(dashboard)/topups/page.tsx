import { fallbackRead } from "@/utils/supabase/dual-db";
import { TopupsList } from "./TopupsList";
import { Wallet } from "lucide-react";

export const revalidate = 0;

export default async function TopupsPage() {
  const { data: topups } = await fallbackRead(async (db) => {
    return db
      .from("topups")
      .select("id,user_id,email,amount,receipt_url,receipt_data,status,created_at,reviewed_at,reviewed_by")
      .order("created_at", { ascending: false })
      .limit(100);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-slate-300">
      <div className="flex items-center gap-3 border-b border-slate-850/60 pb-6">
        <div className="bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 p-2.5 rounded-xl shadow-sm">
          <Wallet size={20} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Wallet Top-Ups</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Audit proof-of-payment receipts, approve manual GCash top-ups, or reject incorrect deposits.</p>
        </div>
      </div>
      <TopupsList initialTopups={topups || []} />
    </div>
  );
}
