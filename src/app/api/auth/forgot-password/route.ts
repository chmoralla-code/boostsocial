import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findAuthUserByEmail } from "@/utils/auth/find-user";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { AUTH_EMAIL_BRAND, getSiteOrigin, sendAuthEmail } from "@/utils/auth/email";

// Generic success so we don't reveal whether an email is registered.
const GENERIC_SENT = {
  success: true,
  message: "If an account exists for that email, a password reset link has been sent.",
};

export async function POST(req: NextRequest) {
  try {
    const limited = enforceRateLimit(req, {
      key: "forgot-password",
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

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Server configuration missing" },
        { status: 500 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email delivery is not configured on the server. Please contact support." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const user = await findAuthUserByEmail(supabase, cleanEmail);
    if (!user) {
      // Still return generic success (no user enumeration), but do not pretend a link was built.
      console.warn(`Forgot-password: no auth user for ${cleanEmail}`);
      return NextResponse.json(GENERIC_SENT);
    }

    const origin = getSiteOrigin();
    const redirectTo = `${origin}/reset-password`;

    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: cleanEmail,
      options: { redirectTo },
    });

    if (linkError) {
      console.error("Failed to generate recovery link:", linkError);
      return NextResponse.json(
        { error: "Failed to create password reset link. Please try again." },
        { status: 500 }
      );
    }

    const hashedToken = data?.properties?.hashed_token;
    const actionLink = data?.properties?.action_link;

    // Prefer our confirm route with token_hash so the browser gets a real cookie session.
    // Falling back to Supabase action_link only if hashed_token is missing.
    const resetLink = hashedToken
      ? `${origin}/auth/confirm?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&next=${encodeURIComponent("/reset-password")}`
      : actionLink;

    if (!resetLink) {
      console.error("generateLink returned neither hashed_token nor action_link");
      return NextResponse.json(
        { error: "Failed to create password reset link. Please try again." },
        { status: 500 }
      );
    }

    const emailResult = await sendAuthEmail({
      to: cleanEmail,
      subject: `Reset your ${AUTH_EMAIL_BRAND} password`,
      text: [
        `We received a request to reset your ${AUTH_EMAIL_BRAND} password.`,
        "",
        "Open this link to choose a new password:",
        resetLink,
        "",
        "This link expires soon. If you didn't request a password reset, you can ignore this email.",
        "",
        `— ${AUTH_EMAIL_BRAND}`,
      ].join("\n"),
      html: `
        <p>We received a request to reset your <strong>${AUTH_EMAIL_BRAND}</strong> password.</p>
        <p><a href="${resetLink}" style="display:inline-block;padding:12px 20px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Reset password</a></p>
        <p style="color:#64748b;font-size:13px">Or copy this link:<br/><a href="${resetLink}">${resetLink}</a></p>
        <p style="color:#64748b;font-size:13px">This link expires soon. If you didn't request a password reset, you can ignore this email.</p>
        <p style="color:#64748b">— ${AUTH_EMAIL_BRAND}</p>
      `,
    });

    if (!emailResult.ok) {
      return NextResponse.json(
        { error: emailResult.message },
        { status: 500 }
      );
    }

    console.log(`Forgot-password: reset email sent to ${cleanEmail} via ${hashedToken ? "token_hash" : "action_link"}`);
    return NextResponse.json(GENERIC_SENT);
  } catch (err) {
    console.error("Forgot password failed:", err);
    return NextResponse.json(
      { error: "Failed to send password reset email." },
      { status: 500 }
    );
  }
}
