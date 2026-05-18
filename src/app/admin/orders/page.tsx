import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { OrdersTable } from "./OrdersTable";

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from('orders')
    .select(`
      *,
      services ( title )
    `)
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
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Order Management</h1>
      <OrdersTable initialOrders={orders || []} receiptFiles={receiptFiles} />
    </div>
  );
}
