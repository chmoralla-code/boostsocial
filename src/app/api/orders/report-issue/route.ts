import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { notifyCustomer } from "@/lib/customerNotifications";
import { sendAdminAlert } from "@/lib/telegram";

const MAX_ISSUE_LENGTH = 1200;
const VALID_CATEGORIES = new Set([
  "not_delivered",
  "wrong_link",
  "slow_order",
  "refund_request",
  "other",
]);

type ServiceJoin = { title?: string | null };

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Server configuration missing");
  }

  return createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
}

function categoryLabel(category: string) {
  return category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "orders-report-issue",
      maxRequests: 6,
      windowMs: 10 * 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Please sign in before reporting an order issue." }, { status: 401 });
    }

    const { orderId, category, message } = await req.json();
    const cleanOrderId = String(orderId || "").trim();
    const cleanCategory = String(category || "").trim();
    const cleanMessage = String(message || "").trim();

    if (!cleanOrderId || !VALID_CATEGORIES.has(cleanCategory)) {
      return NextResponse.json({ error: "Missing order or issue category." }, { status: 400 });
    }

    if (!cleanMessage || cleanMessage.length > MAX_ISSUE_LENGTH) {
      return NextResponse.json({ error: "Please describe the issue in 1 to 1200 characters." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, customer_email, status, amount, quantity, target_url, services(title)")
      .eq("id", cleanOrderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const userEmail = user.email.trim().toLowerCase();
    const orderEmail = String(order.customer_email || "").trim().toLowerCase();
    if (userEmail !== orderEmail) {
      return NextResponse.json({ error: "You can only report issues for your own orders." }, { status: 403 });
    }

    const trackingId = `BS-${order.id.slice(0, 8).toUpperCase()}`;
    const services = order.services as ServiceJoin | ServiceJoin[] | null;
    const serviceTitle = Array.isArray(services)
      ? services[0]?.title
      : services?.title;
    const formattedIssue =
      `Order issue report\n` +
      `Tracking ID: ${trackingId}\n` +
      `Category: ${categoryLabel(cleanCategory)}\n` +
      `Status: ${order.status}\n` +
      `Service: ${serviceTitle || "SMM Service"}\n\n` +
      cleanMessage;

    const payload = {
      customer_email: orderEmail,
      sender: "customer",
      message: formattedIssue,
      is_read: false,
    };

    const { error: messageError } = await supabase
      .from("customer_messages")
      .insert([payload]);

    if (messageError) throw messageError;

    await syncBackupAdminClients(async (backupClient) => {
      return backupClient.from("customer_messages").insert([payload]);
    }, "order issue report sync");

    notifyCustomer({
      client: supabase,
      email: orderEmail,
      message: `System update: We received your issue report for ${trackingId}. Admin will review it from the support dashboard.`,
    }).catch((notificationErr) => {
      console.error("Issue report acknowledgement failed:", notificationErr);
    });

    sendAdminAlert({
      title: "ORDER ISSUE REPORTED",
      message:
        `Tracking ID: ${trackingId}\n` +
        `Customer: ${orderEmail}\n` +
        `Category: ${categoryLabel(cleanCategory)}\n` +
        `Status: ${order.status}\n` +
        `Amount: PHP ${Number(order.amount || 0).toFixed(2)}\n` +
        `Target: ${order.target_url || "N/A"}\n\n` +
        cleanMessage,
    }).catch((telegramErr) => {
      console.error("Issue report Telegram alert failed:", telegramErr);
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Report order issue failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
