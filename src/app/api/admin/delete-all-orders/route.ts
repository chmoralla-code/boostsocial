import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { status } = await req.json().catch(() => ({}));
    const targetStatus = status || null;

    const deleteQuery = targetStatus
      ? supabase.from("orders").delete().eq("status", targetStatus)
      : supabase.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    const { error: deleteOrdersError, count } = await deleteQuery;

    if (deleteOrdersError) throw deleteOrdersError;

    await syncBackupAdminClients(async (backupClient) => {
      const query = targetStatus
        ? backupClient.from("orders").delete().eq("status", targetStatus)
        : backupClient.from("orders").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      return query;
    }, `delete ${targetStatus || "all"} orders sync`);

    if (!targetStatus) {
      const { data: files } = await supabase.storage.from("receipts").list();
      if (files && files.length > 0) {
        const fileNames = files.map(f => f.name);
        await supabase.storage.from("receipts").remove(fileNames);
      }
    } else {
      const { data: allOrders } = await supabase
        .from("orders")
        .select("id");
      if (allOrders) {
        const remainingIds = new Set(allOrders.map((o: any) => o.id));
        const { data: files } = await supabase.storage.from("receipts").list();
        if (files && files.length > 0) {
          const staleReceipts = files
            .filter((f) => {
              const prefix = f.name.split("_")[0];
              return !remainingIds.has(prefix);
            })
            .map((f) => f.name);
          if (staleReceipts.length > 0) {
            await supabase.storage.from("receipts").remove(staleReceipts);
          }
        }
      }
    }

    return NextResponse.json({ success: true, deletedCount: count || 0 });
  } catch (err: any) {
    console.error("Delete orders endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
