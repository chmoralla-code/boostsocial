import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { findAuthUserByEmail } from "@/utils/auth/find-user";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Look up the user in auth.users (paginated — listUsers() alone only sees page 1)
    let user;
    try {
      user = await findAuthUserByEmail(supabase, cleanEmail);
    } catch {
      return NextResponse.json({ error: "Failed to look up user" }, { status: 500 });
    }

    if (!user) {
      // No user found with this email — nothing to check
      return NextResponse.json({ confirmed: false, exists: false });
    }

    const isConfirmed = !!user.email_confirmed_at;

    return NextResponse.json({
      confirmed: isConfirmed,
      exists: true,
      userId: user.id
    });
  } catch (err) {
    console.error("Check confirmation endpoint failed:", err);
    return NextResponse.json({ error: "Failed to look up user" }, { status: 500 });
  }
}
