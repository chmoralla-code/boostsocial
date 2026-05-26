import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderNotification } from "@/lib/telegram";
import { autoPlaceRixeyOrder } from "@/lib/rixeysmm";

export async function POST(req: NextRequest) {
  try {
    const { userId, serviceId, email, url, quantity, totalPrice, serviceTitle, smmServiceId } = await req.json();

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
    const cost = Math.max(Number(totalPrice), 5.00); // Enforce minimum cost of ₱5.00 on the server side

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

    const backupSupabaseUrl = process.env.BACKUP_SUPABASE_URL;
    const backupServiceRoleKey = process.env.BACKUP_SUPABASE_SERVICE_ROLE_KEY;
    const backupSupabase = backupSupabaseUrl && backupServiceRoleKey
      ? createClient(backupSupabaseUrl, backupServiceRoleKey, { auth: { persistSession: false } })
      : null;

    if (backupSupabase) {
      try {
        await backupSupabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", userId);
      } catch (backupErr) {
        console.error("Backup DB balance deduction failed:", backupErr);
      }
    }

    // 3. Create the order with 'Pending' status (admin approval required first)
    const { data: order, error: insertError } = await supabase
      .from('orders')
      .insert([
        {
          service_id: serviceId,
          customer_email: email.trim(),
          target_url: url.trim(),
          amount: cost,
          status: 'Pending',
          payment_method: 'Wallet',
          quantity: quantity,
          smm_service_id: smmServiceId || null
        }
      ])
      .select('id')
      .single();

    if (insertError) throw insertError;

    if (backupSupabase) {
      try {
        await backupSupabase
          .from('orders')
          .insert([
            {
              id: order.id, // Keep the same UUID!
              service_id: serviceId,
              customer_email: email.trim(),
              target_url: url.trim(),
              amount: cost,
              status: 'Pending',
              payment_method: 'Wallet',
              quantity: quantity,
              smm_service_id: smmServiceId || null
            }
          ]);
      } catch (backupErr) {
        console.error("Backup DB order insert failed:", backupErr);
      }
    }

    // 5. Fire Telegram notification (non-blocking)
    sendOrderNotification({
      trackingId: `BS-${order.id.slice(0, 8).toUpperCase()}`,
      service: serviceTitle || serviceId,
      email: email.trim(),
      quantity,
      amount: cost,
      paymentMethod: "💳 Wallet",
      details: url.trim(),
    });

    return NextResponse.json({ success: true, orderId: order.id, newBalance });

  } catch (err: any) {
    console.error("Wallet checkout endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
