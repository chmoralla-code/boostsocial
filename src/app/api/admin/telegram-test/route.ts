import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { bot_token, chat_id } = await req.json();

  if (!bot_token || !chat_id) {
    return NextResponse.json({ error: "Bot token and chat ID are required." }, { status: 400 });
  }

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
