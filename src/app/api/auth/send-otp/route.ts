import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Find the user by email
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users?.users.find(
      (u) => u.email && u.email.toLowerCase() === cleanEmail
    );

    if (!user) {
      return NextResponse.json({ error: "User not found. Please register first." }, { status: 400 });
    }

    // Rate limit: check last OTP sent time from user_metadata
    const meta = user.user_metadata || {};
    const lastSent = meta.otp_sent_at ? Number(meta.otp_sent_at) : 0;
    const elapsed = Date.now() - lastSent;
    const cooldownMs = 30000; // 30 seconds

    if (lastSent > 0 && elapsed < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - elapsed) / 1000);
      return NextResponse.json({
        error: "rate_limited",
        message: `Please wait ${remaining}s before requesting a new code.`,
        remaining
      }, { status: 429 });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in user_metadata (persistent across serverless instances)
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...meta,
        otp_code: code,
        otp_expires_at: Date.now() + OTP_EXPIRY_MS,
        otp_sent_at: Date.now()
      }
    });

    if (updateError) {
      console.error("Failed to store OTP:", updateError);
      return NextResponse.json({ error: "Failed to send verification code." }, { status: 500 });
    }

    // Send via Resend API
    const resendKey = "re_hDykSiph_NBT7jK2kZbp4QM7d2a8ciNga";
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "CYNETWORK <noreply@pinoyboosting.com>",
        to: cleanEmail,
        subject: "Your CYNETWORK verification code",
        text: `Your verification code is: ${code}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this, please ignore this email.`
      })
    });

    if (!sendRes.ok) {
      const err = await sendRes.json();
      console.error("Resend send failed:", err);
      // Clear OTP from metadata
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { ...meta, otp_code: null, otp_expires_at: null, otp_sent_at: null }
      });
      return NextResponse.json({ error: "Failed to send verification code. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Verification code sent to your email." });
  } catch (err: any) {
    console.error("Send OTP failed:", err);
    return NextResponse.json({ error: err.message || "Network error" }, { status: 500 });
  }
}
