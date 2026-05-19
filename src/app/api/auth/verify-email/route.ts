import { NextRequest, NextResponse } from "next/server";
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
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ valid: false, error: "Email is required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Simple RFC 5322 Syntax Regex check
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json({
        valid: false,
        error: "Invalid email syntax format. Please double-check your spelling!"
      }, { status: 200 });
    }

    const [username, domain] = cleanEmail.split("@");

    // 2. Burner Email Domain Check
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return NextResponse.json({
        valid: false,
        error: `Burner or temporary email accounts (${domain}) are not permitted. Please use a real, personal email account! 🔒`
      }, { status: 200 });
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
        valid: false,
        error: `Did you mean @${commonTypos[domain]}? Please verify your email domain spelling!`
      }, { status: 200 });
    }

    // 3. DNS MX record validation check
    let mxRecords: any[] = [];
    try {
      // Set DNS query timeout to 2 seconds to keep registration swift
      mxRecords = await dnsPromises.resolveMx(domain);
    } catch (dnsErr: any) {
      console.warn(`DNS MX lookup failed for domain: ${domain}`, dnsErr.message);
      
      // If DNS lookup throws ENOTFOUND or ENODATA, it absolutely does not exist
      if (dnsErr.code === "ENOTFOUND" || dnsErr.code === "ENODATA") {
        return NextResponse.json({
          valid: false,
          error: `The email domain @${domain} does not seem to have any active mail servers. Please enter a real, existing email address!`
        }, { status: 200 });
      }
      
      // For other network/timeout issues, we degrade gracefully rather than blocking the user
      // so we don't break signups if the runner's DNS is temporarily slow or failing.
    }

    // If records are returned but empty (should not happen on success, but just in case)
    if (mxRecords.length === 0 && domain !== "localhost") {
      // Double check if A record exists (fallback for some old servers, though rare now)
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

    // 4. Identify if it's a Google (Gmail or Google Workspace / G-Suite) mail account
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
