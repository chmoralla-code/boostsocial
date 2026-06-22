import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: "Missing email or code" }, { status: 400 });
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

    // Read OTP from user_metadata (persistent across serverless instances)
    const meta = user.user_metadata || {};
    const storedCode = meta.otp_code;
    const expiresAt = meta.otp_expires_at ? Number(meta.otp_expires_at) : 0;

    if (!storedCode) {
      return NextResponse.json({ error: "No verification code found. Please request a new one." }, { status: 400 });
    }

    if (Date.now() > expiresAt) {
      // Clear expired OTP
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { ...meta, otp_code: null, otp_expires_at: null, otp_sent_at: null }
      });
      return NextResponse.json({ error: "Verification code has expired. Please request a new one." }, { status: 400 });
    }

    if (storedCode !== code.trim()) {
      return NextResponse.json({ error: "Invalid verification code. Please check and try again." }, { status: 400 });
    }

    // Code is valid — confirm the user's email
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { 
        email_confirm: true,
        user_metadata: { ...meta, otp_code: null, otp_expires_at: null, otp_sent_at: null }
      }
    );

    if (updateError) {
      console.error("Failed to confirm user email:", updateError);
      return NextResponse.json({ error: "Failed to activate account. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Email verified successfully! You can now sign in."
    });
  } catch (err: any) {
    console.error("Verify OTP failed:", err);
    return NextResponse.json({ error: err.message || "Network error" }, { status: 500 });
  }
}
