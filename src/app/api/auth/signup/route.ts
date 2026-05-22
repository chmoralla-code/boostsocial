import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { promises as dnsPromises } from "dns";

// Comprehensive blocklist of common disposable / burner email domains
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "yopmail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "sharklasers.com",
  "dispostable.com",
  "getairmail.com",
  "burnermail.io",
  "trashmail.com",
  "getnada.com",
  "maildrop.cc",
  "temp-mail.io",
  "fakemailgenerator.com",
  "emailondeck.com",
  "throwawaymail.com",
  "tempmailo.com"
]);

export async function POST(req: NextRequest) {
  try {
    const { email, password, referralCode } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Simple RFC 5322 Syntax Regex check
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: "Invalid email syntax format. Please double-check your spelling!" }, { status: 400 });
    }

    const [username, domain] = cleanEmail.split("@");

    // 2. Burner Email Domain Check
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return NextResponse.json({
        error: `Burner or temporary email accounts (${domain}) are not permitted. Please use a real, personal email account! 🔒`
      }, { status: 400 });
    }

    // Common typo warnings
    const commonTypos: { [key: string]: string } = {
      "gamil.com": "gmail.com",
      "gmal.com": "gmail.com",
      "gmeil.com": "gmail.com",
      "gmail.co": "gmail.com",
      "yahoo.co": "yahoo.com",
      "yaho.com": "yahoo.com",
      "hotmal.com": "hotmail.com",
      "outlok.com": "outlook.com"
    };

    if (commonTypos[domain]) {
      return NextResponse.json({
        error: `Did you mean @${commonTypos[domain]}? Please verify your email domain spelling!`
      }, { status: 400 });
    }

    // 3. DNS MX record validation check
    let mxRecords: any[] = [];
    let dnsValid = false;
    try {
      mxRecords = await dnsPromises.resolveMx(domain);
      if (mxRecords.length > 0) {
        dnsValid = true;
      }
    } catch (dnsErr: any) {
      if (dnsErr.code === "ENOTFOUND" || dnsErr.code === "ENODATA") {
        return NextResponse.json({
          error: `The email domain @${domain} does not seem to have any active mail servers. Please enter a real, existing email address!`
        }, { status: 400 });
      }
    }

    // If records are empty, try fallback A record check
    if (!dnsValid && domain !== "localhost") {
      try {
        const aRecords = await dnsPromises.resolve4(domain);
        if (aRecords.length === 0) {
          return NextResponse.json({
            error: `Domain @${domain} is unreachable and cannot receive emails. Please enter a valid email address!`
          }, { status: 400 });
        }
      } catch {
        return NextResponse.json({
          error: `Domain @${domain} has no mail routing (MX) or address (A) records. Please check for spelling mistakes!`
        }, { status: 400 });
      }
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
