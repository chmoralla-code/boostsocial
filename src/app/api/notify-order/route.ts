import { NextRequest, NextResponse } from "next/server";
import { sendOrderNotification } from "@/lib/telegram";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/utils/security/admin";
import { enforceRateLimit } from "@/utils/security/rate-limit";

const TRACKING_PATTERN = /^BS-([0-9a-f]{8})$/i;

function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Server configuration missing");
  }
  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

async function resolveOrderByTrackingPrefix(prefix: string) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, customer_email, quantity, amount, payment_method, target_url, services(title)")
    .gte("id", `${prefix}-0000-0000-0000-000000000000`)
    .lte("id", `${prefix}-ffff-ffff-ffff-ffffffffffff`)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "notify-order",
      maxRequests: 25,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const trackingId = String(body.trackingId || "").trim();
    const trackingMatch = trackingId.match(TRACKING_PATTERN);
    if (!trackingMatch) {
      return NextResponse.json({ error: "Invalid tracking ID." }, { status: 400 });
    }

    const order = await resolveOrderByTrackingPrefix(trackingMatch[1].toLowerCase());
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const requesterEmail = user.email.trim().toLowerCase();
    const orderEmail = String(order.customer_email || "").trim().toLowerCase();
    if (!isAdminEmail(requesterEmail) && requesterEmail !== orderEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceTitle = Array.isArray((order as any).services)
      ? (order as any).services[0]?.title
      : (order as any).services?.title;

    await sendOrderNotification({
      trackingId,
      service: serviceTitle || "SMM Service",
      email: orderEmail,
      quantity: Number(order.quantity || 0),
      amount: Number(order.amount || 0),
      paymentMethod: order.payment_method || "GCash",
      details: order.target_url || "",
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
