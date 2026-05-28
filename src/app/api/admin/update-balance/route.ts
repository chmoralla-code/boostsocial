import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ balance: numericBalance })
      .eq("id", userId);

    if (updateError) throw updateError;

    const backupSupabaseUrl = process.env.BACKUP_SUPABASE_URL;
    const backupServiceRoleKey = process.env.BACKUP_SUPABASE_SERVICE_ROLE_KEY;
    if (backupSupabaseUrl && backupServiceRoleKey) {
      try {
        const backupSupabase = createClient(backupSupabaseUrl, backupServiceRoleKey, {
          auth: { persistSession: false }
        });
        await backupSupabase
          .from("profiles")
          .update({ balance: numericBalance })
          .eq("id", userId);
      } catch (backupErr) {
        console.error("Backup DB balance update failed:", backupErr);
      }
    }

    return NextResponse.json({ success: true, balance: numericBalance });
  } catch (err: any) {
    console.error("Update balance endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
