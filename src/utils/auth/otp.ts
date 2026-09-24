import { createHash, randomBytes } from "crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { AUTH_EMAIL_BRAND, sendAuthEmail } from "@/utils/auth/email";

export const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const OTP_COOLDOWN_MS = 30_000; // 30 seconds

export function hashOtpCode(code: string, salt: string) {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

export function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

type SendOtpResult =
  | { ok: true; cooldownRemaining?: undefined }
  | { ok: false; error: "rate_limited"; remaining: number }
  | { ok: false; error: "config" | "store" | "email"; message: string };

/**
 * Store a salted OTP hash on the auth user and email the plaintext code via Resend.
 * Prefer calling this with a known user (e.g. right after admin.createUser).
 */
export async function storeAndSendOtp(
  supabase: SupabaseClient,
  user: User,
  email: string,
  options?: { skipCooldown?: boolean }
): Promise<SendOtpResult> {
  const cleanEmail = email.trim().toLowerCase();
  const meta = user.user_metadata || {};
  const lastSent = meta.otp_sent_at ? Number(meta.otp_sent_at) : 0;
  const elapsed = Date.now() - lastSent;

  if (!options?.skipCooldown && lastSent > 0 && elapsed < OTP_COOLDOWN_MS) {
    const remaining = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
    return { ok: false, error: "rate_limited", remaining };
  }

  const code = generateOtpCode();
  const salt = randomBytes(16).toString("hex");

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      otp_code: null,
      otp_code_hash: hashOtpCode(code, salt),
      otp_salt: salt,
      otp_expires_at: Date.now() + OTP_EXPIRY_MS,
      otp_sent_at: Date.now(),
      otp_attempts: 0,
    },
  });

  if (updateError) {
    console.error("Failed to store OTP:", updateError);
    return { ok: false, error: "store", message: "Failed to send verification code." };
  }

  const emailResult = await sendAuthEmail({
    to: cleanEmail,
    subject: `Your ${AUTH_EMAIL_BRAND} verification code`,
    text: `Your verification code is: ${code}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this, please ignore this email.\n\n— ${AUTH_EMAIL_BRAND}`,
    html: `<p>Your verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 5 minutes.</p><p>If you didn't request this, please ignore this email.</p><p style="color:#64748b">— ${AUTH_EMAIL_BRAND}</p>`,
  });

  if (!emailResult.ok) {
    await supabase.auth.admin.updateUserById(user.id, {
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
    return {
      ok: false,
      error: emailResult.error,
      message:
        emailResult.error === "config"
          ? emailResult.message
          : "Failed to send verification code. Please try again.",
    };
  }

  return { ok: true };
}
