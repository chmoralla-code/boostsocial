import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

const CRON_SECRET = process.env.CRON_SECRET;
const DEFAULT_ORDER_RETENTION_HOURS = 24;
const DEFAULT_TOPUP_RETENTION_HOURS = 24;
const ABANDONED_PENDING_DAYS = 30;

const SETTINGS_KEY = "auto_cleanup";

type DeletedTally = {
  orders: number;
  abandonedPendingOrders: number;
  topups: number;
  abandonedPendingTopups: number;
  vipSubscriptions: number;
  receipts: number;
};

type AdminClient = SupabaseClient<any, "public", any>;

async function loadCleanupSettings(supabase: AdminClient) {
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .single();
    const config = data?.value || {};
    return {
      enabled: config.auto_cleanup_enabled === true,
      orderRetentionHours: typeof config.order_retention_hours === "number"
        ? config.order_retention_hours
        : DEFAULT_ORDER_RETENTION_HOURS,
      topupRetentionHours: typeof config.topup_retention_hours === "number"
        ? config.topup_retention_hours
        : DEFAULT_TOPUP_RETENTION_HOURS,
    };
  } catch {
    // If settings can't be loaded, run with defaults
    return {
      enabled: true,
      orderRetentionHours: DEFAULT_ORDER_RETENTION_HOURS,
      topupRetentionHours: DEFAULT_TOPUP_RETENTION_HOURS,
    };
  }
}

async function deleteReceiptsForOrders(supabase: AdminClient, orderIds: string[]): Promise<number> {
  if (orderIds.length === 0) return 0;
  try {
    const { data: files } = await supabase.storage.from("receipts").list();
    if (!files || files.length === 0) return 0;
    const filesToDelete = files
      .map((f) => f.name)
      .filter((name) => orderIds.some((id) => name.startsWith(id)));
    if (filesToDelete.length === 0) return 0;
    await supabase.storage.from("receipts").remove(filesToDelete);
    return filesToDelete.length;
  } catch (storageErr) {
    console.warn("Receipt cleanup warning:", storageErr);
    return 0;
  }
}

async function deleteRowsAndSync(
  supabase: AdminClient,
  table: string,
  ids: string[]
): Promise<number> {
  if (ids.length === 0) return 0;
  const { error } = await supabase.from(table).delete().in("id", ids);
  if (error) throw error;

  await syncBackupAdminClients(async (backupClient) => {
    return backupClient.from(table).delete().in("id", ids);
  }, `cron cleanup ${table}`);

  return ids.length;
}

