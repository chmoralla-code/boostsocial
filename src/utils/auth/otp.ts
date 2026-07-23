import { createHash, randomBytes } from "crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";

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
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return { ok: false, error: "config", message: "Server configuration missing" };
  }

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

  const sendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "CYNETWORK <noreply@pinoyboosting.com>",
      to: cleanEmail,
      subject: "Your CYNETWORK verification code",
      text: `Your verification code is: ${code}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this, please ignore this email.`,
    }),
  });

  if (!sendRes.ok) {
    const body = await sendRes.text().catch(() => "");
    console.error("Resend send failed:", sendRes.status, body);
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
      error: "email",
      message: "Failed to send verification code. Please try again.",
    };
  }

  return { ok: true };
}
