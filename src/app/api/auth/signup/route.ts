import { NextRequest, NextResponse } from "next/server";
import { promises as dnsPromises } from "dns";
import { dualWrite, getPrimaryAdminClient, getBackupAdminClients } from "@/utils/supabase/dual-db";

// ─────────────────────────────────────────────────────────────
// 1.  MASSIVE DISPOSABLE / BURNER DOMAIN BLOCKLIST (100+)
// ─────────────────────────────────────────────────────────────
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "yopmail.com", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "guerrillamail.com", "sharklasers.com", "dispostable.com",
  "getairmail.com", "burnermail.io", "trashmail.com", "getnada.com",
  "maildrop.cc", "temp-mail.io", "fakemailgenerator.com", "emailondeck.com",
  "throwawaymail.com", "tempmailo.com",
  "guerrillamail.info", "guerrillamailblock.com", "guerrillamail.net",
  "guerrillamail.org", "guerrillamail.de", "grr.la", "spam4.me",
  "trashmail.net", "trashmail.me", "trashmail.io",
  "mailnesia.com", "mailnator.com", "mailtothis.com",
  "mohmal.com", "discard.email", "tmpmail.net", "tmpmail.org",
  "binkmail.com", "bobmail.info", "chammy.info", "devnullmail.com",
  "disbox.net", "disbox.org", "e4ward.com", "emailigo.de",
  "emailsensei.com", "emailtemporario.com.br", "ephemail.net",
  "etranquil.com", "etranquil.net", "etranquil.org", "fakeinbox.com",
  "filzmail.com", "flyspam.com", "imails.info", "inbucket.com",
  "incognitomail.com", "incognitomail.net", "incognitomail.org",
  "ipoo.org", "jetable.com", "jetable.net", "jetable.org",
  "kasmail.com", "koszmail.pl", "kurzepost.de", "letthemeatspam.com",
  "lhsdv.com", "lol.ovpn.to", "lr78.com", "maileater.com",
  "mailexpire.com", "mailforspam.com", "mailin8r.com", "mailincubator.com",
  "mailme.ir", "mailme.lv", "mailmetrash.com", "mailnull.com",
  "mailshell.com", "mailsiphon.com", "mailslite.com", "mailzilla.com",
  "meltmail.com", "mintemail.com", "mytempemail.com", "nobulk.com",
  "nospam.ze.tc", "nospamfor.us", "nowmymail.com", "objectmail.com",
  "obobbo.com", "onewaymail.com", "owlpic.com", "pjjkp.com",
  "politikerclub.de", "pookmail.com", "proxymail.eu", "rcpt.at",
  "reallymymail.com", "receiveee.com", "regbypass.com",
  "rhyta.com", "rklips.com", "rmqkr.net", "royal.net",
  "safersignup.de", "safetymail.info", "sandelf.de",
  "shieldedmail.com", "slaskpost.se", "slipry.net",
  "spambob.com", "spambob.net", "spambob.org", "spambox.us",
  "spamcero.com", "spamday.com", "spamfighter.cf", "spamfighter.ga",
  "spamfighter.gq", "spamfighter.ml", "spamfighter.tk",
  "spamfree24.com", "spamfree24.de", "spamfree24.eu",
  "spamfree24.info", "spamfree24.net", "spamfree24.org",
  "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",
  "spamhole.com", "spaml.com", "spaml.de", "spammotel.com",
  "spamobox.com", "spamspot.com", "spamstack.net",
  "superrito.com", "suremail.info", "teleworm.us",
  "tempalias.com", "tempe4mail.com", "tempemail.co.za",
  "tempemail.net", "tempinbox.com", "tempinbox.co.uk",
  "tempmail.eu", "tempmail2.com", "tempmailer.com",
  "tempomail.fr", "temporaryemail.net", "temporaryemail.us",
  "temporaryforwarding.com", "temporaryinbox.com",
  "thankyou2010.com", "thisisnotmyrealemail.com",
  "trashmail.at", "trashmail.org", "trashymail.com",
  "trashymail.net", "turual.com", "uggsrock.com",
  "wegwerfmail.de", "wegwerfmail.net", "wegwerfmail.org",
  "willhackforfood.biz", "willselfdestruct.com",
  "wuzupmail.net", "xyzfree.net", "yopmail.fr", "yopmail.net",
  "zetmail.com", "zoemail.org",
  "guerrillamail.biz", "harakirimail.com", "hidemail.de",
  "mailnull.net", "mailnesia.net", "trashmailer.com",
  "mx0.wwwnew.eu", "mytrashmail.com", "mt2015.com",
  "nobody.com", "nomail.xl.cx", "nonspam.eu",
]);

