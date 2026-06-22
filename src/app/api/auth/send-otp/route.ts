import { NextRequest, NextResponse } from "next/server";

// In-memory OTP store: email → { code, expiresAt }
const otpStore = new Map<string, { code: string; expiresAt: number }>();
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of otpStore) {
    if (data.expiresAt < now) otpStore.delete(email);
  }
}, 5 * 60 * 1000);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Rate limit: allow resend every 30 seconds
    const existing = otpStore.get(cleanEmail);
    if (existing && existing.expiresAt > Date.now()) {
      const elapsed = Date.now() - (existing.expiresAt - OTP_EXPIRY_MS);
      if (elapsed < 30000) {
        const remaining = Math.ceil((30000 - elapsed) / 1000);
        return NextResponse.json({
          error: "rate_limited",
          message: `Please wait ${remaining}s before requesting a new code.`,
          remaining
        }, { status: 429 });
      }
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store with expiry
    otpStore.set(cleanEmail, {
      code,
      expiresAt: Date.now() + OTP_EXPIRY_MS
    });

    // Send via Resend API
    const resendKey = "re_hDykSiph_NBT7jK2kZbp4QM7d2a8ciNga";
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
      const err = await sendRes.json();
      console.error("Resend send failed:", err);
      otpStore.delete(cleanEmail);
      return NextResponse.json({ error: "Failed to send verification code. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Verification code sent to your email." });
  } catch (err: any) {
    console.error("Send OTP failed:", err);
    return NextResponse.json({ error: err.message || "Network error" }, { status: 500 });
  }
}
