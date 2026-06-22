import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

const CRON_SECRET = process.env.CRON_SECRET;
const RETENTION_DAYS = 7;

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!CRON_SECRET) {
      return NextResponse.json({ error: "Cron secret is not configured." }, { status: 503 });
    }

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server credentials missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    const { data: oldOrders, error: fetchError } = await supabase
      .from("orders")
      .select("id")
      .in("status", ["Completed", "Cancelled", "Rejected"])
      .lt("created_at", cutoffDate.toISOString());

    if (fetchError) throw fetchError;

    if (!oldOrders || oldOrders.length === 0) {
      // Still check topups even if no orders to clean
      let topupsDeleted = 0;
      try {
        const { data: oldTopups } = await supabase
          .from("topups")
          .select("id")
          .in("status", ["Approved", "Rejected", "Cancelled"])
          .lt("created_at", cutoffDate.toISOString());
        if (oldTopups && oldTopups.length > 0) {
          const topupIds = oldTopups.map((t) => t.id);
          await supabase.from("topups").delete().in("id", topupIds);
          topupsDeleted = topupIds.length;
          await syncBackupAdminClients(async (backupClient) => {
            return backupClient.from("topups").delete().in("id", topupIds);
          }, "cron cleanup old topups");
        }
      } catch (topupErr) {
        console.warn("Topups cleanup failed:", topupErr);
      }
      return NextResponse.json({
        success: true,
        deleted: 0,
        topupsDeleted,
        message: topupsDeleted > 0
          ? `No old orders. Deleted ${topupsDeleted} topups older than ${RETENTION_DAYS} days.`
          : `No orders or topups older than ${RETENTION_DAYS} days to clean up.`,
      });
    }

    const orderIds = oldOrders.map((o) => o.id);

    try {
      const { data: files } = await supabase.storage.from("receipts").list();
      if (files && files.length > 0) {
        const filesToDelete = files
          .map((f) => f.name)
          .filter((name) => orderIds.some((id) => name.startsWith(id)));
        if (filesToDelete.length > 0) {
          await supabase.storage.from("receipts").remove(filesToDelete);
        }
      }
    } catch (storageErr) {
      console.warn("Receipt cleanup warning:", storageErr);
    }

    const { error: deleteError } = await supabase
      .from("orders")
      .delete()
      .in("id", orderIds);

    if (deleteError) throw deleteError;

    await syncBackupAdminClients(async (backupClient) => {
      return backupClient.from("orders").delete().in("id", orderIds);
    }, "cron cleanup old orders");

    // Also cleanup old topups with Approved/Rejected status
    let topupsDeleted = 0;
    try {
      const { data: oldTopups } = await supabase
        .from("topups")
        .select("id")
        .in("status", ["Approved", "Rejected", "Cancelled"])
        .lt("created_at", cutoffDate.toISOString());

      if (oldTopups && oldTopups.length > 0) {
        const topupIds = oldTopups.map((t) => t.id);
        const { error: topupDeleteErr } = await supabase
          .from("topups")
          .delete()
          .in("id", topupIds);
        if (topupDeleteErr) {
          console.warn("Topups cleanup warning:", topupDeleteErr);
        } else {
          topupsDeleted = topupIds.length;
          await syncBackupAdminClients(async (backupClient) => {
            return backupClient.from("topups").delete().in("id", topupIds);
          }, "cron cleanup old topups");
        }
      }
    } catch (topupErr) {
      console.warn("Topups cleanup failed:", topupErr);
    }

    return NextResponse.json({
      success: true,
      deleted: orderIds.length,
      topupsDeleted,
      message: `Deleted ${orderIds.length} orders${topupsDeleted > 0 ? ` and ${topupsDeleted} topups` : ""} older than ${RETENTION_DAYS} days.`,
    });
  } catch (err: unknown) {
    console.error("Cron cleanup failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
