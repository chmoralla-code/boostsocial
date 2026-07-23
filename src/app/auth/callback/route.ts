import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

function safeNextPath(next: string | null, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = (searchParams.get("type") || "") as EmailOtpType;
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (next === "/") {
        return NextResponse.redirect(`${origin}/email-confirmed`);
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error("Auth callback code exchange error:", error.message);
  }

  // Support recovery/confirm links that land here with token_hash instead of PKCE code.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next === "/" ? "/reset-password" : next}`);
    }
    console.error("Auth callback verifyOtp error:", error.message);
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "Authentication failed. Please try again or request a new password reset link."
    )}`
  );
}
