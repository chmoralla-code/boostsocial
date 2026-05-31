import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderNotification } from "@/lib/telegram";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { creditReferralCommission } from "@/utils/referrals";

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "checkout-wallet",
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user: sessionUser },
    } = await sessionClient.auth.getUser();
    if (!sessionUser?.id || !sessionUser.email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const {
      existingOrderId,
      userId,
      serviceId,
      email,
      url,
      quantity,
      totalPrice,
      serviceTitle,
      smmServiceId
    } = await req.json();

    if (!userId || !serviceId || !email || !url || !quantity || totalPrice === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (userId !== sessionUser.id || String(email).trim().toLowerCase() !== sessionUser.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Wallet identity mismatch." }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    if (existingOrderId) {
      const { data: pendingOrder, error: pendingOrderError } = await supabase
        .from("orders")
        .select("id, customer_email, payment_method")
        .eq("id", existingOrderId)
        .single();

      if (pendingOrderError || !pendingOrder) {
        return NextResponse.json({ error: "Pending order was not found" }, { status: 404 });
      }

      if (String(pendingOrder.customer_email || "").trim().toLowerCase() !== String(email).trim().toLowerCase()) {
        return NextResponse.json({ error: "Wallet order email does not match the pending order" }, { status: 403 });
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;

    const currentBalance = Number(profile.balance || 0);
    const parsedTotal = Number(totalPrice);
    if (!Number.isFinite(parsedTotal) || parsedTotal <= 0) {
      return NextResponse.json({ error: "Invalid wallet checkout amount" }, { status: 400 });
    }

    const cost = Math.max(parsedTotal, 5.00);

    if (currentBalance < cost) {
      return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
    }

    const newBalance = currentBalance - cost;
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (updateProfileError) throw updateProfileError;

    let order: any = null;
    if (existingOrderId) {
      const { data: updatedOrder, error: updateOrderError } = await supabase
        .from("orders")
        .update({
          service_id: serviceId,
          customer_email: String(email).trim(),
          target_url: String(url).trim(),
          amount: cost,
          status: "Processing",
          payment_method: "Wallet",
          quantity,
          smm_service_id: smmServiceId || null
        })
        .eq("id", existingOrderId)
        .select("id")
        .single();

      if (updateOrderError) throw updateOrderError;
      order = updatedOrder;
    } else {
      const { data: insertedOrder, error: insertOrderError } = await supabase
        .from("orders")
        .insert([
          {
            service_id: serviceId,
            customer_email: String(email).trim(),
            target_url: String(url).trim(),
            amount: cost,
            status: "Processing",
            payment_method: "Wallet",
            quantity,
            smm_service_id: smmServiceId || null
          }
        ])
        .select("id")
        .single();

      if (insertOrderError) throw insertOrderError;
      order = insertedOrder;
    }

    await syncBackupAdminClients(async (backupClient) => {
      const profileUpdate = await backupClient
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", userId);

      if (profileUpdate.error) return profileUpdate;

      return backupClient
        .from("orders")
        .upsert({
          id: order.id,
          service_id: serviceId,
          customer_email: String(email).trim(),
          target_url: String(url).trim(),
          amount: cost,
          status: "Processing",
          payment_method: "Wallet",
          quantity,
          smm_service_id: smmServiceId || null
        });
    }, "wallet checkout sync");

    creditReferralCommission({
      primaryClient: supabase,
      customerId: userId,
      customerEmail: String(email).trim(),
      source: "order",
      amount: cost,
      referenceId: order.id,
    }).catch((err) => {
      console.error("Wallet referral order commission failed:", err);
    });

    autoPlaceRixeyOrder(order.id, serviceId, String(url).trim(), quantity).catch((err) => {
      console.error("Async auto-placement on RixeySMM from verified wallet checkout failed:", err);
    });

    sendOrderNotification({
      trackingId: `BS-${order.id.slice(0, 8).toUpperCase()}`,
      service: serviceTitle || serviceId,
      email: String(email).trim(),
      quantity,
      amount: cost,
      paymentMethod: "Wallet",
      details: String(url).trim(),
    });

    return NextResponse.json({ success: true, orderId: order.id, newBalance });
  } catch (err: any) {
    console.error("Wallet checkout endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
