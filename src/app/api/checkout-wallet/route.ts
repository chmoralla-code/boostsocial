import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { userId, serviceId, email, url, quantity, totalPrice } = await req.json();

    if (!userId || !serviceId || !email || !url || !quantity || !totalPrice) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Fetch current profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;

    const currentBalance = Number(profile.balance || 0);
    const cost = Number(totalPrice);

    if (currentBalance < cost) {
      return NextResponse.json({ error: "Insufficient wallet balance" }, { status: 400 });
    }

    // 2. Deduct balance
    const newBalance = currentBalance - cost;
    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", userId);

    if (updateProfileError) throw updateProfileError;

    // 3. Create the order with 'Processing' status automatically
    const { data: order, error: insertError } = await supabase
      .from('orders')
      .insert([
        {
          service_id: serviceId,
          customer_email: email.trim(),
          target_url: url.trim(),
          amount: cost,
          status: 'Processing', // Instant processing for wallet payments
          payment_method: 'Wallet',
          quantity: quantity
        }
      ])
      .select('id')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, orderId: order.id, newBalance });

  } catch (err: any) {
    console.error("Wallet checkout endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
