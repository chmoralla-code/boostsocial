import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Track last resend attempt per email to enforce server-side cooldown
const resendCooldowns = new Map<string, number>();
const COOLDOWN_MS = 30_000;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Missing email" }, { status: 400 });

    const cleanEmail = email.trim().toLowerCase();

    // Server-side cooldown
    const lastAttempt = resendCooldowns.get(cleanEmail);
    if (lastAttempt && Date.now() - lastAttempt < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - (Date.now() - lastAttempt)) / 1000);
      return NextResponse.json({ error: "rate_limited", message: `Please wait ${remaining}s`, remaining }, { status: 429 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    // 1. Best-effort email via GoTrue resend
    if (anonKey) {
      try {
        await fetch(`${supabaseUrl}/auth/v1/resend`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: anonKey },
          body: JSON.stringify({ type: "signup", email: cleanEmail })
        });
      } catch { /* ignore */ }
    }

    // 2. Generate a direct confirmation link via GoTrue Admin API
    let confirmationLink: string | null = null;
    if (serviceRoleKey) {
      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`
          },
          body: JSON.stringify({
            type: "signup",
            email: cleanEmail,
            redirect_to: "https://faceboosting.vercel.app/auth/callback"
          })
        });
        if (res.ok) {
          const data = await res.json();
          confirmationLink = data?.action_link || null;
        }
      } catch (err) {
        console.warn("Admin generate_link failed:", err);
      }
    }

    resendCooldowns.set(cleanEmail, Date.now());
    setTimeout(() => resendCooldowns.delete(cleanEmail), 300_000);

    return NextResponse.json({
      success: true,
      message: confirmationLink
        ? "Confirmation link ready! Click the button below to activate your account."
        : "Confirmation email sent. Check your inbox and spam folder.",
      confirmationLink,
      emailSent: true
    });
  } catch (err: any) {
    console.error("Resend confirmation endpoint failed:", err);
    return NextResponse.json({ error: "general", message: "Network error. Please try again." }, { status: 500 });
  }
}
