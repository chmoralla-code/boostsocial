import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    // Initialize administrative client bypassing RLS and rate limits
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    const cleanEmail = email.trim();

    // 1. Fetch user list securely to prevent duplicate registrations
    const { data, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      throw listError;
    }

    const existingUser = data.users.find(u => u.email && u.email.toLowerCase() === cleanEmail.toLowerCase());
    if (existingUser) {
      return NextResponse.json({ error: "This email is already registered. Please sign in!" }, { status: 400 });
    }

    // 2. Create the user with email_confirm: true (bypassing confirmation rates & emails)
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: true
    });

    if (createError) {
      throw createError;
    }

    return NextResponse.json({ success: true, user: createData.user });
  } catch (err: any) {
    console.error("Signup endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
