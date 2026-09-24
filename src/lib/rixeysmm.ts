import { createClient } from "@supabase/supabase-js";
import { parseDescription } from "@/utils/serviceHelpers";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { recordOrderEvent } from "@/lib/orderEvents";

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";
const PROVIDER_FUNDING_QUEUE_STATUS =
  "Queued: RixeySMM provider balance is PHP 0.00. Order is registered and waiting for provider top-up or manual fulfillment.";
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

const syncOrderUpdateToBackups = async (orderId: string, update: Record<string, string | null>) => {
  await syncBackupAdminClients(async (backupClient) => {
    return backupClient
      .from("orders")
      .update(update)
      .eq("id", orderId);
  }, "RixeySMM order update sync");
};

async function fetchRixeyBalance(apiKey: string) {
  const res = await fetch(RIXEYSMM_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      key: apiKey,
      action: "balance",
    }),
  });

  if (!res.ok) {
    throw new Error(`Balance lookup failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  const balance = Number(data.balance);
  return Number.isFinite(balance) ? balance : null;
}

function isProviderFundingError(message: string) {
  return /(balance|fund|funds|credit|not enough|insufficient)/i.test(message);
}

async function markOrderQueuedForProviderFunding(
  supabase: ReturnType<typeof getSupabase>,
  orderId: string,
  smmServiceId: string | number | null,
  reason = PROVIDER_FUNDING_QUEUE_STATUS
) {
  const update = {
    external_status: reason,
    smm_service_id: smmServiceId ? String(smmServiceId) : null,
  };

  await supabase
    .from("orders")
    .update(update)
    .eq("id", orderId);
  await syncOrderUpdateToBackups(orderId, update);
  await recordOrderEvent({
    client: supabase,
    orderId,
    eventType: "provider_queued",
    detail: "Queued: waiting for provider balance / funding",
  }).catch((eventErr) => {
    console.warn("[RixeySMM] provider_queued event failed:", eventErr);
  });
}

/** Minimum gap between two placement attempts for the same order. */
const PLACEMENT_CLAIM_WINDOW_MS = 2 * 60 * 1000;

/**
 * Claim the right to place this order by stamping last_attempt_at, but only if
 * nobody else attempted it in the last couple of minutes. Admin approval, the
 * Telegram button, the receipt verifier, the retry cron and the Orders page
 * can all try to place the same order; without this they could each send it
 * to RixeySMM and the customer's order would be bought twice.
 */
async function claimPlacement(
  supabase: ReturnType<typeof getSupabase>,
  orderId: string,
  allowReplace: boolean
) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - PLACEMENT_CLAIM_WINDOW_MS).toISOString();
  let query = supabase
    .from("orders")
    .update({ last_attempt_at: now.toISOString() })
    .eq("id", orderId)
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`);
  if (!allowReplace) query = query.is("external_order_id", null);

  const { data, error } = await query.select("id");
  if (error) {
    // Older databases may lack last_attempt_at; placing is better than stalling.
    console.warn(`[RixeySMM] Placement claim unavailable for ${orderId}:`, error.message);
    return true;
  }
  return Array.isArray(data) && data.length > 0;
}

/** Touch the retry-guard timestamp after any placement attempt (queued/failed/placed). */
async function markPlacementAttempt(supabase: ReturnType<typeof getSupabase>, orderId: string) {
  const attempt = { last_attempt_at: new Date().toISOString() };
  await supabase.from("orders").update(attempt).eq("id", orderId);
  await syncOrderUpdateToBackups(orderId, attempt);
}

/**
 * Re-queues a completed order's refill on RixeySMM using the stored original
 * smm_service_id / target_url / quantity. Updates the refill_orders row on
 * success/failure. Returns the Rixey external order id when placed.
 */
