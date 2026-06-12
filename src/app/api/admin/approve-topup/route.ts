import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncBackupAdminClients, fallbackRead } from "@/utils/supabase/dual-db";
import { creditReferralCommission } from "@/utils/referrals";
import { notifyCustomer } from "@/lib/customerNotifications";

type TopupApprovalRow = {
  user_id: string;
  email: string;
  amount: number | string;
  new_balance: number | string;
};

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
    const { data: topup, error: topupError } = await fallbackRead(async (db) => {
      return db
        .from("topups")
        .select("*")
        .eq("id", topupId)
        .single();
    });

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

      let finalAmount = Number(topup.amount);
      if (amount !== undefined) {
        const numericAmount = Number(amount);
        if (isNaN(numericAmount) || numericAmount < 0) {
          return NextResponse.json({ error: "Amount must be a non-negative number" }, { status: 400 });
        }
        finalAmount = numericAmount;
      }

      const { data: approvalRows, error: approvalError } = await supabase.rpc("approve_topup_atomic", {
        p_topup_id: topupId,
        p_amount: finalAmount,
        p_reviewed_by: "admin",
      });

      if (approvalError) throw approvalError;

      const approval = Array.isArray(approvalRows)
        ? approvalRows[0] as TopupApprovalRow | undefined
        : approvalRows as TopupApprovalRow | undefined;

      if (!approval) {
        return NextResponse.json({ error: "Top-up approval did not complete." }, { status: 500 });
      }

      finalAmount = Number(approval.amount);
      const newBalance = Number(approval.new_balance);

      // 3. Sync profile balance to backup databases after the primary atomic update
      await syncBackupAdminClients(async (db) => {
        return db
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", approval.user_id);
      }, "top-up profile balance sync");

      // 4. Update topup status
      await syncBackupAdminClients(async (db) => {
        return db
          .from("topups")
          .update({ status: 'approved', amount: finalAmount })
          .eq("id", topupId);
      }, "top-up approval sync");

      try {
        await creditReferralCommission({
          primaryClient: supabase,
          customerId: approval.user_id,
          source: "topup",
          amount: finalAmount,
          referenceId: topupId,
        });
      } catch (commissionError) {
        console.error("Top-up referral commission failed:", commissionError);
      }

      notifyCustomer({
        client: supabase,
        email: approval.email || topup.email,
        message: `System update: Your PHP ${finalAmount.toFixed(2)} wallet top-up was approved and credited. New balance: PHP ${newBalance.toFixed(2)}.`,
      }).catch((notificationErr) => {
        console.error("Top-up approval customer notification failed:", notificationErr);
      });

      return NextResponse.json({ success: true, newBalance });
    } else if (action === 'reject') {
      // Just update topup status
      await syncBackupAdminClients(async (db) => {
        return db
          .from("topups")
          .update({ status: 'rejected' })
          .eq("id", topupId);
      }, "top-up rejection sync");

      notifyCustomer({
        client: supabase,
        email: topup.email,
        message: `System update: Your PHP ${Number(topup.amount).toFixed(2)} wallet top-up was rejected. Please contact support if the receipt or amount needs correction.`,
      }).catch((notificationErr) => {
        console.error("Top-up rejection customer notification failed:", notificationErr);
      });

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (err: any) {
    console.error("Approve topup endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
