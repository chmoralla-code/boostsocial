import { NextRequest, NextResponse } from "next/server";

// Track last resend attempt per email to enforce server-side cooldown
const resendCooldowns = new Map<string, number>();
const COOLDOWN_MS = 60_000; // 60 seconds between resends

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Server-side cooldown check
    const lastAttempt = resendCooldowns.get(cleanEmail);
    if (lastAttempt && Date.now() - lastAttempt < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastAttempt)) / 1000);
      return NextResponse.json({
        error: `rate_limited`,
        message: `Please wait ${remaining} seconds before requesting another email.`,
        remaining
      }, { status: 429 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    // Call GoTrue resend endpoint to send a new confirmation email
    const res = await fetch(`${supabaseUrl}/auth/v1/resend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey
      },
      body: JSON.stringify({
        type: "signup",
        email: cleanEmail
      })
    });

    if (res.ok) {
      resendCooldowns.set(cleanEmail, Date.now());
      // Clean up old entries after 5 minutes
      setTimeout(() => resendCooldowns.delete(cleanEmail), 300_000);
      return NextResponse.json({
        success: true,
        message: "A new confirmation email has been sent. Please check your inbox (and spam folder)."
      });
    }

    // Handle rate limit errors from Supabase specifically
    if (res.status === 429) {
      return NextResponse.json({
        error: `rate_limited`,
        message: "Email rate limit reached. Please wait a minute before trying again.",
        remaining: 60
      }, { status: 429 });
    }

    const body = await res.json();
    return NextResponse.json({
      error: "general",
      message: body.msg || body.error || "Failed to resend confirmation email. Please try again later."
    }, { status: 400 });
  } catch (err: any) {
    console.error("Resend confirmation endpoint failed:", err);
    return NextResponse.json({ error: "general", message: "Network error. Please try again." }, { status: 500 });
  }
}
