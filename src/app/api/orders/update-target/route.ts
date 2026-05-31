import { NextRequest, NextResponse } from "next/server";
import { getPrimaryAdminClient, syncBackupAdminClients } from "@/utils/supabase/dual-db";

const MAX_TARGET_LENGTH = 7000;

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export async function POST(req: NextRequest) {
  try {
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
      .select("id, customer_email")
      .eq("id", cleanOrderId)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (cleanEmail && String(order.customer_email || "").trim().toLowerCase() !== cleanEmail) {
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

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Update order target endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
