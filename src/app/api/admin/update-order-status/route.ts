import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { sendOrderCompleteNotification } from "@/lib/telegram";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { creditReferralCommission } from "@/utils/referrals";
import { resolveSmmServiceTitle } from "@/lib/smmServiceResolver";
import { notifyOrderStatusCustomer } from "@/lib/customerNotifications";
import { sendOrderApprovedEmail, sendOrderCompletedEmail } from "@/lib/approvalEmails";
import { recordOrderEvent } from "@/lib/orderEvents";
import { refundOrderToWallet } from "@/lib/orderRefund";

type JoinedService = { title?: string | null } | { title?: string | null }[] | null | undefined;

type AdminOrderRow = {
  status: string;
  service_id: string;
  target_url: string;
  quantity: number;
  external_order_id?: string | null;
  customer_email?: string | null;
  amount?: number | string | null;
  original_amount?: number | string | null;
  payment_method?: string | null;
  smm_service_id?: string | number | null;
  services?: JoinedService;
};

function getJoinedServiceTitle(services: JoinedService) {
  return Array.isArray(services) ? services[0]?.title : services?.title;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function mapStatusToEventType(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("process")) return "processing" as const;
  if (normalized.includes("complete")) return "completed" as const;
  if (normalized.includes("cancel")) return "cancelled" as const;
  if (normalized.includes("reject")) return "rejected" as const;
  if (normalized.includes("pending")) return "payment_pending" as const;
  return "processing" as const;
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, newStatus, refundAmount } = await req.json();

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
        original_amount,
        payment_method,
        smm_service_id,
        services (
          title
        )
      `)
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    const orderRow = order as AdminOrderRow;

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

    const trackingId = `BS-${orderId.slice(0, 8).toUpperCase()}`;
    notifyOrderStatusCustomer({
      client: supabase,
      email: orderRow.customer_email,
      trackingId,
      status: newStatus,
    }).catch((notificationErr) => {
      console.error("Admin order status customer notification failed:", notificationErr);
    });

    // Timeline event for the status change.
    recordOrderEvent({
      client: supabase,
      orderId,
      eventType: mapStatusToEventType(newStatus),
      fromStatus: orderRow.status,
      toStatus: newStatus,
      detail: `Status updated by admin`,
    }).catch((eventErr) => {
      console.error("Admin order status event failed:", eventErr);
    });

    // Refund the customer's wallet when the order is cancelled. The admin can
    // pass an exact refundAmount (defaults to the full order amount). Only runs
    // on a transition INTO Cancelled so re-saves don't double-refund.
    if (newStatus === "Cancelled" && orderRow.status !== "Cancelled") {
      const refundBase = Number(orderRow.amount ?? orderRow.original_amount ?? 0);
      const requestedRefund = refundAmount !== undefined ? Number(refundAmount) : refundBase;
      const refundToCredit = Number.isFinite(requestedRefund) && requestedRefund > 0
        ? Math.min(requestedRefund, Math.max(refundBase, 0))
        : 0;

      if (refundToCredit > 0) {
        const refundResult = await refundOrderToWallet({
          client: supabase,
          orderId,
          customerEmail: orderRow.customer_email,
          amount: refundToCredit,
          trackingId,
        });
        if (!refundResult.refunded) {
          console.warn("Order refund did not complete:", refundResult);
        }
      }
    }

    if (newStatus === "Processing" && orderRow.status !== "Processing") {
      const serviceTitle = getJoinedServiceTitle(orderRow.services) || "SMM Service";
      resolveSmmServiceTitle(orderRow.smm_service_id, serviceTitle)
        .then((resolvedServiceTitle) =>
          sendOrderApprovedEmail({
            email: orderRow.customer_email,
            trackingId,
            serviceTitle: resolvedServiceTitle,
            amount: Number(orderRow.amount),
          })
        )
        .catch((emailErr) => {
          console.error("Admin order approval email failed:", emailErr);
        });
    }

    // 3. Trigger automated RixeySMM placement if:
    // - Order status is updated to 'Processing'
    // - Order does not already have an external order placed
    if (newStatus === "Processing" || newStatus === "Completed") {
      creditReferralCommission({
        primaryClient: supabase,
        customerEmail: orderRow.customer_email,
        source: "order",
        amount: Number(orderRow.amount),
        referenceId: orderId,
      }).catch((err) => {
        console.error("Admin referral order commission failed:", err);
      });
    }

    if (newStatus === "Processing" && !orderRow.external_order_id) {
      // autoPlaceRixeyOrder has its own guard to only run for the Followers service ID
      autoPlaceRixeyOrder(orderId, orderRow.service_id, orderRow.target_url, orderRow.quantity).catch((err) => {
        console.error("Async auto-placement on RixeySMM from admin status update failed:", err);
      });
    }

    // 4. Fire Telegram + email completion notifications if:
    // - Order status is updated to 'Completed'
    if (newStatus === "Completed" && orderRow.status !== "Completed") {
      const serviceTitle = getJoinedServiceTitle(orderRow.services) || "SMM Service";
      const resolvedServiceTitle = await resolveSmmServiceTitle(orderRow.smm_service_id, serviceTitle);
      sendOrderCompleteNotification({
        trackingId,
        service: resolvedServiceTitle,
        email: orderRow.customer_email || "",
        quantity: orderRow.quantity,
        amount: Number(orderRow.amount),
        paymentMethod: orderRow.payment_method || "GCash",
        details: orderRow.target_url,
      }).catch((err) => {
        console.error("Async sendOrderCompleteNotification failed from admin update:", err);
      });
      sendOrderCompletedEmail({
        email: orderRow.customer_email,
        trackingId,
        serviceTitle: resolvedServiceTitle,
        amount: Number(orderRow.amount),
        quantity: orderRow.quantity,
      }).catch((emailErr) => {
        console.error("Admin order completed email failed:", emailErr);
      });
    }

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    console.error("Update order status endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

