import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { OrdersTable } from "./OrdersTable";
import { ShoppingBag } from "lucide-react";

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
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center border-b border-slate-850/60 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#1DB954]/10 text-[#1DB954] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider border border-[#1DB954]/20 flex items-center gap-1">
              <ShoppingBag size={10} /> Active Database
            </span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mt-2">
            Order Logs & Verification
          </h1>
          <p className="text-xs text-slate-400 font-semibold mt-1">
            Track user purchases, audit payment receipts, and manage SMM service progression.
          </p>
        </div>
      </div>
      
      <OrdersTable initialOrders={orders || []} receiptFiles={receiptFiles} />
    </div>
  );
}

