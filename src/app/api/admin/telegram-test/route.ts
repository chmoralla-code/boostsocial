import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { bot_token, chat_id, test_topup } = await req.json();

  if (!bot_token || !chat_id) {
    return NextResponse.json({ error: "Bot token and chat ID are required." }, { status: 400 });
  }

  // Test Top-Up Notification mode — sends a photo with approve/reject buttons
  if (test_topup) {
    const phTime = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });

    const caption =
      `🧪 TEST Top-Up Notification\n\n` +
      `👤 Customer: test@pinoyboosting.com\n` +
      `💵 Amount: ₱500.00\n` +
      `🕐 Time: ${phTime} PHT\n\n` +
      `⬇️ Tap a button below to test approve/reject.\n` +
      `(This is a test — no balance will be changed)`;

    const res = await fetch(`https://api.telegram.org/bot${bot_token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Camponotus_flavomarginatus_ant.jpg/320px-Camponotus_flavomarginatus_ant.jpg",
        caption: caption,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Approve Top-Up", callback_data: `topup_approve_TEST` },
              { text: "❌ Reject", callback_data: `topup_reject_TEST` }
            ]
          ]
        }
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      return NextResponse.json({ error: data.description || "Telegram API error" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  }

  // Standard connection test message
  const message = `🤖 *BoostSocial Bot Test*\n\n✅ Connection successful\\!\nYour Telegram notifications are configured correctly\\.\n\n🕐 Tested at: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} PHT`;

  const res = await fetch(`https://api.telegram.org/bot${bot_token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id,
      text: message,
      parse_mode: "MarkdownV2",
    }),
  });

  const data = await res.json();
  if (!data.ok) {
    return NextResponse.json({ error: data.description || "Telegram API error" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
