import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
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
      return NextResponse.json({
        success: true,
        message: "A new confirmation email has been sent. Please check your inbox (and spam folder)."
      });
    }

    const body = await res.json();
    return NextResponse.json({
      error: body.msg || body.error || "Failed to resend confirmation email. Please try again later."
    }, { status: 400 });
  } catch (err: any) {
    console.error("Resend confirmation endpoint failed:", err);
    return NextResponse.json({ error: err.message || "Network error" }, { status: 500 });
  }
}
