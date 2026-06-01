import { createClient } from "@/utils/supabase/server";
import { VipSubscriptionsList } from "./VipSubscriptionsList";
import { Crown } from "lucide-react";

export const revalidate = 0;

export default async function VipSubscriptionsPage() {
  const supabase = await createClient();
  const { data: vipSubscriptions } = await supabase
    .from("vip_subscriptions")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-slate-300">
      <div className="flex items-center gap-3 border-b border-slate-850/60 pb-6">
        <div className="bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/25 p-2.5 rounded-xl shadow-sm">
          <Crown size={20} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">VIP Membership Queue</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Review GCash proof-of-payment and approve or reject VIP subscription requests.</p>
        </div>
      </div>
      <VipSubscriptionsList initialVipSubscriptions={vipSubscriptions || []} />
    </div>
  );
}
