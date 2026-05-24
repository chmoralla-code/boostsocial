import { NextRequest, NextResponse } from "next/server";
import { promises as dnsPromises } from "dns";

// ─────────────────────────────────────────────────────────────
// 1.  MASSIVE DISPOSABLE / BURNER DOMAIN BLOCKLIST (100+)
// ─────────────────────────────────────────────────────────────
const DISPOSABLE_DOMAINS = new Set([
  // Original list
  "mailinator.com", "yopmail.com", "10minutemail.com", "tempmail.com",
  "temp-mail.org", "guerrillamail.com", "sharklasers.com", "dispostable.com",
  "getairmail.com", "burnermail.io", "trashmail.com", "getnada.com",
  "maildrop.cc", "temp-mail.io", "fakemailgenerator.com", "emailondeck.com",
  "throwawaymail.com", "tempmailo.com",
  // Expanded (80+ additional)
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
  // Catch-all for services that generate random inboxes
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
// 3.  EXPANDED TYPO CORRECTION MAP (25+ entries)
// ─────────────────────────────────────────────────────────────
const COMMON_TYPOS: { [key: string]: string } = {
  // Gmail
  "gamil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmeil.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmali.com": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.om": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.cim": "gmail.com",
  "gmail.comm": "gmail.com",
  "gmaik.com": "gmail.com",
  "gmsil.com": "gmail.com",
  "gmail.xom": "gmail.com",
  "gmailcom": "gmail.com",
  // Yahoo
  "yahoo.co": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yahoo.cm": "yahoo.com",
  "yahoo.comm": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "yhoo.com": "yahoo.com",
  // Hotmail / Outlook
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmaill.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "outlok.com": "outlook.com",
  "outlookk.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outllok.com": "outlook.com",
  // iCloud
  "iclod.com": "icloud.com",
  "icoud.com": "icloud.com",
  "icloud.con": "icloud.com",
  // Protonmail
  "protonmai.com": "protonmail.com",
  "protonmal.com": "protonmail.com",
  "protonmail.con": "protonmail.com",
};

// ─────────────────────────────────────────────────────────────
// 4.  USERNAME PATTERN DETECTION (catch junk / keyboard smash)
// ─────────────────────────────────────────────────────────────
function isJunkUsername(username: string): string | null {
  const clean = username.replace(/[._+-]/g, "").toLowerCase();

  // Too short (1 char like "a@gmail.com")
  if (clean.length < 2) {
    return "Email username is too short. Please use a real, personal email address.";
  }

  // All same character (e.g. "aaaa@", "bbbbb@")
  if (/^(.)\1{3,}$/.test(clean)) {
    return "This email looks like a fake address. Please use your real email! 🔒";
  }

  // Common keyboard smash patterns
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

  // Obvious test / junk patterns
  const junkPatterns = [
    /^test[0-9]*$/,
    /^fake[0-9]*$/,
    /^dummy[0-9]*$/,
    /^sample[0-9]*$/,
    /^temp[0-9]*$/,
    /^user[0-9]*$/,
    /^noname[0-9]*$/,
    /^null[0-9]*$/,
    /^none[0-9]*$/,
    /^noemail[0-9]*$/,
    /^abc[0-9]*$/,
    /^xxx[0-9]*$/,
  ];
  if (junkPatterns.some(pattern => pattern.test(clean))) {
    return "This email looks like a placeholder. Please use your real email address to register! 🔒";
  }

  return null; // Username looks normal
}

// ═════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ valid: false, error: "Email is required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // ── CHECK 1: RFC 5322 Syntax Regex ───────────────────
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({
        valid: false,
        error: "Invalid email syntax format. Please double-check your spelling!"
      }, { status: 200 });
    }

    const [username, domain] = cleanEmail.split("@");

    // ── CHECK 2: Disposable / Burner Domain Blocklist ────
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return NextResponse.json({
        valid: false,
        error: `Burner or temporary email accounts (@${domain}) are not permitted. Please use a real, personal email account! 🔒`
      }, { status: 200 });
    }

    // ── CHECK 3: Role-Based / Non-Personal Usernames ─────
    const baseUsername = username.replace(/[._+-].*$/, ""); // strip + aliases & sub-addressing
    if (ROLE_BASED_USERNAMES.has(username) || ROLE_BASED_USERNAMES.has(baseUsername)) {
      return NextResponse.json({
        valid: false,
        error: `Role-based email addresses like "${username}@" are not allowed. Please use a personal email (e.g., yourname@${domain}). 🔒`
      }, { status: 200 });
    }

    // ── CHECK 4: Junk / Keyboard-Smash Username Detection ─
    const junkMsg = isJunkUsername(username);
    if (junkMsg) {
      return NextResponse.json({ valid: false, error: junkMsg }, { status: 200 });
    }

    // ── CHECK 5: Common Typo Corrections ─────────────────
    if (COMMON_TYPOS[domain]) {
      return NextResponse.json({
        valid: false,
        error: `Did you mean @${COMMON_TYPOS[domain]}? Please verify your email domain spelling!`
      }, { status: 200 });
    }

    // ── CHECK 6: DNS MX Record Validation ────────────────
    let mxRecords: any[] = [];
    try {
      mxRecords = await dnsPromises.resolveMx(domain);
    } catch (dnsErr: any) {
      console.warn(`DNS MX lookup failed for domain: ${domain}`, dnsErr.message);

      if (dnsErr.code === "ENOTFOUND" || dnsErr.code === "ENODATA") {
        return NextResponse.json({
          valid: false,
          error: `The email domain @${domain} does not seem to have any active mail servers. Please enter a real, existing email address!`
        }, { status: 200 });
      }
      // For other DNS errors, degrade gracefully
    }

    // ── CHECK 7: Fallback A-Record Check ─────────────────
    if (mxRecords.length === 0 && domain !== "localhost") {
      try {
        const aRecords = await dnsPromises.resolve4(domain);
        if (aRecords.length === 0) {
          return NextResponse.json({
            valid: false,
            error: `Domain @${domain} is unreachable and cannot receive emails. Please enter a valid email address!`
          }, { status: 200 });
        }
      } catch {
        return NextResponse.json({
          valid: false,
          error: `Domain @${domain} has no mail routing (MX) or address (A) records. Please check for spelling mistakes!`
        }, { status: 200 });
      }
    }

    // ── IDENTIFY: Google Mail Detection ──────────────────
    const isGmailDomain = domain === "gmail.com" || domain === "googlemail.com";
    const isGoogleWorkspace = mxRecords.some(rec =>
      rec.exchange && (
        rec.exchange.toLowerCase().includes("google.com") ||
        rec.exchange.toLowerCase().includes("googlemail.com") ||
        rec.exchange.toLowerCase().includes("aspmx")
      )
    );

    const isGoogle = isGmailDomain || isGoogleWorkspace;

    return NextResponse.json({
      valid: true,
      isGoogle,
      domain,
      serviceProvider: isGoogle ? "Google Mail (Gmail / Workspace)" : "Other Mail Server",
      details: {
        mxCount: mxRecords.length,
        hasMx: mxRecords.length > 0
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Email verification API failed:", error);
    // Graceful fallback: on system failures, do not block the user's signup flow
    return NextResponse.json({
      valid: true,
      gracefulFallback: true,
      error: error.message || error.toString()
    }, { status: 200 });
  }
}
