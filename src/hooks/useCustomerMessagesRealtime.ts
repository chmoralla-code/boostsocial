"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  subscribeCustomerMessages,
  type CustomerMessageRow,
} from "@/utils/realtimeChat";

type Options = {
  email?: string;
  scope: "customer" | "admin";
  enabled?: boolean;
  onInsert: (row: CustomerMessageRow) => void;
  onUpdate?: (row: CustomerMessageRow) => void;
};

/**
 * React hook that streams `customer_messages` row inserts/updates over
 * Supabase Realtime. Falls back gracefully: if the realtime channel never
 * connects (e.g. migration not applied yet), callers should keep a slow
 * polling safety net so chat still works.
 */
export function useCustomerMessagesRealtime({
  email,
  scope,
  enabled = true,
  onInsert,
  onUpdate,
}: Options) {
  const insertRef = useRef(onInsert);
  const updateRef = useRef(onUpdate);

  // Keep the latest callbacks in refs without re-subscribing on every render.
  // Updated inside an effect so we never mutate refs during render.
  useEffect(() => {
    insertRef.current = onInsert;
  });
  useEffect(() => {
    updateRef.current = onUpdate;
  });

  useEffect(() => {
    if (!enabled) return;
    if (scope === "customer" && !email) return;

    const supabase = createClient();
    const unsubscribe = subscribeCustomerMessages(supabase, {
      scope,
      email,
      onInsert: (row) => insertRef.current(row),
      onUpdate: (row) => updateRef.current?.(row),
    });

    return () => {
      unsubscribe();
    };
  }, [email, scope, enabled]);
}
