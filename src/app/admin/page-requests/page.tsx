import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { OrdersTable } from "../orders/OrdersTable";

export default async function PageRequestsDashboard() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      services ( title )
    `)
    .ilike('target_url', '%Page Wants:%')
    .order('created_at', { ascending: false });

  // Use service role client to list receipts to bypass RLS/anon limitations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const serviceSupabase = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });

  const { data: files } = await serviceSupabase.storage.from('receipts').list();
  const receiptFiles = files?.map(f => f.name) || [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-blue-100 text-blue-600 p-2.5 rounded-xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Page Creation Requests</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Review and fulfill custom Facebook Page orders.</p>
        </div>
      </div>
      
      <OrdersTable initialOrders={orders || []} receiptFiles={receiptFiles} />
    </div>
  );
}
