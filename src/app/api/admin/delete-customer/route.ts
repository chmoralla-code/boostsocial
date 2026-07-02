import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients, getBackupAdminClients } from "@/utils/supabase/dual-db";

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
      
      // SOFT-DELETE the profile row (mark deleted_at) instead of hard-deleting it.
      // Previously we did `profiles.delete().eq("id", user.id)` which destroyed the
      // denormalized email/balance/referral_code/VIP — and the auth-user delete then
      // CASCADE-deleted it anyway. Now we preserve the profile row for audit/recovery.
      try {
        await supabase
          .from("profiles")
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq("id", user.id);
      } catch (e) {
        console.warn("Failed to soft-mark customer profile:", e);
      }
      
      // Soft-mark on backup databases too (do NOT delete the profile row).
      await syncBackupAdminClients(async (backupClient) => {
        const profileMark = await backupClient
          .from("profiles")
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq("id", user.id);
        if (profileMark.error) return profileMark;
        // Also anonymize this customer's topups? No — keep topups for audit,
        // just mark the user gone.
        return { error: null };
      }, "customer profile soft-delete sync");

      // Hard-delete auth user from primary (shouldSoftDelete: false = permanent removal)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id, false);
      if (deleteError) throw deleteError;

      // Hard-delete auth user from ALL backup databases using real Supabase clients
      // (syncBackupAdminClients passes mock clients without .auth, so we iterate directly)
      for (const backup of getBackupAdminClients()) {
        try {
          await backup.client.auth.admin.deleteUser(user.id, false);
          console.log(`Hard-deleted auth user from ${backup.displayName}`);
        } catch (backupErr: any) {
          console.warn(`Failed to delete auth user from ${backup.displayName}:`, backupErr.message);
        }
      }
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
