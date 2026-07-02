import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients, getBackupAdminClients } from "@/utils/supabase/dual-db";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Fetch all users
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    // Filter out admin account
    const usersToDelete = listData.users.filter(u => u.email && u.email.trim().toLowerCase() !== "admin@boostsocial.com");

    // 2. Delete each user's auth account, but SOFT-mark the profile so the
    //    email/balance/referral history survives for audit + recovery.
    //    (Previously we hard-deleted profiles + topups, which CASCADE-wiped
    //    the profiles row and the denormalized email/balance — unrecoverable.)
    for (const user of usersToDelete) {
      // Soft-mark the profile row (do NOT delete it)
      try {
        await supabase
          .from("profiles")
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq("id", user.id);
      } catch (e) {
        console.warn(`Failed to soft-mark profile for ${user.email}:`, e);
      }

      // Sync soft-mark to backup databases (do NOT delete profile rows)
      await syncBackupAdminClients(async (backupClient) => {
        return backupClient
          .from("profiles")
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq("id", user.id);
      }, "bulk customer profile soft-delete sync");
      
      // Hard-delete auth user from primary
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id, false);
      if (deleteError) {
        console.error(`Failed to delete auth user ${user.email}:`, deleteError);
      }

      // Hard-delete auth user from ALL backup databases
      for (const backup of getBackupAdminClients()) {
        try {
          await backup.client.auth.admin.deleteUser(user.id, false);
        } catch (backupErr: any) {
          console.warn(`Failed to delete auth user from ${backup.displayName}:`, backupErr.message);
        }
      }
    }

    // 3. Anonymize all orders that are associated with these users or any non-admin email
    const { data: allOrders, error: fetchOrdersError } = await supabase.from("orders").select("id, customer_email");
    if (fetchOrdersError) throw fetchOrdersError;

    const ordersToAnonymize = allOrders
      ?.filter(o => o.customer_email && o.customer_email.trim().toLowerCase() !== "admin@boostsocial.com" && o.customer_email !== "[Deleted User]")
      .map(o => o.id) || [];

    if (ordersToAnonymize.length > 0) {
      const { error: updateError } = await supabase
        .from("orders")
        .update({ customer_email: "[Deleted User]" })
        .in("id", ordersToAnonymize);
      if (updateError) throw updateError;

      await syncBackupAdminClients(async (backupClient) => {
        return backupClient
          .from("orders")
          .update({ customer_email: "[Deleted User]" })
          .in("id", ordersToAnonymize);
      }, "bulk order anonymization sync");
    }

    return NextResponse.json({ success: true, count: usersToDelete.length });
  } catch (err: any) {
    console.error("Delete all accounts endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
