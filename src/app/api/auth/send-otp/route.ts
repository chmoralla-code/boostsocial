import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findAuthUserByEmail } from "@/utils/auth/find-user";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { storeAndSendOtp } from "@/utils/auth/otp";

// Generic response returned whether or not the account exists, to avoid
// leaking which emails are registered (user enumeration).
const GENERIC_SENT = {
  success: true,
  message: "If an account exists for that email, a verification code has been sent.",
};

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
      auth: { persistSession: false },
    });

    const user = await findAuthUserByEmail(supabase, cleanEmail);

    // Do not reveal whether the account exists.
    if (!user) {
      return NextResponse.json(GENERIC_SENT);
    }

    const result = await storeAndSendOtp(supabase, user, cleanEmail);

    if (!result.ok) {
      if (result.error === "rate_limited") {
        return NextResponse.json(
          {
            error: "rate_limited",
            message: `Please wait ${result.remaining}s before requesting a new code.`,
            remaining: result.remaining,
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: result.message || "Failed to send verification code." },
        { status: 500 }
      );
    }

    return NextResponse.json(GENERIC_SENT);
  } catch (err) {
    console.error("Send OTP failed:", err);
    return NextResponse.json({ error: "Failed to send verification code." }, { status: 500 });
  }
}
