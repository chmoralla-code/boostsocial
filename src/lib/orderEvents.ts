import { SupabaseClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

export type OrderEventType =
  | "created"
  | "payment_pending"
  | "payment_received"
  | "processing"
  | "provider_queued"
  | "provider_submitted"
  | "provider_completed"
  | "completed"
  | "cancelled"
  | "rejected"
  | "refill_requested";

type RecordOrderEventInput = {
  client: SupabaseClient;
  orderId: string;
  eventType: OrderEventType;
  fromStatus?: string | null;
  toStatus?: string | null;
  detail?: string | null;
};

/**
 * Append an event to an order's timeline (order_events table) on the primary DB
 * and mirror to every backup. Fire-and-forget friendly — never throws into the
 * caller's critical path.
 */
export async function recordOrderEvent({
  client,
  orderId,
  eventType,
  fromStatus,
  toStatus,
  detail,
}: RecordOrderEventInput) {
  const row = {
    order_id: orderId,
    event_type: eventType,
    from_status: fromStatus ?? null,
    to_status: toStatus ?? null,
    detail: detail ?? null,
    created_at: new Date().toISOString(),
  };

  try {
    await client.from("order_events").insert(row);
  } catch (err) {
    console.warn("recordOrderEvent primary insert failed:", err);
  }

  try {
    await syncBackupAdminClients(async (backupClient) => {
      await backupClient.from("order_events").insert(row);
    }, "order event sync");
  } catch (err) {
    console.warn("recordOrderEvent backup sync failed:", err);
  }
}

/** Human-friendly label for the app/orders timeline UI. */
export function orderEventLabel(eventType: OrderEventType | string) {
  switch (eventType) {
    case "created": return "Order registered";
    case "payment_pending": return "Waiting for payment";
    case "payment_received": return "Payment received";
    case "processing": return "Processing started";
    case "provider_queued": return "Queued for provider";
    case "provider_submitted": return "Sent to provider";
    case "provider_completed": return "Provider delivered";
    case "completed": return "Order completed";
    case "cancelled": return "Order cancelled";
    case "rejected": return "Order rejected";
    case "refill_requested": return "Refill requested";
    default: return eventType;
  }
}
