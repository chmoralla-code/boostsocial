import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "crypto";
import { findAuthUserByEmail } from "@/utils/auth/find-user";
import { enforceRateLimit } from "@/utils/security/rate-limit";

const MAX_ATTEMPTS = 5;

function hashCode(code: string, salt: string) {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

function constantTimeEqual(a: string, b: string) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, {
      key: "verify-otp",
      maxRequests: 10,
      windowMs: 5 * 60 * 1000,
    });
    if (limited) return limited;

    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: "Missing email or code" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Generic error so we never distinguish "no such user" from "wrong code".
    const invalidResponse = NextResponse.json(
      { error: "Invalid or expired verification code. Please request a new one." },
      { status: 400 }
    );

    const user = await findAuthUserByEmail(supabase, cleanEmail);
    if (!user) return invalidResponse;

    const meta = user.user_metadata || {};
    const storedHash = meta.otp_code_hash as string | undefined;
    const storedSalt = meta.otp_salt as string | undefined;
    const legacyPlain = meta.otp_code as string | undefined; // in-flight codes issued before this change
    const expiresAt = meta.otp_expires_at ? Number(meta.otp_expires_at) : 0;
    const attempts = Number(meta.otp_attempts) || 0;

    if (!storedHash && !legacyPlain) {
      return invalidResponse;
    }

    const clearOtp = async () =>
      supabase.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...meta,
          otp_code: null,
          otp_code_hash: null,
          otp_salt: null,
          otp_expires_at: null,
          otp_sent_at: null,
          otp_attempts: 0,
        },
      });

    if (attempts >= MAX_ATTEMPTS) {
      await clearOtp();
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please request a new code." },
        { status: 429 }
      );
    }

    if (Date.now() > expiresAt) {
      await clearOtp();
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const matches = storedHash && storedSalt
      ? constantTimeEqual(storedHash, hashCode(cleanCode, storedSalt))
      : legacyPlain
        ? constantTimeEqual(legacyPlain, cleanCode)
        : false;

    if (!matches) {
      const nextAttempts = attempts + 1;
      if (nextAttempts >= MAX_ATTEMPTS) {
        await clearOtp();
      } else {
        await supabase.auth.admin.updateUserById(user.id, {
          user_metadata: { ...meta, otp_attempts: nextAttempts },
        });
      }
      return invalidResponse;
    }

    // Code is valid — confirm the user's email and clear the OTP.
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      user_metadata: {
        ...meta,
        otp_code: null,
        otp_code_hash: null,
        otp_salt: null,
        otp_expires_at: null,
        otp_sent_at: null,
        otp_attempts: 0,
      },
    });

    if (updateError) {
      console.error("Failed to confirm user email:", updateError);
      return NextResponse.json({ error: "Failed to activate account. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Email verified successfully! You can now sign in."
    });
  } catch (err) {
    console.error("Verify OTP failed:", err);
    return NextResponse.json({ error: "Failed to verify code." }, { status: 500 });
  }
}
