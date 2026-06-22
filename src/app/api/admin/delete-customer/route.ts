import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    let recordsFound = false;

    // 1. Fetch all orders to anonymize them case-insensitively
    const { data: allOrders, error: fetchOrdersError } = await supabase.from("orders").select("id, customer_email");
    if (fetchOrdersError) throw fetchOrdersError;

    const matchingOrderIds = allOrders
      ?.filter(o => o.customer_email && o.customer_email.trim().toLowerCase() === email.trim().toLowerCase())
      .map(o => o.id) || [];

    if (matchingOrderIds.length > 0) {
      recordsFound = true;
      const { error: updateError } = await supabase
        .from("orders")
        .update({ customer_email: "[Deleted User]" })
        .in("id", matchingOrderIds);
      if (updateError) throw updateError;

      await syncBackupAdminClients(async (backupClient) => {
        return backupClient
          .from("orders")
          .update({ customer_email: "[Deleted User]" })
          .in("id", matchingOrderIds);
      }, "customer order anonymization sync");
    }

    // 2. Fetch auth user list to delete the user account if they exist
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = listData.users.find(u => u.email && u.email.trim().toLowerCase() === email.trim().toLowerCase());
    if (user) {
      recordsFound = true;
      
      // Delete from profiles first (just to be safe in case cascade isn't configured correctly)
      await supabase.from("profiles").delete().eq("id", user.id);
      
      // Delete from topups (just in case cascade isn't working)
      await supabase.from("topups").delete().eq("user_id", user.id);

      await syncBackupAdminClients(async (backupClient) => {
        const topupDelete = await backupClient.from("topups").delete().eq("user_id", user.id);
        if (topupDelete.error) return topupDelete;
        const profileDelete = await backupClient.from("profiles").delete().eq("id", user.id);
        if (profileDelete.error) return profileDelete;
        // Also delete auth user from backup databases so the email can be re-registered
        return backupClient.auth.admin.deleteUser(user.id);
      }, "customer full deletion sync (profiles + auth)");

      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
    }

    if (!recordsFound) {
      return NextResponse.json({ error: "No customer records or user account found for this email" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Delete customer endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
