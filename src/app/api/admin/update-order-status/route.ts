import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { sendOrderCompleteNotification } from "@/lib/telegram";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { creditReferralCommission } from "@/utils/referrals";

export async function POST(req: NextRequest) {
  try {
    const { orderId, newStatus } = await req.json();

    if (!orderId || !newStatus) {
      return NextResponse.json({ error: "Missing orderId or newStatus" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Fetch current order details (including customer email, amount, payment method, and joined service title)
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select(`
        status, 
        service_id, 
        target_url, 
        quantity, 
        external_order_id,
        customer_email,
        amount,
        payment_method,
        services (
          title
        )
      `)
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 2. Update order status in the database
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (updateError) throw updateError;

    await syncBackupAdminClients(async (backupClient) => {
      return backupClient
        .from("orders")
        .update({ status: newStatus })
        .eq("id", orderId);
    }, "admin order status sync");

    // 3. Trigger automated RixeySMM placement if:
    // - Order status is updated to 'Processing'
    // - Order does not already have an external order placed
    if (newStatus === "Processing" || newStatus === "Completed") {
      creditReferralCommission({
        primaryClient: supabase,
        customerEmail: order.customer_email,
        source: "order",
        amount: Number(order.amount),
        referenceId: orderId,
      }).catch((err) => {
        console.error("Admin referral order commission failed:", err);
      });
    }

    if (newStatus === "Processing" && !order.external_order_id) {
      // autoPlaceRixeyOrder has its own guard to only run for the Followers service ID
      autoPlaceRixeyOrder(orderId, order.service_id, order.target_url, order.quantity).catch((err) => {
        console.error("Async auto-placement on RixeySMM from admin status update failed:", err);
      });
    }

    // 4. Fire Telegram completion notification if:
    // - Order status is updated to 'Completed'
    if (newStatus === "Completed") {
      const serviceTitle = (order as any).services?.title || "SMM Service";
      sendOrderCompleteNotification({
        trackingId: `BS-${orderId.slice(0, 8).toUpperCase()}`,
        service: serviceTitle,
        email: order.customer_email,
        quantity: order.quantity,
        amount: Number(order.amount),
        paymentMethod: order.payment_method || "GCash",
        details: order.target_url,
      }).catch((err) => {
        console.error("Async sendOrderCompleteNotification failed from admin update:", err);
      });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Update order status endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}

