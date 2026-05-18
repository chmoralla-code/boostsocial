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

  return (
    <div>
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Order Management</h1>
      <OrdersTable initialOrders={orders || []} />
    </div>
  );
}