export async function reQueueRefill(refillId: string) {
  const supabase = getSupabase();

  const { data: refill } = await supabase
    .from("refill_orders")
    .select("id, original_order_id, service_id, smm_service_id, target_url, quantity, status")
    .eq("id", refillId)
    .maybeSingle();

  if (!refill) return null;
  if (!refill.smm_service_id) {
    await supabase.from("refill_orders").update({ status: "failed" }).eq("id", refillId);
    return null;
  }

  const { data: order } = await supabase
    .from("orders")
    .select("service_id")
    .eq("id", refill.original_order_id)
    .maybeSingle();

  const serviceId = order?.service_id || refill.service_id || "";
  await autoPlaceRixeyOrder(
    String(refill.original_order_id || ""),
    String(serviceId || ""),
    String(refill.target_url || ""),
    Number(refill.quantity || 0),
    // A refill deliberately re-places against the original (already placed) order.
    { allowReplace: true }
  );

  // autoPlaceRixeyOrder wrote the result to the ORIGINAL order. Copy the outcome
  // into the refill record so admins can see what happened.
  const { data: updatedOrder } = await supabase
    .from("orders")
    .select("external_order_id, external_status")
    .eq("id", refill.original_order_id)
    .maybeSingle();

  if (updatedOrder?.external_order_id) {
    await supabase
      .from("refill_orders")
      .update({ status: "placed", smm_order_id: String(updatedOrder.external_order_id) })
      .eq("id", refillId);
    return String(updatedOrder.external_order_id);
  }

  const status = String(updatedOrder?.external_status || "").toLowerCase();
  if (status.includes("queued")) {
    await supabase.from("refill_orders").update({ status: "pending" }).eq("id", refillId);
    return null;
  }

  await supabase.from("refill_orders").update({ status: "failed" }).eq("id", refillId);
  return null;
}

/**
 * Automatically places an order on RixeySMM for any mapped service.
 * Looks up the correct RixeySMM Service ID dynamically from the order or the database services catalog.
 * Saves the response (external order ID or failure reason) in the database.
 */
