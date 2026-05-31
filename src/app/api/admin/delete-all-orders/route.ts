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

    // Delete all records in orders
    const { error: deleteOrdersError } = await supabase
      .from("orders")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // deletes all rows safely

    if (deleteOrdersError) throw deleteOrdersError;

    await syncBackupAdminClients(async (backupClient) => {
      return backupClient
        .from("orders")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
    }, "delete all orders sync");

    // Delete all receipts from 'receipts' bucket
    const { data: files } = await supabase.storage.from("receipts").list();
    if (files && files.length > 0) {
      const fileNames = files.map(f => f.name);
      await supabase.storage.from("receipts").remove(fileNames);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete all orders endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
