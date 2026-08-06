import { fallbackRead, ensureFeatureSchema } from "@/utils/supabase/dual-db";
import { PromoCodesPanel } from "./PromoCodesPanel";

type PromoRow = {
  id: string;
  code: string;
  discount_percent: number | string | null;
  discount_amount: number | string | null;
  max_uses: number | null;
  used_count: number | null;
  min_order_amount: number | string | null;
  applies_to: string | null;
  expires_at: string | null;
  active: boolean | null;
  created_at: string | null;
};

export const dynamic = "force-dynamic";

export default async function AdminPromosPage() {
  // Ensure promo_codes exists on DO primary + backups (idempotent).
  await ensureFeatureSchema();

  const { data } = await fallbackRead(async (db) => {
    return db
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });
  });

  const promos = (data || []) as PromoRow[];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-slate-300">
      <div className="flex flex-col gap-2 border-b border-slate-850/60 pb-5">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">Marketing</span>
        <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Promo Codes</h1>
        <p className="max-w-2xl text-xs font-semibold leading-relaxed text-slate-400">
          Create discount codes customers can apply at checkout. Percent or fixed amount,
          optional usage limits, expiry, and per-service scoping.
        </p>
      </div>

      <PromoCodesPanel initialPromos={promos} />
    </div>
  );
}
