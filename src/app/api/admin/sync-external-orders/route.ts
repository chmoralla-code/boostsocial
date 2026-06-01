import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderCompleteNotification } from "@/lib/telegram";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { resolveSmmServiceTitle } from "@/lib/smmServiceResolver";

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.RIXEYSMM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RixeySMM API Key is not configured." }, { status: 500 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Fetch all orders that are currently "Processing" and have an active RixeySMM Order ID (including all details for notification)
    const { data: activeOrders, error: fetchError } = await supabase
      .from("orders")
      .select(`
        id, 
        status, 
        external_order_id, 
        external_status,
        customer_email,
        target_url,
        quantity,
        amount,
        payment_method,
        smm_service_id,
        services (
          title
        )
      `)
      .eq("status", "Processing")
      .not("external_order_id", "is", null);

    if (fetchError) {
      throw fetchError;
    }

    if (!activeOrders || activeOrders.length === 0) {
      return NextResponse.json({ success: true, updatedCount: 0, message: "No active external orders to sync." });
    }

    let updatedCount = 0;
    const syncResults: any[] = [];

    // 2. Poll the status for each active order (run concurrently)
    await Promise.all(
      activeOrders.map(async (order) => {
        try {
          const res = await fetch(RIXEYSMM_API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              key: apiKey,
              action: "status",
              order: order.external_order_id!,
            }),
          });

          if (!res.ok) {
            throw new Error(`SMM API returned status code ${res.status}`);
          }

          const data = await res.json();
          if (data.error) {
            throw new Error(data.error);
          }

          const externalStatus = data.status; // e.g. "Pending", "In progress", "Completed", "Canceled"
          let dbStatusUpdate = order.status;
          let externalStatusUpdate = externalStatus || order.external_status;

          // Map SMM Panel status to local order status
          if (externalStatus === "Completed") {
            dbStatusUpdate = "Completed";
            externalStatusUpdate = "Completed";
          } else if (externalStatus === "Canceled" || externalStatus === "Cancelled") {
            dbStatusUpdate = "Cancelled";
            externalStatusUpdate = "Canceled";
          } else if (externalStatus === "In progress" || externalStatus === "Processing") {
            externalStatusUpdate = "In progress";
          } else if (externalStatus === "Pending") {
            externalStatusUpdate = "Pending";
          } else if (externalStatus === "Partial") {
            externalStatusUpdate = "Partial";
          }

          // If there is any change, write to database
          if (dbStatusUpdate !== order.status || externalStatusUpdate !== order.external_status) {
            const { error: updateError } = await supabase
              .from("orders")
              .update({
                status: dbStatusUpdate,
                external_status: externalStatusUpdate,
              })
              .eq("id", order.id);

            if (updateError) {
              console.error(`Failed to update order ${order.id} in DB:`, updateError);
            } else {
              await syncBackupAdminClients(async (backupClient) => {
                return backupClient
                  .from("orders")
                  .update({
                    status: dbStatusUpdate,
                    external_status: externalStatusUpdate,
                  })
                  .eq("id", order.id);
              }, "external order status sync");

              updatedCount++;
              syncResults.push({
                id: order.id,
                oldStatus: order.status,
                newStatus: dbStatusUpdate,
                externalStatus: externalStatusUpdate,
              });

              // Fire order complete Telegram notification!
              if (dbStatusUpdate === "Completed") {
                const serviceTitle = (order as any).services?.title || "SMM Service";
                const resolvedServiceTitle = await resolveSmmServiceTitle((order as any).smm_service_id, serviceTitle);
                sendOrderCompleteNotification({
                  trackingId: `BS-${order.id.slice(0, 8).toUpperCase()}`,
                  service: resolvedServiceTitle,
                  email: order.customer_email,
                  quantity: order.quantity,
                  amount: Number(order.amount),
                  paymentMethod: order.payment_method || "GCash",
                  details: order.target_url,
                }).catch((err) => {
                  console.error(`Async sendOrderCompleteNotification failed for order ${order.id} in sync:`, err);
                });
              }
            }
          }
        } catch (err: any) {
          console.error(`Error syncing SMM order ${order.external_order_id} for order ${order.id}:`, err);
        }
      })
    );

    return NextResponse.json({
      success: true,
      updatedCount,
      syncResults,
    });

  } catch (err: any) {
    console.error("Sync external orders endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
