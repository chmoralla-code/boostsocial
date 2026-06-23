import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

async function checkAdminAuth() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email?.endsWith("@boostsocial.com")) {
    return { authenticated: false as const, supabase: null as never };
  }
  return { authenticated: true as const, supabase };
}

async function deleteReceipts(supabase: SupabaseClient, orderIds: string[]): Promise<number> {
  if (orderIds.length === 0) return 0;
  try {
    const { data: files } = await supabase.storage.from("receipts").list();
    if (!files || files.length === 0) return 0;
    const toDelete = files.map((f) => f.name).filter((n) => orderIds.some((id) => n.startsWith(id)));
    if (toDelete.length === 0) return 0;
    await supabase.storage.from("receipts").remove(toDelete);
    return toDelete.length;
  } catch {
    return 0;
  }
}

async function deleteRows(supabase: SupabaseClient, table: string, ids: string[]) {
  if (ids.length === 0) return 0;
  const { error } = await supabase.from(table).delete().in("id", ids);
  if (error) throw error;
  await syncBackupAdminClients(async (bc) => bc.from(table).delete().in("id", ids), `cleanup-run ${table}`);
  return ids.length;
}

export async function POST(request: Request) {
  try {
    const auth = await checkAdminAuth();
    if (!auth.authenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server credentials missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    // Parse settings from request body or use defaults
    const body = await request.json().catch(() => ({}));
    const orderRetentionHours = body.order_retention_hours ?? 24;
    const topupRetentionHours = body.topup_retention_hours ?? 24;

    const now = new Date();
    const orderCutoff = new Date(now.getTime() - orderRetentionHours * 60 * 60 * 1000);
    const topupCutoff = new Date(now.getTime() - topupRetentionHours * 60 * 60 * 1000);

    const tally = { orders: 0, topups: 0, receipts: 0 };

    // 1. Delete completed orders older than retention
    const { data: oldOrders } = await supabase
      .from("orders")
      .select("id")
      .in("status", ["Completed", "Cancelled", "Rejected"])
      .lt("created_at", orderCutoff.toISOString());

    const orderIds = (oldOrders || []).map((o) => o.id);
    tally.receipts += await deleteReceipts(supabase, orderIds);
    tally.orders += await deleteRows(supabase, "orders", orderIds);

    // 2. Delete approved topups older than retention
    const { data: oldTopups } = await supabase
      .from("topups")
      .select("id")
      .in("status", ["approved", "rejected", "Approved", "Rejected"])
      .lt("created_at", topupCutoff.toISOString());

    const topupIds = (oldTopups || []).map((t) => t.id);
    tally.topups += await deleteRows(supabase, "topups", topupIds);

    const total = tally.orders + tally.topups;
    const parts: string[] = [];
    if (tally.orders > 0) parts.push(`${tally.orders} completed orders`);
    if (tally.topups > 0) parts.push(`${tally.topups} processed top-ups`);
    if (tally.receipts > 0) parts.push(`${tally.receipts} receipt files`);

    return NextResponse.json({
      success: true,
      tally,
      message: total > 0
        ? `Cleaned up ${parts.join(", ")}.`
        : `No records older than the retention period to clean up.`,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
