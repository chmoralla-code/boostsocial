import { SupabaseClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { isOrderPushStatus, sendOrderStatusPush } from "@/lib/webPush";

type NotifyCustomerInput = {
  client: SupabaseClient;
  email?: string | null;
  message: string;
  sender?: "admin" | "system";
};

export async function notifyCustomer({ client, email, message, sender = "system" }: NotifyCustomerInput) {
  const normalizedEmail = email?.trim().toLowerCase();
  const trimmedMessage = message.trim();

  if (!normalizedEmail || !trimmedMessage) return;

  const payload = {
    customer_email: normalizedEmail,
    sender,
    message: trimmedMessage,
    is_read: false,
  };

  const { error } = await client.from("customer_messages").insert([payload]);
  if (error) {
    console.error("Customer notification insert failed:", error);
    return;
  }

  await syncBackupAdminClients(async (backupClient) => {
    return backupClient.from("customer_messages").insert([payload]);
  }, "customer notification sync");
}

export async function notifyOrderStatusCustomer({
  client,
  email,
  trackingId,
  status,
}: {
  client: SupabaseClient;
  email?: string | null;
  trackingId: string;
  status: string;
}) {
  const message = orderStatusNotification(trackingId, status);

  await notifyCustomer({
    client,
    email,
    message,
  });

  if (isOrderPushStatus(status)) {
    await sendOrderStatusPush({
      client,
      email,
      trackingId,
      status,
    });
  }
}

export function orderStatusNotification(trackingId: string, status: string) {
  if (status === "Processing") {
    return `System update: Your order ${trackingId} is now Processing. Your payment was approved and delivery has started.`;
  }

  if (status === "Completed") {
    return `System update: Your order ${trackingId} is Completed. Please check your target link and report any issue from the Track Order page.`;
  }

  if (status === "Rejected") {
    return `System update: Your order ${trackingId} was Rejected. Please open support chat if you need help correcting the payment or order details.`;
  }

  if (status === "Cancelled") {
    return `System update: Your order ${trackingId} was Cancelled. Please contact support if you need help.`;
  }

  return `System update: Your order ${trackingId} is now ${status}.`;
}
