import { createClient } from "@supabase/supabase-js";

const FOLLOWERS_SERVICE_ID = "6ef1e136-c2c8-4719-8c12-b0f20504d15e";
const RIXEYSMM_SERVICE_ID = "1141";
const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

/**
 * Automatically places an order on RixeySMM for the Facebook Followers service.
 * Only triggers if the serviceId matches the defined Followers service.
 * Saves the response (external order ID or failure reason) in the database.
 */
export async function autoPlaceRixeyOrder(
  orderId: string,
  serviceId: string,
  targetUrl: string,
  quantity: number
) {
  // 1. Strict guard: only process for FB FOLLOWERS service
  if (serviceId !== FOLLOWERS_SERVICE_ID) {
    return;
  }

  const supabase = getSupabase();

  try {
    console.log(`[RixeySMM] Triggering automated placement for Order ID: ${orderId}`);

    // 2. Read SMM API key
    const apiKey = process.env.RIXEYSMM_API_KEY;
    if (!apiKey) {
      const errorMsg = "Failed: RixeySMM API Key is missing in environment variables.";
      console.error(`[RixeySMM] ${errorMsg}`);
      await supabase
        .from("orders")
        .update({ external_status: errorMsg })
        .eq("id", orderId);
      return;
    }

    // Clean up target URL if it has pre-made specs formatting (just in case)
    let cleanUrl = targetUrl.trim();
    if (cleanUrl.includes("Page Wants:")) {
      // If it contains specs (shouldn't happen for direct followers but let's be robust)
      const linkMatch = cleanUrl.match(/\[FB Admin:\s*([^\]]+)\]/);
      if (linkMatch && linkMatch[1]) {
        cleanUrl = linkMatch[1];
      }
    }

    // 3. Make form-urlencoded request to RixeySMM API
    const response = await fetch(RIXEYSMM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        key: apiKey,
        action: "add",
        service: RIXEYSMM_SERVICE_ID,
        link: cleanUrl,
        quantity: String(quantity),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[RixeySMM] Response for Order ${orderId}:`, data);

    // 4. Handle SMM Panel API responses
    if (data.order) {
      // Order placed successfully
      const externalId = String(data.order);
      await supabase
        .from("orders")
        .update({
          external_order_id: externalId,
          external_status: "Pending", // SMM panel starts in Pending
        })
        .eq("id", orderId);
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
      console.error(`[RixeySMM] Unknown SMM response:`, data);
    }
  } catch (err: any) {
    console.error(`[RixeySMM] Auto-placement failed for Order ${orderId}:`, err);
    await supabase
      .from("orders")
      .update({
        external_status: `Failed: ${err.message || err.toString()}`,
      })
      .eq("id", orderId);
  }
}
