import { createClient } from "@/utils/supabase/server";
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

  // Fetch the list of GCash receipt screenshot files from storage
  const { data: files } = await supabase.storage.from('receipts').list();
  const receiptFiles = files?.map(f => f.name) || [];

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Order Management</h1>
      <OrdersTable initialOrders={orders || []} receiptFiles={receiptFiles} />
    </div>
  );
}
