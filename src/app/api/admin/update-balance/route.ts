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

    await syncBackupAdminClients(async (db) => {
      return db
        .from("profiles")
        .update({ balance: numericBalance })
        .eq("id", userId);
    }, "balance update");

    return NextResponse.json({ success: true, balance: numericBalance });
  } catch (err: any) {
    console.error("Update balance endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
