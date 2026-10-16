import { NextRequest, NextResponse } from "next/server";
import { fallbackRead } from "@/utils/supabase/dual-db";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { parseTrackingInput, toSafeTrackedOrder } from "@/lib/orderTracking";

export const dynamic = "force-dynamic";

/**
 * Public order tracking.
 *
 * Guest tracking is a real product feature - a customer keeps their tracking ID
 * and checks progress without signing in - so this route stays open. What it
 * does NOT do is hand out credentials: any password stored in `target_url` is
 * masked before the response leaves the server, and the customer's email is
 * never returned.
 *
 * Runs server-side with the service key so it keeps working now that Row Level
 * Security is enabled on `orders`.
 *
 * Reads through `fallbackRead` so the master database is tried first. Reading
 * the Supabase mirror alone left orders that only exist on the master
 * untrackable - 56 of them at the time this was found.
 */
export async function GET(req: NextRequest) {
  const limited = enforceRateLimit(req, {
    key: "orders-track",
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const parsed = parseTrackingInput(req.nextUrl.searchParams.get("id") || "");
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid Tracking ID format. It should look like BS-D5D1D849." },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await fallbackRead<Parameters<typeof toSafeTrackedOrder>[0]>(
      async (client) => {
        let query = client
          .from("orders")
          .select(
            "id,status,quantity,amount,created_at,target_url,service_title,customer_email,services(title)"
          );

        if (parsed.kind === "uuid") {
          query = query.eq("id", parsed.value);
        } else {
          query = query
            .gte("id", `${parsed.value}-0000-0000-0000-000000000000`)
            .lte("id", `${parsed.value}-ffff-ffff-ffff-ffffffffffff`);
        }

        return await query.limit(1).maybeSingle();
      }
    );

    if (error) {
      console.error("Track order lookup failed:", error.message || error);
      return NextResponse.json({ error: "Order lookup failed. Please try again." }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Order not found. Please double check your Tracking ID." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { order: toSafeTrackedOrder(data) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("Track order error:", err);
    return NextResponse.json({ error: "Order lookup failed. Please try again." }, { status: 500 });
  }
}
