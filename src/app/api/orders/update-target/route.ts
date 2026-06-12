import { NextRequest, NextResponse } from "next/server";
import { getPrimaryAdminClient, syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/utils/security/admin";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";

const MAX_TARGET_LENGTH = 7000;

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "orders-update-target",
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const { orderId, targetUrl, customerEmail } = await req.json();
    const cleanOrderId = clean(orderId);
    const cleanTargetUrl = clean(targetUrl);
    const cleanEmail = clean(customerEmail).toLowerCase();

    if (!cleanOrderId || !cleanTargetUrl) {
      return NextResponse.json({ error: "Missing order ID or target details." }, { status: 400 });
    }

    if (cleanTargetUrl.length > MAX_TARGET_LENGTH) {
      return NextResponse.json({ error: "Order details are too long." }, { status: 400 });
    }

    const supabase = getPrimaryAdminClient();
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, customer_email, service_id, quantity, status, external_order_id, smm_service_id")
      .eq("id", cleanOrderId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const orderEmail = String(order.customer_email || "").trim().toLowerCase();
    const requesterEmail = user.email.trim().toLowerCase();
    const requesterIsAdmin = isAdminEmail(requesterEmail);

    if (!requesterIsAdmin && requesterEmail !== orderEmail) {
      return NextResponse.json({ error: "You can only edit your own order details." }, { status: 403 });
    }

    if (cleanEmail && orderEmail !== cleanEmail) {
      return NextResponse.json({ error: "Order email does not match." }, { status: 403 });
    }

    const update = { target_url: cleanTargetUrl };
    const { error: updateError } = await supabase
      .from("orders")
      .update(update)
      .eq("id", cleanOrderId);

    if (updateError) {
      throw updateError;
    }

    await syncBackupAdminClients(async (backupClient) => {
      return backupClient
        .from("orders")
        .update(update)
        .eq("id", cleanOrderId);
    }, "order target details sync");

    if (order.status === "Processing" && !order.external_order_id && order.smm_service_id) {
      autoPlaceRixeyOrder(cleanOrderId, order.service_id, cleanTargetUrl, Number(order.quantity || 0)).catch((err) => {
        console.error("Async auto-placement after target update failed:", err);
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Update order target endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