// ─────────────────────────────────────────────────────────────
// 2.  ROLE-BASED / NON-PERSONAL EMAIL USERNAMES
// ─────────────────────────────────────────────────────────────
const ROLE_BASED_USERNAMES = new Set([
  "admin", "administrator", "info", "contact", "support",
  "help", "helpdesk", "sales", "marketing", "billing",
  "noreply", "no-reply", "no_reply", "donotreply",
  "postmaster", "webmaster", "hostmaster", "abuse",
  "security", "privacy", "compliance", "legal",
  "office", "hello", "hi", "feedback", "careers",
  "jobs", "recruitment", "hr", "press", "media",
  "team", "staff", "dev", "devops", "engineering",
  "operations", "ops", "root", "sysadmin", "mailer-daemon",
  "newsletter", "subscribe", "unsubscribe", "news",
]);

// ─────────────────────────────────────────────────────────────
// 3.  EXPANDED TYPO CORRECTION MAP
// ─────────────────────────────────────────────────────────────
const COMMON_TYPOS: { [key: string]: string } = {
  "gamil.com": "gmail.com", "gmal.com": "gmail.com", "gmeil.com": "gmail.com",
  "gmail.co": "gmail.com", "gmaill.com": "gmail.com", "gmial.com": "gmail.com",
  "gnail.com": "gmail.com", "gmai.com": "gmail.com", "gmali.com": "gmail.com",
  "gmail.con": "gmail.com", "gmail.om": "gmail.com", "gmail.cm": "gmail.com",
  "gmail.cim": "gmail.com", "gmail.comm": "gmail.com", "gmaik.com": "gmail.com",
  "gmsil.com": "gmail.com", "gmail.xom": "gmail.com", "gmailcom": "gmail.com",
  "yahoo.co": "yahoo.com", "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com",
  "yahoo.con": "yahoo.com", "yahoo.cm": "yahoo.com", "yahoo.comm": "yahoo.com",
  "yhaoo.com": "yahoo.com", "yahho.com": "yahoo.com", "yhoo.com": "yahoo.com",
  "hotmal.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmaill.com": "hotmail.com",
  "hotmial.com": "hotmail.com", "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com", "outlookk.com": "outlook.com",
  "outloo.com": "outlook.com", "outlook.con": "outlook.com", "outllok.com": "outlook.com",
  "iclod.com": "icloud.com", "icoud.com": "icloud.com", "icloud.con": "icloud.com",
  "protonmai.com": "protonmail.com", "protonmal.com": "protonmail.com",
  "protonmail.con": "protonmail.com",
};

// ─────────────────────────────────────────────────────────────
// 4.  USERNAME JUNK PATTERN DETECTION
// ─────────────────────────────────────────────────────────────
function isJunkUsername(username: string): string | null {
  const clean = username.replace(/[._+-]/g, "").toLowerCase();

  if (clean.length < 2) {
    return "Email username is too short. Please use a real, personal email address.";
  }

  if (/^(.)\1{3,}$/.test(clean)) {
    return "This email looks like a fake address. Please use your real email! 🔒";
  }

  const keyboardSmashes = [
    "asdf", "qwer", "zxcv", "wasd", "hjkl",
    "asdfg", "qwert", "zxcvb", "poiuy", "lkjhg",
    "asdfjkl", "qwertyui", "zxcvbnm",
    "1234", "12345", "123456", "1234567", "12345678",
    "abcdef", "abcdefg",
  ];
  if (keyboardSmashes.some(smash => clean === smash || clean.startsWith(smash + smash))) {
    return "This email looks auto-generated. Please use a real, personal email address! 🔒";
  }

  const junkPatterns = [
    /^test[0-9]*$/, /^fake[0-9]*$/, /^dummy[0-9]*$/,
    /^sample[0-9]*$/, /^temp[0-9]*$/, /^user[0-9]*$/,
    /^noname[0-9]*$/, /^null[0-9]*$/, /^none[0-9]*$/,
    /^noemail[0-9]*$/, /^abc[0-9]*$/, /^xxx[0-9]*$/,
  ];
  if (junkPatterns.some(pattern => pattern.test(clean))) {
    return "This email looks like a placeholder. Please use your real email address to register! 🔒";
  }

  return null;
}

