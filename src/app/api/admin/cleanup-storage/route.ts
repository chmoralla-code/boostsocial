import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server credentials missing" }, { status: 500 });
    }

    // Initialize administrative client with Service Role privileges
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Fetch completed or cancelled orders older than 3 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 3); // 3 days buffer

    const { data: finalizedOrders, error: dbError } = await supabase
      .from("orders")
      .select("id, target_url")
      .in("status", ["Completed", "Cancelled", "Rejected"])
      .lt("created_at", cutoffDate.toISOString());

    if (dbError) throw dbError;

    if (!finalizedOrders || finalizedOrders.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "No older completed or cancelled orders found to optimize." });
    }

    const orderIds = finalizedOrders.map(o => o.id);

    // 2. List all files inside the receipts bucket
    const { data: files, error: listError } = await supabase.storage
      .from("receipts")
      .list();

    if (listError) throw listError;

    if (!files || files.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "Storage is already optimized!" });
    }

    // 3. Filter files that are associated with any of our finalized orders
    const filesToDelete = files
      .map(f => f.name)
      .filter(fileName => {
        return orderIds.some(orderId => fileName.startsWith(orderId));
      });

    if (filesToDelete.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "Outdated files are already clean!" });
    }

    // 4. Batch delete files from Supabase Storage bucket
    const { error: deleteError } = await supabase.storage
      .from("receipts")
      .remove(filesToDelete);

    if (deleteError) throw deleteError;

    // 5. Update database rows to replace local paths or note optimization inside notes/target_url if needed
    // (This acts as a clean indicator for the user that the images have been optimized to save storage)
    for (const order of finalizedOrders) {
      if (order.target_url && order.target_url.includes("Page Wants:")) {
        // Replace absolute image URLs with [Optimized to Save Space]
        const cleanUrl = order.target_url
          .replace(/\[Profile Pic: [^\]]+\]/, "[Profile Pic: Optimized / Deleted]")
          .replace(/\[Cover Pic: [^\]]+\]/, "[Cover Pic: Optimized / Deleted]");
        
        await supabase
          .from("orders")
          .update({ target_url: cleanUrl })
          .eq("id", order.id);

        await syncBackupAdminClients(async (backupClient) => {
          return backupClient
            .from("orders")
            .update({ target_url: cleanUrl })
            .eq("id", order.id);
        }, "storage cleanup order sync");
      }
    }

    return NextResponse.json({
      success: true,
      count: filesToDelete.length,
      message: `Successfully purged ${filesToDelete.length} files from Supabase Storage to reclaim space!`
    });
  } catch (err: any) {
    console.error("Storage clean-up failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
