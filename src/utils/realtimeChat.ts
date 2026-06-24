import type {
  RealtimeChannel,
  RealtimePostgresChangesFilter,
  RealtimePostgresInsertPayload,
  RealtimePostgresUpdatePayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { REALTIME_SUBSCRIBE_STATES } from "@supabase/supabase-js";

export type CustomerMessageRow = {
  id: string;
  customer_email: string;
  sender: "admin" | "customer" | "system";
  message: string;
  is_read: boolean;
  created_at: string;
};

export type SubscribeOptions = {
  /**
   * Customer email to scope the subscription to.
   * Required for `scope: "customer"`. Optional for `scope: "admin"` — when
   * provided, the admin only receives rows for that conversation; when
   * omitted, the admin receives every row (RLS still gates visibility).
   */
  email?: string;
  /** `customer` subscribes to one conversation; `admin` to all (or one if email is set). */
  scope: "customer" | "admin";
  onInsert: (row: CustomerMessageRow) => void;
  onUpdate?: (row: CustomerMessageRow) => void;
};

/**
 * Subscribe to realtime `customer_messages` changes via Supabase Realtime.
 *
 * Requires the `supabase_realtime` publication to include
 * `public.customer_messages` and SELECT RLS policies that let the caller see
 * the rows they subscribe to (see migration
 * 20260624100000_enable_customer_messages_realtime.sql).
 *
 * Returns an unsubscribe function that tears the channel down cleanly.
 */
export function subscribeCustomerMessages(
  supabase: SupabaseClient,
  options: SubscribeOptions
): () => void {
  const { email, scope, onInsert, onUpdate } = options;

  if (scope === "customer" && !email) {
    throw new Error("subscribeCustomerMessages: email is required for customer scope");
  }

  const normalizedEmail = email?.trim().toLowerCase();

  const channelName =
    scope === "admin"
      ? normalizedEmail
        ? `customer_messages:admin:${normalizedEmail}`
        : "customer_messages:admin"
      : `customer_messages:${normalizedEmail}`;

  const filter = normalizedEmail
    ? `customer_email=eq.${normalizedEmail}`
    : undefined;

  const insertFilter: RealtimePostgresChangesFilter<"INSERT"> = {
    event: "INSERT",
    schema: "public",
    table: "customer_messages",
    ...(filter ? { filter } : {}),
  };

  const updateFilter: RealtimePostgresChangesFilter<"UPDATE"> = {
    event: "UPDATE",
    schema: "public",
    table: "customer_messages",
    ...(filter ? { filter } : {}),
  };

  let channel: RealtimeChannel = supabase.channel(channelName, {
    config: { broadcast: { self: false } },
  });

  channel = channel.on(
    "postgres_changes",
    insertFilter,
    (payload: RealtimePostgresInsertPayload<CustomerMessageRow>) => {
      const row = payload.new as CustomerMessageRow | undefined;
      if (row) onInsert(row);
    }
  );

  if (onUpdate) {
    channel = channel.on(
      "postgres_changes",
      updateFilter,
      (payload: RealtimePostgresUpdatePayload<CustomerMessageRow>) => {
        const row = payload.new as CustomerMessageRow | undefined;
        if (row) onUpdate(row);
      }
    );
  }

  channel.subscribe((status: REALTIME_SUBSCRIBE_STATES) => {
    if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
      console.warn("customer_messages realtime channel error");
    }
  });

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      // ignore — already removed
    }
  };
}
