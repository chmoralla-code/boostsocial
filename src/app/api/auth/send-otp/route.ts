import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";
import { findAuthUserByEmail } from "@/utils/auth/find-user";
import { enforceRateLimit } from "@/utils/security/rate-limit";

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const COOLDOWN_MS = 30_000; // 30 seconds

// Generic response returned whether or not the account exists, to avoid
// leaking which emails are registered (user enumeration).
const GENERIC_SENT = {
  success: true,
  message: "If an account exists for that email, a verification code has been sent.",
};

function hashCode(code: string, salt: string) {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, {
      key: "send-otp",
      maxRequests: 5,
      windowMs: 5 * 60 * 1000,
    });
    if (limited) return limited;

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const resendKey = process.env.RESEND_API_KEY;

    if (!supabaseUrl || !serviceRoleKey || !resendKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Find the user by email (paginated — listUsers() alone only sees page 1).
    const user = await findAuthUserByEmail(supabase, cleanEmail);

    // Do not reveal whether the account exists.
    if (!user) {
      return NextResponse.json(GENERIC_SENT);
    }

    // Rate limit: check last OTP sent time from user_metadata
    const meta = user.user_metadata || {};
    const lastSent = meta.otp_sent_at ? Number(meta.otp_sent_at) : 0;
    const elapsed = Date.now() - lastSent;

    if (lastSent > 0 && elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      return NextResponse.json({
        error: "rate_limited",
        message: `Please wait ${remaining}s before requesting a new code.`,
        remaining
      }, { status: 429 });
    }

    // Generate 6-digit code and store only a salted hash.
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = randomBytes(16).toString("hex");

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...meta,
        otp_code: null,
        otp_code_hash: hashCode(code, salt),
        otp_salt: salt,
        otp_expires_at: Date.now() + OTP_EXPIRY_MS,
        otp_sent_at: Date.now(),
        otp_attempts: 0
      }
    });

    if (updateError) {
      console.error("Failed to store OTP:", updateError);
      return NextResponse.json({ error: "Failed to send verification code." }, { status: 500 });
    }

    // Send via Resend API
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
      console.error("Resend send failed with status:", sendRes.status);
      // Clear OTP from metadata
      await supabase.auth.admin.updateUserById(user.id, {
        user_metadata: { ...meta, otp_code: null, otp_code_hash: null, otp_salt: null, otp_expires_at: null, otp_sent_at: null, otp_attempts: 0 }
      });
      return NextResponse.json({ error: "Failed to send verification code. Please try again." }, { status: 500 });
    }

    return NextResponse.json(GENERIC_SENT);
  } catch (err) {
    console.error("Send OTP failed:", err);
    return NextResponse.json({ error: "Failed to send verification code." }, { status: 500 });
  }
}
