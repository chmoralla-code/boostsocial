import { NextResponse } from "next/server";
import { retryUnplacedOrders } from "@/lib/rixeysmm";

const CRON_SECRET = process.env.CRON_SECRET;
const RETRY_MIN_INTERVAL_MINUTES = 30;
// Each placement is a balance check plus an order call to the provider.
export const maxDuration = 60;

/**
 * Re-submits Processing orders that never reached the provider: stuck in
 * "Queued: ..." / "Failed: ..." states, or never attempted at all
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

    const result = await retryUnplacedOrders({ limit: 20, retryIntervalMinutes: RETRY_MIN_INTERVAL_MINUTES });

    return NextResponse.json({
      success: true,
      scanned: result.scanned,
      retried: result.attempted,
      retryIntervalMinutes: RETRY_MIN_INTERVAL_MINUTES,
    });
  } catch (err: unknown) {
    console.error("Queue retry cron failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
