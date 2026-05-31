import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

export async function POST(req: NextRequest) {
  try {
    const { topupId, action, amount } = await req.json(); // action can be 'approve' or 'reject'

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
      if (!topup.receipt_url) {
        return NextResponse.json({ error: "Cannot approve a top-up without a receipt proof." }, { status: 400 });
      }

      // 2. Fetch current profile including who referred them
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("balance, referred_by")
        .eq("id", topup.user_id)
        .single();

      if (profileError) throw profileError;

      let finalAmount = Number(topup.amount);
      if (amount !== undefined) {
        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount < 0) {
          return NextResponse.json({ error: "Amount must be a non-negative number" }, { status: 400 });
        }
        
        // Update top-up amount in the database
        const { error: amtError } = await supabase
          .from("topups")
          .update({ amount: numericAmount })
          .eq("id", topupId);
        
        if (amtError) throw amtError;
        finalAmount = numericAmount;
      }

      const newBalance = Number(profile.balance || 0) + finalAmount;

      // 3. Update profile balance
      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("id", topup.user_id);

      if (updateProfileError) throw updateProfileError;

      await syncBackupAdminClients(async (backupClient) => {
        await backupClient
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", topup.user_id);
      }, "top-up profile balance sync");

      // 4. Update topup status
      const { error: updateTopupError } = await supabase
        .from("topups")
        .update({ status: 'approved' })
        .eq("id", topupId);

      if (updateTopupError) throw updateTopupError;

      await syncBackupAdminClients(async (backupClient) => {
        await backupClient
          .from("topups")
          .update({ status: 'approved', amount: finalAmount })
          .eq("id", topupId);
      }, "top-up approval sync");

      // 5. Calculate & credit referral commission if referred
      if (profile.referred_by) {
        const commission = finalAmount * 0.10;
        
        // Fetch referrer's current balance
        const { data: referrer, error: referrerError } = await supabase
          .from("profiles")
          .select("balance")
          .eq("id", profile.referred_by)
          .single();

        if (referrer && !referrerError) {
          const referrerNewBalance = Number(referrer.balance || 0) + commission;
          
          // Update referrer balance
          const { error: updateReferrerError } = await supabase
            .from("profiles")
            .update({ balance: referrerNewBalance })
            .eq("id", profile.referred_by);

          if (!updateReferrerError) {
            // Log referral transaction
            await supabase
              .from("referral_transactions")
              .insert([
                {
                  referrer_id: profile.referred_by,
                  referee_id: topup.user_id,
                  amount: commission,
                  description: `10% referral commission from approved GCash top-up of ₱${finalAmount.toFixed(2)}`
                }
              ]);
          } else {
            console.error("Failed to update referrer balance:", updateReferrerError);
          }
        }
      }

      return NextResponse.json({ success: true, newBalance });
    } else if (action === 'reject') {
      // Just update topup status
      const { error: updateTopupError } = await supabase
        .from("topups")
        .update({ status: 'rejected' })
        .eq("id", topupId);

      if (updateTopupError) throw updateTopupError;

      await syncBackupAdminClients(async (backupClient) => {
        await backupClient
          .from("topups")
          .update({ status: 'rejected' })
          .eq("id", topupId);
      }, "top-up rejection sync");

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (err: any) {
    console.error("Approve topup endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
