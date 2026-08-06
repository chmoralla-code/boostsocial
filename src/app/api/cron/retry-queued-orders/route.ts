import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";

const CRON_SECRET = process.env.CRON_SECRET;
const RETRY_MIN_INTERVAL_MINUTES = 30;

/**
 * Re-submits orders stuck in "Queued: ..." or "Failed: ..." provider states
 * (no external_order_id yet). Guards with last_attempt_at so a flapping
 * provider never hammers the API more than once per 30 minutes per order.
 */
export async function GET(request: Request) {
  try {
    if (!CRON_SECRET) {
      return NextResponse.json(
        { error: "Cron secret is not configured. Set CRON_SECRET in Vercel env vars." },
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

    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const retryCutoff = new Date(Date.now() - RETRY_MIN_INTERVAL_MINUTES * 60 * 1000).toISOString();

    // Processing orders with no external order id, in a queued/failed provider state,
    // that haven't been retried within the interval.
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, service_id, target_url, quantity")
      .eq("status", "Processing")
      .is("external_order_id", null)
      .or(`external_status.ilike.Queued:%,external_status.ilike.Failed:%`)
      .or(`last_attempt_at.is.null,last_attempt_at.lt.${retryCutoff}`);

    if (error) throw error;

    const rows = (orders || []) as Array<{
      id: string;
      service_id: string;
      target_url: string;
      quantity: number;
    }>;

    let retried = 0;
    const results = await Promise.allSettled(
      rows.map(async (order) => {
        await autoPlaceRixeyOrder(order.id, order.service_id, order.target_url, order.quantity);
        retried++;
      })
    );

    for (const result of results) {
      if (result.status === "rejected") {
        console.error("Queue retry failed for an order:", result.reason);
      }
    }

    return NextResponse.json({
      success: true,
      scanned: rows.length,
      retried,
      retryIntervalMinutes: RETRY_MIN_INTERVAL_MINUTES,
    });
  } catch (err: unknown) {
    console.error("Queue retry cron failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
