import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// In-memory OTP store: email → { code, expiresAt }
const otpStore = new Map<string, { code: string; expiresAt: number }>();
const OTP_EXPIRY_MS = 5 * 60 * 1000;

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore) {
    if (data.expiresAt < now) otpStore.delete(email);
  }
}, 5 * 60 * 1000);

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: "Missing email or code" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Look up OTP
    const stored = otpStore.get(cleanEmail);
    if (!stored) {
      return NextResponse.json({ error: "No verification code found. Please request a new one." }, { status: 400 });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(cleanEmail);
      return NextResponse.json({ error: "Verification code has expired. Please request a new one." }, { status: 400 });
    }

    if (stored.code !== code.trim()) {
      return NextResponse.json({ error: "Invalid verification code. Please check and try again." }, { status: 400 });
    }

    // Code is valid — confirm the user's email via Admin API
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

    // Update the user to mark email as confirmed
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error("Failed to confirm user email:", updateError);
      return NextResponse.json({ error: "Failed to activate account. Please try again." }, { status: 500 });
    }

    // Clean up OTP
    otpStore.delete(cleanEmail);

    return NextResponse.json({
      success: true,
      message: "Email verified successfully! You can now sign in."
    });
  } catch (err: any) {
    console.error("Verify OTP failed:", err);
    return NextResponse.json({ error: err.message || "Network error" }, { status: 500 });
  }
}