export async function autoPlaceRixeyOrder(
  orderId: string,
  serviceId: string,
  targetUrl: string,
  quantity: number,
  options?: { allowReplace?: boolean }
) {
  const supabase = getSupabase();
  const allowReplace = Boolean(options?.allowReplace);

  try {
    console.log(`[RixeySMM] Triggering automated placement for Order ID: ${orderId}`);

    // 1. Load order details to check for an smm_service_id
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("smm_service_id, service_id, external_order_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) throw orderErr;

    if (order?.external_order_id && !allowReplace) {
      console.log(`[RixeySMM] Order ${orderId} already placed as #${order.external_order_id}. Skipping.`);
      return;
    }

    let smmServiceId = order?.smm_service_id;

    // 2. Fallback: Check if the associated service has a mapped smm_service_id in its JSON description
    if (!smmServiceId && order?.service_id) {
      const { data: service } = await supabase
        .from("services")
        .select("description")
        .eq("id", order.service_id)
        .maybeSingle();

      if (service?.description) {
        try {
          const parsed = parseDescription(service.description);
          if (parsed) {
            smmServiceId = parsed.smm_service_id ? String(parsed.smm_service_id) : null;
          }
        } catch (e) {
          console.warn(`[RixeySMM] Failed parsing JSON description for service ${order.service_id}:`, e);
        }
      }
    }

    // 3. Strict guard: If there is no SMM Service ID, this is a manual service. Do not forward.
    if (!smmServiceId) {
      console.log(`[RixeySMM] Order ${orderId} does not map to any RixeySMM Service ID. Skipping SMM placement.`);
      return;
    }

    // 4. Read SMM API key
    const rawApiKey = process.env.RIXEYSMM_API_KEY;
    const apiKey = rawApiKey?.replace(/['"\r\n]/g, "").trim();
    if (!apiKey) {
      const errorMsg = "Failed: RixeySMM API Key is missing in environment variables.";
      console.error(`[RixeySMM] ${errorMsg}`);
      await supabase
        .from("orders")
        .update({ external_status: errorMsg })
        .eq("id", orderId);
      await syncOrderUpdateToBackups(orderId, { external_status: errorMsg });
      return;
    }

    if (!(await claimPlacement(supabase, orderId, allowReplace))) {
      console.log(`[RixeySMM] Order ${orderId} is already being placed by another request. Skipping.`);
      return;
    }

    try {
      const balance = await fetchRixeyBalance(apiKey);
      if (balance !== null && balance <= 0) {
        const queueStatus = `Queued: RixeySMM provider balance is PHP ${balance.toFixed(2)}. Order is registered and waiting for provider top-up or manual fulfillment.`;
        console.warn(`[RixeySMM] Order ${orderId} queued because provider balance is ${balance.toFixed(2)}.`);
        await markOrderQueuedForProviderFunding(supabase, orderId, smmServiceId, queueStatus);
        return;
      }
    } catch (balanceErr) {
      console.error("[RixeySMM] Provider balance preflight failed. Continuing to panel placement attempt:", balanceErr);
    }

    // Clean up target URL if it has pre-made specs formatting (just in case)
    let cleanUrl = targetUrl.trim();
    if (cleanUrl.includes("Page Wants:")) {
      const linkMatch = cleanUrl.match(/\[FB Admin:\s*([^\]]+)\]/);
      if (linkMatch && linkMatch[1]) {
        cleanUrl = linkMatch[1];
      }
    } else if (cleanUrl.startsWith("Reactions:")) {
      // Extract the link from "Reactions: [Like] Link: http://..."
      const linkMatch = cleanUrl.match(/Link:\s*([^\s]+)/);
      if (linkMatch && linkMatch[1]) {
        cleanUrl = linkMatch[1];
      }
    }

    // Clean trailing commas, semicolons, dots or brackets from accidental copy-paste
    cleanUrl = cleanUrl.replace(/[,;.)\]]\s*$/, "").trim();

    // Make the URL unique by adding a timestamp parameter. This completely solves
    // SMM panel duplicate-link restrictions and makes simultaneous or frequent ordering work.
    let uniqueSmmUrl = cleanUrl;
    try {
      if (cleanUrl.startsWith("http")) {
        const urlObj = new URL(cleanUrl);
        const uniqueVal = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        urlObj.searchParams.set("t", uniqueVal);
        uniqueSmmUrl = urlObj.toString();
      } else {
        const uniqueVal = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        if (cleanUrl.includes("?")) {
          uniqueSmmUrl = `${cleanUrl}&t=${uniqueVal}`;
        } else {
          uniqueSmmUrl = `${cleanUrl}?t=${uniqueVal}`;
        }
      }
    } catch {
      const uniqueVal = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      if (cleanUrl.includes("?")) {
        uniqueSmmUrl = `${cleanUrl}&t=${uniqueVal}`;
      } else {
        uniqueSmmUrl = `${cleanUrl}?t=${uniqueVal}`;
      }
    }

    console.log(`[RixeySMM] Forwarding unique URL to SMM Panel (Service ID ${smmServiceId}): ${uniqueSmmUrl}`);

    // 5. Make form-urlencoded request to RixeySMM API
    const response = await fetch(RIXEYSMM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        key: apiKey,
        action: "add",
        service: smmServiceId,
        link: uniqueSmmUrl,
        quantity: String(quantity),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[RixeySMM] Response for Order ${orderId}:`, data);

    // 6. Handle SMM Panel API responses
    if (data.order) {
      // Order placed successfully
      const externalId = String(data.order);
      await supabase
        .from("orders")
        .update({
          external_order_id: externalId,
          external_status: "Pending", // SMM panel starts in Pending
          smm_service_id: smmServiceId // Save the placed SMM service ID
        })
        .eq("id", orderId);
      await syncOrderUpdateToBackups(orderId, {
        external_order_id: externalId,
        external_status: "Pending",
        smm_service_id: smmServiceId,
      });
      await markPlacementAttempt(supabase, orderId);
      await recordOrderEvent({
        client: supabase,
        orderId,
        eventType: "provider_submitted",
        detail: `Sent to provider as order #${externalId}`,
      }).catch((eventErr) => {
        console.warn("[RixeySMM] provider_submitted event failed:", eventErr);
      });
      console.log(`[RixeySMM] Order successfully placed! External ID: ${externalId}`);
    } else if (data.error) {
      // Panel returned a specific error (e.g. low balance, bad link)
      const providerError = String(data.error);
      if (isProviderFundingError(providerError)) {
        const queueStatus = `Queued: RixeySMM provider balance/funds unavailable (${providerError}). Order is registered and waiting for provider top-up or manual fulfillment.`;
        await markOrderQueuedForProviderFunding(supabase, orderId, smmServiceId, queueStatus);
        await markPlacementAttempt(supabase, orderId);
        console.warn(`[RixeySMM] Order ${orderId} queued after panel funding error: ${providerError}`);
        return;
      }

      const panelError = `Failed: ${providerError}`;
      await supabase
        .from("orders")
        .update({
          external_status: panelError,
        })
        .eq("id", orderId);
      await syncOrderUpdateToBackups(orderId, { external_status: panelError });
      await markPlacementAttempt(supabase, orderId);
      await recordOrderEvent({
        client: supabase,
        orderId,
        eventType: "provider_queued",
        detail: `Provider rejected: ${providerError}`,
      }).catch((eventErr) => {
        console.warn("[RixeySMM] failed event failed:", eventErr);
      });
      console.error(`[RixeySMM] SMM Panel returned error: ${providerError}`);
    } else {
      // Unknown response format
      const unknownError = "Failed: Unknown API response structure.";
      await supabase
        .from("orders")
        .update({
          external_status: unknownError,
        })
        .eq("id", orderId);
      await syncOrderUpdateToBackups(orderId, { external_status: unknownError });
      await markPlacementAttempt(supabase, orderId);
      console.error(`[RixeySMM] Unknown SMM response:`, data);
    }
  } catch (err: unknown) {
    const externalStatus = `Failed: ${getErrorMessage(err)}`;
    console.error(`[RixeySMM] Auto-placement failed for Order ${orderId}:`, err);
    await supabase
      .from("orders")
      .update({
        external_status: externalStatus,
      })
      .eq("id", orderId);
    await syncOrderUpdateToBackups(orderId, { external_status: externalStatus });
    await markPlacementAttempt(supabase, orderId);
  }
}