export async function GET(request: Request) {
  try {
    if (!CRON_SECRET) {
      console.error("Cron cleanup skipped: CRON_SECRET env var is not set on the server.");
      return NextResponse.json(
        { error: "Cron secret is not configured. Set CRON_SECRET in Vercel env vars to enable automatic cleanup." },
        { status: 503 }
      );
    }

    const authHeader = request.headers.get("authorization");
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

    const settings = await loadCleanupSettings(supabase);

    if (!settings.enabled) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: "Auto-cleanup is disabled in admin settings. Skipping scheduled cleanup.",
        tally: {
          orders: 0,
          abandonedPendingOrders: 0,
          topups: 0,
          abandonedPendingTopups: 0,
          vipSubscriptions: 0,
          receipts: 0,
        },
      });
    }

    const now = new Date();
    const orderCutoff = new Date(now.getTime() - settings.orderRetentionHours * 60 * 60 * 1000);
    const topupCutoff = new Date(now.getTime() - settings.topupRetentionHours * 60 * 60 * 1000);

    const abandonedCutoffDate = new Date();
    abandonedCutoffDate.setDate(abandonedCutoffDate.getDate() - ABANDONED_PENDING_DAYS);

    const tally: DeletedTally = {
      orders: 0,
      abandonedPendingOrders: 0,
      topups: 0,
      abandonedPendingTopups: 0,
      vipSubscriptions: 0,
      receipts: 0,
    };

    // 1. Completed / Cancelled / Rejected orders older than configured retention
    const { data: oldOrders, error: fetchError } = await supabase
      .from("orders")
      .select("id")
      .in("status", ["Completed", "Cancelled", "Rejected"])
      .lt("created_at", orderCutoff.toISOString());

    if (fetchError) throw fetchError;

    const orderIds = (oldOrders || []).map((o) => o.id);
    tally.receipts += await deleteReceiptsForOrders(supabase, orderIds);
    tally.orders += await deleteRowsAndSync(supabase, "orders", orderIds);

    // 2. Abandoned pending orders older than ABANDONED_PENDING_DAYS
    const { data: abandonedOrders, error: abandonedOrdersError } = await supabase
      .from("orders")
      .select("id")
      .eq("status", "Pending")
      .or(`receipt_url.is.null,receipt_url.eq.`)
      .lt("created_at", abandonedCutoffDate.toISOString());

    if (abandonedOrdersError) throw abandonedOrdersError;

    const abandonedOrderIds = (abandonedOrders || []).map((o) => o.id);
    tally.receipts += await deleteReceiptsForOrders(supabase, abandonedOrderIds);
    tally.abandonedPendingOrders += await deleteRowsAndSync(supabase, "orders", abandonedOrderIds);

    // 3. Approved / Rejected topups older than configured retention
    const { data: oldTopups, error: topupsError } = await supabase
      .from("topups")
      .select("id")
      .in("status", ["approved", "rejected", "Approved", "Rejected"])
      .lt("created_at", topupCutoff.toISOString());

    if (topupsError) throw topupsError;

    const topupIds = (oldTopups || []).map((t) => t.id);
    tally.topups += await deleteRowsAndSync(supabase, "topups", topupIds);

    // 4. Abandoned pending topups older than ABANDONED_PENDING_DAYS
    const { data: abandonedTopups, error: abandonedTopupsError } = await supabase
      .from("topups")
      .select("id")
      .eq("status", "pending")
      .lt("created_at", abandonedCutoffDate.toISOString());

    if (abandonedTopupsError) throw abandonedTopupsError;

    const abandonedTopupIds = (abandonedTopups || []).map((t) => t.id);
    tally.abandonedPendingTopups += await deleteRowsAndSync(supabase, "topups", abandonedTopupIds);

    // 5. Approved / Rejected VIP subscriptions older than configured retention
    const { data: oldVipSubs, error: vipSubsError } = await supabase
      .from("vip_subscriptions")
      .select("id")
      .in("status", ["approved", "rejected", "Approved", "Rejected"])
      .lt("created_at", orderCutoff.toISOString());

    if (vipSubsError) {
      console.warn("VIP subscriptions cleanup skipped:", vipSubsError.message);
    } else {
      const vipSubIds = (oldVipSubs || []).map((v) => v.id);
      tally.vipSubscriptions += await deleteRowsAndSync(supabase, "vip_subscriptions", vipSubIds);
    }

    const totalDeleted = tally.orders + tally.abandonedPendingOrders + tally.topups + tally.abandonedPendingTopups + tally.vipSubscriptions;

    if (totalDeleted === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        tally,
        message: `No records older than the configured retention period to clean up (order: ${settings.orderRetentionHours}h, topup: ${settings.topupRetentionHours}h).`,
      });
    }

    return NextResponse.json({
      success: true,
      deleted: totalDeleted,
      tally,
      message: `Cleaned up ${totalDeleted} records: ${tally.orders} completed/cancelled orders, ${tally.abandonedPendingOrders} abandoned pending orders, ${tally.topups} processed topups, ${tally.abandonedPendingTopups} abandoned pending topups, ${tally.vipSubscriptions} VIP subscriptions. Removed ${tally.receipts} receipt files.`,
    });
  } catch (err: unknown) {
    console.error("Cron cleanup failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
