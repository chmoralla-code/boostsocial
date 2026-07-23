import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

const ALLOWED_TYPES = new Set<EmailOtpType>([
  "recovery",
  "signup",
  "invite",
  "magiclink",
  "email_change",
  "email",
]);

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

/**
 * Confirm email links that carry a Supabase token_hash (custom Resend emails).
 * Establishes a cookie session, then redirects to the intended page.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const typeParam = (searchParams.get("type") || "recovery") as EmailOtpType;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");

  const supabase = await createClient();

  // PKCE flow (code) — same as /auth/callback
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Auth confirm code exchange failed:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "Password reset link is invalid or expired. Please request a new one."
      )}`
    );
  }

  if (!tokenHash || !ALLOWED_TYPES.has(typeParam)) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "Password reset link is invalid or incomplete. Please request a new one."
      )}`
    );
  }

  const { error } = await supabase.auth.verifyOtp({
    type: typeParam,
    token_hash: tokenHash,
  });

  if (error) {
    console.error("Auth confirm verifyOtp failed:", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(
        "Password reset link is invalid or expired. Please request a new one."
      )}`
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
