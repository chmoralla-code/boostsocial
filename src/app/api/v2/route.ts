import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { resolveOrderPricing, CATALOG_SERVICE_ID } from "@/lib/orderPricing";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";
import { getSmmCatalogServices } from "@/lib/smmCatalog";
import { sendOrderNotification } from "@/lib/telegram";
import { encryptTargetUrlSecrets } from "@/lib/fieldCrypto";
import { maskEncryptedValues } from "@/lib/orderTracking";
import { recordOrderEvent } from "@/lib/orderEvents";
import {
  apiError,
  bodyInt,
  bodyString,
  clientIp,
  extractApiKey,
  hashApiKey,
  ipAllowed,
  readApiBody,
  rpcErrorToResponse,
} from "@/lib/apiKeys";

/**
 * Reseller API v2.
 *
 * One endpoint, `action`-driven — the same shape SMM resellers already know
 * from other panels, so an existing script can point here without changes.
 *
 *   services  → the catalog at the prices resellers pay
 *   balance   → their wallet balance
 *   add       ��� place an order (debits the wallet, atomically)
 *   status    → one order, or many
 *   refill    → re-run a completed order
 *
 * A key can only ever spend its OWN wallet. Every spending rule (rate limit,
 * spend caps, balance) is enforced inside the database transaction, so a
 * runaway script cannot race past them.
 */

export const dynamic = "force-dynamic";

type ApiKeyRow = {
  id: string;
  user_id: string;
  key_prefix: string;
  is_active: boolean;
  allowed_ips: unknown;
  revoked_at: string | null;
};

const ORDER_FIELDS =
  "id, status, service_title, target_url, quantity, amount, smm_service_id, external_order_id, created_at, source";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as Record<string, unknown>).message || error);
  }
  return String(error);
}

function trackingIdFor(orderId: string) {
  return `BS-${orderId.slice(0, 8).toUpperCase()}`;
}

/**
 * The link an API client gets back.
 *
 * A reseller only ever sends ordinary target links, but a stored row could
 * still carry a sealed portal credential. A caller has no key to open one, so
 * it is shown as a placeholder rather than as an unreadable `enc:v1:` blob.
 */
