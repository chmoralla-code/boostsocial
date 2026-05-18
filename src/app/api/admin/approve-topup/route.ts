import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { topupId, action } = await req.json(); // action can be 'approve' or 'reject'

    if (!topupId || !action) {
      return NextResponse.json({ error: "Missing topupId or action" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Fetch the topup record
    const { data: topup, error: topupError } = await supabase
      .from("topups")
      .select("*")
      .eq("id", topupId)
      .single();

    if (topupError || !topup) {
      return NextResponse.json({ error: "Top-up request not found" }, { status: 404 });
    }

    if (topup.status !== 'pending') {
      return NextResponse.json({ error: `Top-up is already ${topup.status}` }, { status: 400 });
    }

    if (action === 'approve') {
      // 2. Fetch current profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", topup.user_id)
        .single();

      if (profileError) throw profileError;

      const newBalance = Number(profile.balance || 0) + Number(topup.amount);

      // 3. Update profile balance
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", topup.user_id);

      if (updateProfileError) throw updateProfileError;

      // 4. Update topup status
      const { error: updateTopupError } = await supabase
        .from("topups")
        .update({ status: 'approved' })
        .eq("id", topupId);

      if (updateTopupError) throw updateTopupError;

      return NextResponse.json({ success: true, newBalance });
    } else if (action === 'reject') {
      // Just update topup status
      const { error: updateTopupError } = await supabase
        .from("topups")
        .update({ status: 'rejected' })
        .eq("id", topupId);

      if (updateTopupError) throw updateTopupError;

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (err: any) {
    console.error("Approve topup endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