// ═════════════════════════════════════════════════════════════
//  MAIN SIGNUP HANDLER
// ═════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const { email, password, referralCode } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // ── CHECK 1: RFC 5322 Syntax Check ───────────────────
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({ error: "Invalid email syntax format. Please double-check your spelling!" }, { status: 400 });
    }

    // ── CHECK 1.5: Administrative Domain Lock ────────────
    if (cleanEmail.endsWith("@boostsocial.com")) {
      return NextResponse.json({
        error: "Registration with the @boostsocial.com domain is not permitted. Please use your personal email address. 🔒"
      }, { status: 400 });
    }

    const [username, domain] = cleanEmail.split("@");

    // ── CHECK 2: Disposable Blocklist Check ──────────────
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return NextResponse.json({
        error: `Burner or temporary email accounts (@${domain}) are not permitted. Please use a real, personal email account! 🔒`
      }, { status: 400 });
    }

    // ── CHECK 3: Role-Based Email Check ──────────────────
    const baseUsername = username.replace(/[._+-].*$/, "");
    if (ROLE_BASED_USERNAMES.has(username) || ROLE_BASED_USERNAMES.has(baseUsername)) {
      return NextResponse.json({
        error: `Role-based email addresses like "${username}@" are not allowed. Please use a personal email (e.g., yourname@${domain}). 🔒`
      }, { status: 400 });
    }

    // ── CHECK 4: Junk Username Detection ─────────────────
    const junkMsg = isJunkUsername(username);
    if (junkMsg) {
      return NextResponse.json({ error: junkMsg }, { status: 400 });
    }

    // ── CHECK 5: Typo Suggestions ────────────────────────
    if (COMMON_TYPOS[domain]) {
      return NextResponse.json({
        error: `Did you mean @${COMMON_TYPOS[domain]}? Please verify your email domain spelling!`
      }, { status: 400 });
    }

    // ── CHECK 6: DNS MX Record check ─────────────────────
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

    // ── CHECK 7: Fallback A-Record Check ─────────────────
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

    // ══════════════════════════════════════════════════════
    //  ALL CLIENT CHECKS PASSED — Dual-Database Signup
    // ══════════════════════════════════════════════════════

    const primaryUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const primaryServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!primaryUrl || !primaryServiceKey) {
      return NextResponse.json({ error: "Primary server configuration missing" }, { status: 500 });
    }

    // 1. Initialize admin clients for duplicate checks
    const primaryAdmin = getPrimaryAdminClient();
    const backupAdmins = getBackupAdminClients();

    // 2. Fetch user lists to prevent duplicate registrations across primary & backup
    let existingUser = null;
    try {
      const { data: primaryUsers } = await primaryAdmin.auth.admin.listUsers();
      existingUser = primaryUsers?.users.find(u => u.email && u.email.toLowerCase() === cleanEmail.toLowerCase());
    } catch (e) {
      console.warn("Failed listing primary users:", e);
    }

    for (const backupAdmin of backupAdmins) {
      if (existingUser) {
        break;
      }
      try {
        const { data: backupUsers } = await backupAdmin.client.auth.admin.listUsers();
        existingUser = backupUsers?.users.find(u => u.email && u.email.toLowerCase() === cleanEmail.toLowerCase());
      } catch (e) {
        console.warn(`Failed listing ${backupAdmin.displayName} users:`, e);
      }
    }

    if (existingUser) {
      return NextResponse.json({ error: "This email is already registered. Please sign in!" }, { status: 400 });
    }

    // 3. Create the auth user in the PRIMARY database via Admin API.
    //    email_confirm: false so the user must verify before they can sign in.
    const { data: createData, error: createError } = await primaryAdmin.auth.admin.createUser({
      email: cleanEmail,
      password: password,
      email_confirm: false
    });

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 });
    }

    const newUserId = createData.user?.id;
    if (!newUserId) {
      return NextResponse.json({ error: "Failed to generate user ID" }, { status: 500 });
    }

    // 4a. Send email confirmation via GoTrue API.
    //     The admin API doesn't trigger confirmation emails, so we call user-facing
    //     resend endpoint with the anon key to deliver the verification link.
    try {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (anonKey) {
        const confirmRes = await fetch(
          `${primaryUrl}/auth/v1/resend`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey
            },
            body: JSON.stringify({
              type: "signup",
              email: cleanEmail
            })
          }
        );
        if (!confirmRes.ok) {
          const confirmBody = await confirmRes.text();
          console.warn(`Confirmation email trigger returned ${confirmRes.status}: ${confirmBody}`);
        } else {
          console.log(`Confirmation email sent to ${cleanEmail}`);
        }
      }
    } catch (confirmErr: any) {
      console.warn("Failed to trigger confirmation email:", confirmErr.message);
    }

    // 4. Create the auth user inside every configured backup auth database.
    for (const backupAdmin of backupAdmins) {
      try {
        await backupAdmin.client.auth.admin.createUser({
          id: newUserId,
          email: cleanEmail,
          password: password,
          email_confirm: false
        });
        console.log(`Successfully replicated auth user ${newUserId} to ${backupAdmin.displayName} Auth database.`);
      } catch (backupAuthErr: any) {
        console.warn(`Failed replicating auth user to ${backupAdmin.displayName} database:`, backupAuthErr.message);
      }
    }

    // 5. Process referrals & welcome balances
    const generatedReferralCode = `REF-${newUserId.slice(0, 8).toUpperCase()}`;
    let initialBalance = 0.00;
    let referredById = null;

    if (referralCode && referralCode.trim() !== "") {
      const { data: referrer, error: referrerError } = await primaryAdmin
        .from("profiles")
        .select("id")
        .eq("referral_code", referralCode.trim())
        .maybeSingle();

      if (referrer && !referrerError) {
        referredById = referrer.id;
        initialBalance = 20.00; // ₱20 Welcome Balance bonus
      } else {
        // Try looking up referrer in backup databases in case primary was offline.
        for (const backupAdmin of backupAdmins) {
          try {
            const { data: referrerB } = await backupAdmin.client
              .from("profiles")
              .select("id")
              .eq("referral_code", referralCode.trim())
              .maybeSingle();
            if (referrerB) {
              referredById = referrerB.id;
              initialBalance = 20.00;
              break;
            }
          } catch (e) {
            console.warn(`${backupAdmin.displayName} referrer lookup error:`, e);
          }
        }
      }
    }

    // 6. Write and sync profiles to primary and all configured backup databases.
    const { error: profileUpdateError, databaseUsed } = await dualWrite(async (dbClient) => {
      // First, upsert the profile in case the trigger delay didn't finish executing yet
      return await dbClient
        .from("profiles")
        .upsert({
          id: newUserId,
          email: cleanEmail,
          referral_code: generatedReferralCode,
          referred_by: referredById,
          balance: initialBalance
        }, { onConflict: "id" })
        .select()
        .single();
    });

    if (profileUpdateError) {
      console.error("Failed to sync profile after signup across databases:", profileUpdateError);
    } else {
      console.log(`Successfully initialized profile across databases (Used: ${databaseUsed})`);
    }

    // 7. Record welcome bonus transaction to BOTH databases
    if (referredById) {
      const { error: txnError, databaseUsed: txnDbUsed } = await dualWrite(async (dbClient) => {
        return await dbClient
          .from("referral_transactions")
          .insert([
            {
              referrer_id: referredById,
              referee_id: newUserId,
              amount: 20.00,
              description: `Welcome signup bonus using referral code ${referralCode.trim()}`
            }
          ]);
      });
      
      if (txnError) {
        console.error("Failed to log welcome transaction:", txnError);
      } else {
        console.log(`Logged welcome transaction across databases (Used: ${txnDbUsed})`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      user: createData.user,
      message: "📬 Registration Successful! We've sent a confirmation link to your email. Please check your inbox (and spam folder) and click the link to activate your account before signing in. 🚀" 
    });
  } catch (err: any) {
    console.error("Signup endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
