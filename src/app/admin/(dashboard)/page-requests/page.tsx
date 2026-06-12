import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { OrdersTable } from "../orders/OrdersTable";
import { enrichOrdersWithResolvedServiceTitles } from "@/lib/smmServiceResolver";

export default async function PageRequestsDashboard() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id,
      service_id,
      service_title,
      customer_email,
      target_url,
      status,
      amount,
      created_at,
      quantity,
      payment_method,
      external_order_id,
      external_status,
      smm_service_id,
      receipt_url,
      original_amount,
      vip_plan,
      vip_discount_percent,
      vip_discount_amount,
      services ( title )
    `)
    .ilike('target_url', '%Page Wants:%')
    .order('created_at', { ascending: false })
    .limit(200);

  // Use service role client to list receipts to bypass RLS/anon limitations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const serviceSupabase = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data: files } = await serviceSupabase.storage.from('receipts').list();
  const receiptFiles = files?.map(f => f.name) || [];
  const enrichedOrders = await enrichOrdersWithResolvedServiceTitles(orders || []);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 text-slate-300">
      <div className="flex items-center gap-3 border-b border-slate-850/60 pb-6">
        <div className="bg-blue-500/10 text-blue-400 border border-blue-500/25 p-2.5 rounded-xl shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Page Creation Requests</h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">Review and fulfill custom Facebook Page orders.</p>
        </div>
      </div>
      
      <OrdersTable initialOrders={enrichedOrders} receiptFiles={receiptFiles} />
    </div>
  );
}
