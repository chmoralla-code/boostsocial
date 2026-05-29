import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CONFIG_BUCKET = "receipts";
const TOPUP_CONFIG_PATH = "admin-config/telegram-topup.png";

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

async function getTelegramConfig(): Promise<{ bot_token: string; chat_id: string } | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.storage
      .from(CONFIG_BUCKET)
      .download(TOPUP_CONFIG_PATH);
    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Handle callback queries (inline button presses)
    if (body.callback_query) {
      const callbackQuery = body.callback_query;
      const data = callbackQuery.data as string;
      const chatId = callbackQuery.message?.chat?.id;
      const messageId = callbackQuery.message?.message_id;
      const callbackQueryId = callbackQuery.id;

      const config = await getTelegramConfig();
      if (!config?.bot_token) {
        return NextResponse.json({ ok: true });
      }

      // Parse callback data: topup_approve_{id} or topup_reject_{id}
      const isApprove = data.startsWith("topup_approve_");
      const isReject = data.startsWith("topup_reject_");

      if (!isApprove && !isReject) {
        return NextResponse.json({ ok: true });
      }

      const topupId = data.replace("topup_approve_", "").replace("topup_reject_", "");
      const action = isApprove ? "approve" : "reject";

      const supabase = getSupabase();

      // Fetch the topup record
      const { data: topup, error: topupError } = await supabase
        .from("topups")
        .select("*")
        .eq("id", topupId)
        .single();

      if (topupError || !topup) {
        await answerCallback(config.bot_token, callbackQueryId, "❌ Top-up not found.");
        return NextResponse.json({ ok: true });
      }

      if (topup.status !== "pending") {
        await answerCallback(config.bot_token, callbackQueryId, `⚠️ Already ${topup.status}.`);
        // Remove buttons since it's already processed
        await removeButtons(config.bot_token, chatId, messageId);
        return NextResponse.json({ ok: true });
      }

      if (action === "approve") {
        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("balance, referred_by")
          .eq("id", topup.user_id)
          .single();

        if (profileError || !profile) {
          await answerCallback(config.bot_token, callbackQueryId, "❌ User profile not found.");
          return NextResponse.json({ ok: true });
        }

        const topupAmount = Number(topup.amount);
        const newBalance = Number(profile.balance || 0) + topupAmount;

        // Update profile balance
        await supabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("id", topup.user_id);

        // Update topup status
        await supabase
          .from("topups")
          .update({ status: "approved" })
          .eq("id", topupId);

        // Handle referral commission (10%)
        if (profile.referred_by) {
          const commission = topupAmount * 0.10;
          const { data: referrer } = await supabase
            .from("profiles")
            .select("balance")
            .eq("id", profile.referred_by)
            .single();

          if (referrer) {
            const referrerNewBalance = Number(referrer.balance || 0) + commission;
            await supabase
              .from("profiles")
              .update({ balance: referrerNewBalance })
              .eq("id", profile.referred_by);

            await supabase
              .from("referral_transactions")
              .insert([{
                referrer_id: profile.referred_by,
                referee_id: topup.user_id,
                amount: commission,
                description: `10% referral commission from approved top-up of ₱${topupAmount.toFixed(2)}`
              }]);
          }
        }

        // Answer callback and update message
        await answerCallback(config.bot_token, callbackQueryId, `✅ Approved! ₱${topupAmount.toFixed(2)} credited.`);
        await editCaption(
          config.bot_token, chatId, messageId,
          `✅ TOP-UP APPROVED\n\n` +
          `👤 Customer: ${topup.email}\n` +
          `💵 Amount: ₱${topupAmount.toFixed(2)}\n` +
          `💰 New Balance: ₱${newBalance.toFixed(2)}\n\n` +
          `Approved via Telegram by Admin.`
        );
      } else {
        // Reject
        await supabase
          .from("topups")
          .update({ status: "rejected" })
          .eq("id", topupId);

        await answerCallback(config.bot_token, callbackQueryId, "❌ Top-up rejected.");
        await editCaption(
          config.bot_token, chatId, messageId,
          `❌ TOP-UP REJECTED\n\n` +
          `👤 Customer: ${topup.email}\n` +
          `💵 Amount: ₱${Number(topup.amount).toFixed(2)}\n\n` +
          `Rejected via Telegram by Admin.`
        );
      }

      // Remove inline buttons after action
      await removeButtons(config.bot_token, chatId, messageId);

      return NextResponse.json({ ok: true });
    }

    // Default: acknowledge any other update
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

// Helper: Answer inline callback query (shows toast on Telegram)
async function answerCallback(botToken: string, callbackQueryId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: true }),
  });
}

// Helper: Edit the photo caption to show final status
async function editCaption(botToken: string, chatId: number, messageId: number, caption: string) {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageCaption`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, caption }),
  });
}

// Helper: Remove inline keyboard buttons after action
async function removeButtons(botToken: string, chatId: number, messageId: number) {
  await fetch(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
  });
}
