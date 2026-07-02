import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

export async function POST(req: NextRequest) {
  try {
    const { userId, balance } = await req.json();

    if (!userId || balance === undefined) {
      return NextResponse.json({ error: "Missing userId or balance" }, { status: 400 });
    }

    const numericBalance = Number(balance);
    if (isNaN(numericBalance) || numericBalance < 0) {
      return NextResponse.json({ error: "Balance must be a non-negative number" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Write directly to PRIMARY Supabase first (this is the DB the admin
    //    dashboard reads from on reload). Verify the row actually matched so
    //    we never return success when zero rows were updated.
    const { data: updated, error: primaryError } = await supabase
      .from("profiles")
      .update({ balance: numericBalance })
      .eq("id", userId)
      .select("id, email, balance")
      .single();

    if (primaryError) {
      console.error("Update balance: primary Supabase write failed:", primaryError);
      return NextResponse.json(
        { error: `Primary database update failed: ${primaryError.message}` },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "No profile found for that user id — balance was not changed." },
        { status: 404 }
      );
    }

    // 2. Best-effort sync to DigitalOcean + backup Supabase projects.
    //    These failures must NOT flip a successful primary write to an error,
    //    but we log them so we can spot replication drift.
    try {
      await syncBackupAdminClients(async (db) => {
        return db
          .from("profiles")
          .update({ balance: numericBalance })
          .eq("id", userId);
      }, "balance update");
    } catch (backupErr) {
      console.warn("Update balance: backup sync failed (primary still updated):", backupErr);
    }

    return NextResponse.json({ success: true, balance: numericBalance, profile: updated });
  } catch (err: any) {
    console.error("Update balance endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