function apiLink(value: unknown) {
  return maskEncryptedValues(String(value || "")).value;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};

  try {
    body = await readApiBody(req);
    const ip = clientIp(req.headers);

    const rawKey = extractApiKey(req.headers, body);
    if (!rawKey) {
      return NextResponse.json(
        apiError("API key is missing.", "MISSING_KEY"),
        { status: 401 }
      );
    }

    const supabase = createClient(
      getSupabaseUrl(),
      getSupabaseServiceRoleKey(),
      { auth: { persistSession: false } }
    );

    // Look up by hash — the plain key is never stored anywhere.
    const { data: keyRow, error: keyError } = await supabase
      .from("api_keys")
      .select("id, user_id, key_prefix, is_active, allowed_ips, revoked_at")
      .eq("key_hash", hashApiKey(rawKey))
      .maybeSingle<ApiKeyRow>();

    if (keyError) {
      // A missing table means the migration has not been applied yet.
      if (/relation|does not exist|schema cache/i.test(keyError.message || "")) {
        return NextResponse.json(
          apiError("Reseller API is not available yet.", "NOT_CONFIGURED"),
          { status: 503 }
        );
      }
      throw keyError;
    }

    if (!keyRow) {
      return NextResponse.json(
        apiError("Invalid API key.", "INVALID_KEY"),
        { status: 401 }
      );
    }

    if (!keyRow.is_active || keyRow.revoked_at) {
      return NextResponse.json(
        apiError("This API key has been revoked.", "KEY_REVOKED"),
        { status: 401 }
      );
    }

    if (!ipAllowed(keyRow.allowed_ips, ip)) {
      return NextResponse.json(
        apiError("This API key is not allowed from your IP address.", "IP_NOT_ALLOWED"),
        { status: 403 }
      );
    }

    const action = (bodyString(body, "action") || "").toLowerCase();
    if (!action) {
      return NextResponse.json(
        apiError("Missing 'action'. Use services, balance, add, status or refill.", "MISSING_ACTION"),
        { status: 400 }
      );
    }

    // ── balance ───────────────────────────────────────────────
    // The most-called action, so it skips the rate-limit RPC and just
    // answers. Reading a balance cannot be abused into spending.
    if (action === "balance") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", keyRow.user_id)
        .maybeSingle();

      if (profileError) throw profileError;

      return NextResponse.json({
        balance: Number(profile?.balance ?? 0),
        currency: "PHP",
      });
    }

    // ── services ──────────────────────────────────────────────
    if (action === "services") {
      const gate = await supabase.rpc("touch_api_key", {
        p_key_id: keyRow.id,
        p_action: "services",
        p_ip: ip,
      });

      const gateRow = Array.isArray(gate.data) ? gate.data[0] : gate.data;
      if (gate.error) throw gate.error;
      if (gateRow && gateRow.allowed === false) {
        const mapped = rpcErrorToResponse(gateRow.error_code);
        return NextResponse.json(
          apiError(mapped.message, gateRow.error_code),
          { status: mapped.status }
        );
      }

      const catalog = await getSmmCatalogServices();

      return NextResponse.json(
        catalog.services.map((service) => ({
          service: service.id,
          name: service.name,
          category: service.category,
          rate: service.ratePer1k,
          min: service.min,
          max: service.max,
          desc: service.desc,
        }))
      );
    }

    // ── add ───────────────────────────────────────────────────
    if (action === "add") {
      const smmServiceId = bodyString(body, "service");
      const link = bodyString(body, "link");
      const quantity = bodyInt(body, "quantity");
      const idempotencyKey = bodyString(body, "idempotency_key");

      if (!smmServiceId) {
        return NextResponse.json(
          apiError("Missing 'service'.", "MISSING_SERVICE"),
          { status: 400 }
        );
      }
      if (!link) {
        return NextResponse.json(
          apiError("Missing 'link'.", "MISSING_LINK"),
          { status: 400 }
        );
      }
      if (!quantity) {
        return NextResponse.json(
          apiError("Missing or invalid 'quantity'.", "MISSING_QUANTITY"),
          { status: 400 }
        );
      }

      // Resolve pricing server-side. The reseller never sends a price, and
      // the provider service must exist in today's live catalog.
      let pricing;
      try {
        pricing = await resolveOrderPricing({
          client: supabase,
          serviceId: CATALOG_SERVICE_ID,
          quantity,
          targetUrl: link,
          requestedSmmServiceId: smmServiceId,
        });
      } catch (pricingError) {
        return NextResponse.json(
          apiError(getErrorMessage(pricingError), "SERVICE_UNAVAILABLE"),
          { status: 400 }
        );
      }

      // The reseller's own account email is the order's customer — they are
      // the buyer. Their end-customer is invisible to us by design.
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", keyRow.user_id)
        .maybeSingle();

      const ownerEmail = String(ownerProfile?.email || "").trim();
      if (!ownerEmail) {
        return NextResponse.json(
          apiError("Wallet owner has no email on file.", "NO_PROFILE"),
          { status: 409 }
        );
      }

      const { data: rpcRows, error: rpcError } = await supabase.rpc(
        "create_api_order",
        {
          p_key_id: keyRow.id,
          p_service_id: pricing.serviceId,
          p_service_title: pricing.serviceTitle,
          p_customer_email: ownerEmail,
          p_target_url: encryptTargetUrlSecrets(link),
          p_amount: pricing.regularAmount,
          p_quantity: pricing.quantity,
          p_smm_service_id: pricing.smmServiceId,
          p_original_amount: pricing.regularAmount,
          p_idempotency_key: idempotencyKey,
          p_ip: ip,
        }
      );

      if (rpcError) throw rpcError;

      const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows;
      if (!row) {
        return NextResponse.json(
          apiError("Order could not be created.", "ORDER_FAILED"),
          { status: 500 }
        );
      }

      if (row.error_code) {
        const mapped = rpcErrorToResponse(row.error_code);
        return NextResponse.json(
          {
            ...apiError(mapped.message, row.error_code),
            ...(row.error_code === "INSUFFICIENT_BALANCE"
              ? { balance: Number(row.new_balance ?? 0) }
              : {}),
          },
          { status: mapped.status }
        );
      }

      const orderId = String(row.order_id);
      const replayed = row.replayed === true;

      // Side effects only on a genuinely new order — a replayed request must
      // not place the boost at the provider twice.
      if (!replayed) {
        after(async () => {
          // Re-read the balance from the primary rather than reusing the value
          // this request captured. Two API orders can land within the same
          // second, and a delayed sync writing a stale number would clobber the
          // newer debit on the mirror.
          const { data: freshProfile } = await supabase
            .from("profiles")
            .select("balance")
            .eq("id", keyRow.user_id)
            .maybeSingle();
          const newBalance = Number(freshProfile?.balance ?? row.new_balance ?? 0);

          const tasks: Promise<unknown>[] = [
            syncBackupAdminClients(async (backupClient) => {
              const profileUpdate = await backupClient
                .from("profiles")
                .update({ balance: newBalance })
                .eq("id", keyRow.user_id);
              if (profileUpdate.error) return profileUpdate;

              return backupClient.from("orders").upsert(
                {
                  id: orderId,
                  service_id: pricing.serviceId,
                  service_title: pricing.serviceTitle,
                  customer_email: ownerEmail,
                  target_url: encryptTargetUrlSecrets(link),
                  amount: pricing.regularAmount,
                  status: "Processing",
                  payment_method: "Wallet",
                  quantity: pricing.quantity,
                  smm_service_id: pricing.smmServiceId,
                  original_amount: pricing.regularAmount,
                  api_key_id: keyRow.id,
                  source: "api",
                  idempotency_key: idempotencyKey,
                },
                { onConflict: "id" }
              );
            }, "reseller api order sync"),
            autoPlaceRixeyOrder(
              orderId,
              pricing.serviceId,
              link,
              pricing.quantity
            ),
            recordOrderEvent({
              client: supabase,
              orderId,
              eventType: "created",
              toStatus: "Processing",
              detail: `Reseller API order (key ${keyRow.key_prefix})`,
            }).catch((eventErr) => {
              console.error("Reseller order event failed:", eventErr);
            }),
            sendOrderNotification({
              trackingId: trackingIdFor(orderId),
              service: pricing.serviceTitle,
              email: ownerEmail,
              quantity: pricing.quantity,
              amount: pricing.regularAmount,
              paymentMethod: "Wallet (API)",
              details: link,
            }).catch((notifyErr) => {
              console.error("Reseller order notification failed:", notifyErr);
            }),
          ];

          const results = await Promise.allSettled(tasks);
          for (const result of results) {
            if (result.status === "rejected") {
              console.error("Reseller API after-task failed:", result.reason);
            }
          }
        });
      }

      return NextResponse.json({
        order: orderId,
        ...(replayed ? { replayed: true } : {}),
        amount: pricing.regularAmount,
        quantity: pricing.quantity,
        balance: Number(row.new_balance ?? 0),
      });
    }

    // ── status ────────────────────────────────────────────────
    if (action === "status") {
      const single = bodyString(body, "order");
      const many = bodyString(body, "orders");

      const gate = await supabase.rpc("touch_api_key", {
        p_key_id: keyRow.id,
        p_action: "status",
        p_ip: ip,
      });
      const gateRow = Array.isArray(gate.data) ? gate.data[0] : gate.data;
      if (gate.error) throw gate.error;
      if (gateRow && gateRow.allowed === false) {
        const mapped = rpcErrorToResponse(gateRow.error_code);
        return NextResponse.json(
          apiError(mapped.message, gateRow.error_code),
          { status: mapped.status }
        );
      }

      // Only ever this key's own orders — a reseller cannot read another's.
      if (single) {
        const { data: order, error } = await supabase
          .from("orders")
          .select(ORDER_FIELDS)
          .eq("id", single)
          .eq("api_key_id", keyRow.id)
          .maybeSingle();

        if (error) throw error;
        if (!order) {
          return NextResponse.json(
            apiError("Order not found for this key.", "ORDER_NOT_FOUND"),
            { status: 404 }
          );
        }

        return NextResponse.json({
          order: order.id,
          status: order.status,
          service: order.service_title,
          link: apiLink(order.target_url),
          quantity: order.quantity,
          amount: Number(order.amount ?? 0),
          start_count: null,
          remains: null,
          external_id: order.external_order_id,
          created_at: order.created_at,
        });
      }

      const ids = (many || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 100);

      if (ids.length === 0) {
        return NextResponse.json(
          apiError("Missing 'order' or 'orders'.", "MISSING_ORDER"),
          { status: 400 }
        );
      }

      const { data: orders, error } = await supabase
        .from("orders")
        .select(ORDER_FIELDS)
        .in("id", ids)
        .eq("api_key_id", keyRow.id);

      if (error) throw error;

      const found = new Map((orders || []).map((row) => [row.id, row]));

      return NextResponse.json(
        ids.map((id) => {
          const row = found.get(id);
          if (!row) return { order: id, error: "Incorrect order ID" };
          return {
            order: row.id,
            status: row.status,
            service: row.service_title,
            link: apiLink(row.target_url),
            quantity: row.quantity,
            amount: Number(row.amount ?? 0),
            start_count: null,
            remains: null,
            external_id: row.external_order_id,
            created_at: row.created_at,
          };
        })
      );
    }

    // ── refill ────────────────────────────────────────────────
    if (action === "refill") {
      const orderId = bodyString(body, "order");
      if (!orderId) {
        return NextResponse.json(
          apiError("Missing 'order'.", "MISSING_ORDER"),
          { status: 400 }
        );
      }

      const gate = await supabase.rpc("touch_api_key", {
        p_key_id: keyRow.id,
        p_action: "refill",
        p_ip: ip,
      });
      const gateRow = Array.isArray(gate.data) ? gate.data[0] : gate.data;
      if (gate.error) throw gate.error;
      if (gateRow && gateRow.allowed === false) {
        const mapped = rpcErrorToResponse(gateRow.error_code);
        return NextResponse.json(
          apiError(mapped.message, gateRow.error_code),
          { status: mapped.status }
        );
      }

      const { data: order, error } = await supabase
        .from("orders")
        .select("id, status, service_id, smm_service_id, target_url, quantity")
        .eq("id", orderId)
        .eq("api_key_id", keyRow.id)
        .maybeSingle();

      if (error) throw error;
      if (!order) {
        return NextResponse.json(
          apiError("Order not found for this key.", "ORDER_NOT_FOUND"),
          { status: 404 }
        );
      }
      if (order.status !== "Completed") {
        return NextResponse.json(
          apiError("Only completed orders can be refilled.", "NOT_COMPLETED"),
          { status: 400 }
        );
      }

      // Re-price at today's rate, so a price change can never undercharge.
      let refillPricing;
      try {
        refillPricing = await resolveOrderPricing({
          client: supabase,
          serviceId: String(order.service_id),
          quantity: Number(order.quantity),
          targetUrl: String(order.target_url || ""),
          requestedSmmServiceId: order.smm_service_id
            ? String(order.smm_service_id)
            : null,
        });
      } catch (pricingError) {
        return NextResponse.json(
          apiError(getErrorMessage(pricingError), "SERVICE_UNAVAILABLE"),
          { status: 400 }
        );
      }

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", keyRow.user_id)
        .maybeSingle();

      const ownerEmail = String(ownerProfile?.email || "").trim();
      if (!ownerEmail) {
        return NextResponse.json(
          apiError("Wallet owner has no email on file.", "NO_PROFILE"),
          { status: 409 }
        );
      }

      // One active refill per order — the table's UNIQUE constraint is the
      // real guard, this check just gives a clean message.
      const { data: existingRefill } = await supabase
        .from("refill_orders")
        .select("id")
        .eq("original_order_id", orderId)
        .maybeSingle();

      if (existingRefill) {
        return NextResponse.json(
          apiError("This order has already been refilled.", "ALREADY_REFILLED"),
          { status: 409 }
        );
      }

      const { data: refillRow, error: refillInsertError } = await supabase
        .from("refill_orders")
        .insert({
          original_order_id: orderId,
          customer_email: ownerEmail,
          service_id: order.service_id,
          smm_service_id: order.smm_service_id,
          target_url: order.target_url,
          quantity: refillPricing.quantity,
          amount: refillPricing.regularAmount,
          status: "pending",
        })
        .select("id")
        .single();

      if (refillInsertError) {
        if (/duplicate|unique/i.test(refillInsertError.message || "")) {
          return NextResponse.json(
            apiError("This order has already been refilled.", "ALREADY_REFILLED"),
            { status: 409 }
          );
        }
        throw refillInsertError;
      }

      // Charge and create the new order through the same atomic path as `add`.
      const { data: refillRpcRows, error: refillRpcError } = await supabase.rpc(
        "create_api_order",
        {
          p_key_id: keyRow.id,
          p_service_id: refillPricing.serviceId,
          p_service_title: refillPricing.serviceTitle,
          p_customer_email: ownerEmail,
          p_target_url: String(order.target_url || ""),
          p_amount: refillPricing.regularAmount,
          p_quantity: refillPricing.quantity,
          p_smm_service_id: refillPricing.smmServiceId,
          p_original_amount: refillPricing.regularAmount,
          p_idempotency_key: null,
          p_ip: ip,
        }
      );

      if (refillRpcError) {
        // Roll the marker back so the reseller can retry.
        await supabase.from("refill_orders").delete().eq("id", refillRow.id);
        throw refillRpcError;
      }

      const refillResult = Array.isArray(refillRpcRows)
        ? refillRpcRows[0]
        : refillRpcRows;

      if (!refillResult || refillResult.error_code) {
        await supabase.from("refill_orders").delete().eq("id", refillRow.id);
        const mapped = rpcErrorToResponse(refillResult?.error_code ?? null);
        return NextResponse.json(
          apiError(mapped.message, refillResult?.error_code ?? "REFILL_FAILED"),
          { status: mapped.status }
        );
      }

      const refillOrderId = String(refillResult.order_id);

      after(async () => {
        const { data: freshProfile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("id", keyRow.user_id)
          .maybeSingle();
        const newBalance = Number(freshProfile?.balance ?? refillResult.new_balance ?? 0);

        const tasks: Promise<unknown>[] = [
          syncBackupAdminClients(async (backupClient) => {
            const profileUpdate = await backupClient
              .from("profiles")
              .update({ balance: newBalance })
              .eq("id", keyRow.user_id);
            if (profileUpdate.error) return profileUpdate;

            await backupClient.from("orders").upsert(
              {
                id: refillOrderId,
                service_id: refillPricing.serviceId,
                service_title: refillPricing.serviceTitle,
                customer_email: ownerEmail,
                target_url: String(order.target_url || ""),
                amount: refillPricing.regularAmount,
                status: "Processing",
                payment_method: "Wallet",
                quantity: refillPricing.quantity,
                smm_service_id: refillPricing.smmServiceId,
                original_amount: refillPricing.regularAmount,
                api_key_id: keyRow.id,
                source: "api",
              },
              { onConflict: "id" }
            );

            return backupClient.from("refill_orders").upsert(
              {
                id: refillRow.id,
                original_order_id: orderId,
                customer_email: ownerEmail,
                service_id: order.service_id,
                smm_service_id: order.smm_service_id,
                target_url: order.target_url,
                quantity: refillPricing.quantity,
                amount: refillPricing.regularAmount,
                status: "pending",
              },
              { onConflict: "id" }
            );
          }, "reseller api refill sync"),
          autoPlaceRixeyOrder(
            refillOrderId,
            refillPricing.serviceId,
            String(order.target_url || ""),
            refillPricing.quantity
          ),
          recordOrderEvent({
            client: supabase,
            orderId: refillOrderId,
            eventType: "created",
            toStatus: "Processing",
            detail: `Reseller API refill of ${orderId}`,
          }).catch((eventErr) => {
            console.error("Reseller refill event failed:", eventErr);
          }),
        ];

        const results = await Promise.allSettled(tasks);
        for (const result of results) {
          if (result.status === "rejected") {
            console.error("Reseller API refill task failed:", result.reason);
          }
        }
      });

      return NextResponse.json({
        refill: refillOrderId,
        order: refillOrderId,
        amount: refillPricing.regularAmount,
        quantity: refillPricing.quantity,
        balance: Number(refillResult.new_balance ?? 0),
      });
    }

    return NextResponse.json(
      apiError(
        `Unknown action '${action}'. Use services, balance, add, status or refill.`,
        "UNKNOWN_ACTION"
      ),
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error("Reseller API failed:", error);
    return NextResponse.json(
      apiError(getErrorMessage(error) || "Internal error.", "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}

/** A friendly answer for anyone who opens the endpoint in a browser. */
export async function GET() {
  return NextResponse.json({
    api: "PinoyBoosting Reseller API",
    version: "v2",
    usage: "POST with an 'action' field: services, balance, add, status, refill.",
    auth: "Send your key as Authorization: Bearer <key>, X-API-Key, or a 'key' body field.",
    docs: "https://pinoyboosting.com/api-docs",
  });
}
