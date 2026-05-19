import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { email, password, referralCode } = await req.json();

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

    // 3. Process referral systems & welcome balance
    const newUserId = createData.user.id;
    const generatedReferralCode = `REF-${newUserId.slice(0, 8).toUpperCase()}`;
    let initialBalance = 0.00;
    let referredById = null;

    if (referralCode && referralCode.trim() !== "") {
      const { data: referrer, error: referrerError } = await supabase
        .from("profiles")
        .select("id")
        .eq("referral_code", referralCode.trim())
        .maybeSingle();

      if (referrer && !referrerError) {
        referredById = referrer.id;
        initialBalance = 20.00; // ₱20 Welcome Balance bonus
      }
    }

    // Update newly generated profile with referral code & optional referred_by connection
    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        referral_code: generatedReferralCode,
        referred_by: referredById,
        balance: initialBalance
      })
      .eq("id", newUserId);

    if (profileUpdateError) {
      console.error("Failed to update profile after signup:", profileUpdateError);
    }

    // Record welcome bonus transaction
    if (referredById) {
      const { error: txnError } = await supabase
        .from("referral_transactions")
        .insert([
          {
            referrer_id: referredById,
            referee_id: newUserId,
            amount: 20.00,
            description: `Welcome signup bonus using referral code ${referralCode.trim()}`
          }
        ]);
      if (txnError) console.error("Failed to log welcome transaction:", txnError);
    }

    return NextResponse.json({ success: true, user: createData.user });
  } catch (err: any) {
    console.error("Signup endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
