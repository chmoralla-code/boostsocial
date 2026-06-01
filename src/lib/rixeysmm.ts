import { createClient } from "@supabase/supabase-js";
import { parseDescription } from "@/utils/serviceHelpers";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

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

/**
 * Automatically places an order on RixeySMM for any mapped service.
 * Looks up the correct RixeySMM Service ID dynamically from the order or the database services catalog.
 * Saves the response (external order ID or failure reason) in the database.
 */
export async function autoPlaceRixeyOrder(
  orderId: string,
  serviceId: string,
  targetUrl: string,
  quantity: number
) {
  const supabase = getSupabase();

  try {
    console.log(`[RixeySMM] Triggering automated placement for Order ID: ${orderId}`);

    // 1. Load order details to check for an smm_service_id
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("smm_service_id, service_id")
      .eq("id", orderId)
      .maybeSingle();

    if (orderErr) throw orderErr;

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
    } catch (e) {
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
      console.log(`[RixeySMM] Order successfully placed! External ID: ${externalId}`);
    } else if (data.error) {
      // Panel returned a specific error (e.g. low balance, bad link)
      const panelError = `Failed: ${data.error}`;
      await supabase
        .from("orders")
        .update({
          external_status: panelError,
        })
        .eq("id", orderId);
      await syncOrderUpdateToBackups(orderId, { external_status: panelError });
      console.error(`[RixeySMM] SMM Panel returned error: ${data.error}`);
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
      console.error(`[RixeySMM] Unknown SMM response:`, data);
    }
  } catch (err: any) {
    const externalStatus = `Failed: ${err.message || err.toString()}`;
    console.error(`[RixeySMM] Auto-placement failed for Order ${orderId}:`, err);
    await supabase
      .from("orders")
      .update({
        external_status: externalStatus,
      })
      .eq("id", orderId);
    await syncOrderUpdateToBackups(orderId, { external_status: externalStatus });
  }
}