/**
 * Re-sends Processing orders that never reached RixeySMM: placement failed,
 * was queued for provider funding, or never ran at all (no external status —
 * e.g. the serverless function was frozen before the provider call). The
 * claim in autoPlaceRixeyOrder keeps concurrent runs from placing twice.
 */
export async function retryUnplacedOrders(options?: {
  limit?: number;
  retryIntervalMinutes?: number;
  minAgeMinutes?: number;
}) {
  const supabase = getSupabase();
  const limit = options?.limit ?? 25;
  const retryCutoff = new Date(Date.now() - (options?.retryIntervalMinutes ?? 15) * 60_000).toISOString();
  // Give a freshly approved order time to be placed by its own request first.
  const ageCutoff = new Date(Date.now() - (options?.minAgeMinutes ?? 3) * 60_000).toISOString();

  const { data, error } = await supabase
    .from("orders")
    .select("id, service_id, target_url, quantity, external_status, created_at")
    .eq("status", "Processing")
    .is("external_order_id", null)
    .lt("created_at", ageCutoff)
    .or(`last_attempt_at.is.null,last_attempt_at.lt.${retryCutoff}`)
    .order("created_at", { ascending: true })
    .limit(limit * 2);

  if (error) throw error;

  const rows = (data || []).filter((order) => {
    const status = String(order.external_status || "").trim();
    return !status || /^queued:/i.test(status) || /^failed:/i.test(status);
  }).slice(0, limit);

  let attempted = 0;
  for (const order of rows) {
    await autoPlaceRixeyOrder(
      String(order.id),
      String(order.service_id || ""),
      String(order.target_url || ""),
      Number(order.quantity || 0)
    );
    attempted += 1;
  }
  return { scanned: rows.length, attempted };
}
