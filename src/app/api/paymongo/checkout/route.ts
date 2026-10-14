import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { dualWrite } from "@/utils/supabase/dual-db";
import {
  createCheckoutSession,
  isPaymongoConfigured,
  phpToCentavos,
} from "@/lib/paymongo";

export const runtime = "nodejs";

// Kept in step with /api/topup/create: the same floor and ceiling, so the two
// rails cannot drift apart and let a tiny or huge top-up through one door only.
const MIN_TOPUP = 50;
const MAX_TOPUP = 50000;

// The Android app appends this marker to its user agent (capacitor.config.ts).
// It decides where PayMongo sends the customer back to.
function isClientApp(req: NextRequest) {
  const userAgent = req.headers.get("user-agent") || "";
  return userAgent.includes("PinoyBoostingClientApp");
}

function getSiteUrl(req: NextRequest) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "";
  const base = configured.replace(/\/+$/, "");
  if (base) return base;

  // Fall back to the request's own origin so previews and localhost work.
  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/+$/, "");

  const forwardedHost = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${proto}://${forwardedHost}`;

  return new URL(req.url).origin;
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "paymongo-checkout",
      maxRequests: 8,
      windowMs: 10 * 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    if (!isPaymongoConfigured()) {
      return NextResponse.json(
        { error: "PayMongo is not configured yet." },
        { status: 503 }
      );
    }

    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    // NOTE: the body carries no amount on purpose. The amount is decided
    // server-side below, so a tampered request cannot choose its own price.
    const amount = Number(body?.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid top-up amount" }, { status: 400 });
    }

    // Round to centavos first, then check the bounds, so 49.999 cannot slip in.
    const amountCentavos = phpToCentavos(amount);
    const normalizedAmount = amountCentavos / 100;

    if (normalizedAmount < MIN_TOPUP || normalizedAmount > MAX_TOPUP) {
      return NextResponse.json(
        { error: `Top-up must be between ₱${MIN_TOPUP} and ₱${MAX_TOPUP}.` },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Create the pending top-up FIRST. Admin already understands this row, so
    // the moment PayMongo confirms, the wallet is credited through the same
    // path as a manually approved GCash top-up.
    //
    // Written through dualWrite so the row lands on the DigitalOcean master as
    // well as Supabase. Writing to Supabase alone left the master without the
    // row, and since the admin top-ups page reads the master first, a PayMongo
    // top-up could be invisible there.
    //
    // The id is generated HERE, not left to each database's default, so both
    // sides store the SAME row id. Without that the webhook would credit one
    // database's row while the other kept a different one, and the top-up the
    // customer sees would never match the one the gateway confirmed.
    const topupId = crypto.randomUUID();

    const { data: topup, error: topupError } = await dualWrite(async (client) => {
      return client
        .from("topups")
        .insert([
          {
            id: topupId,
            user_id: user.id,
            email: user.email,
            amount: normalizedAmount,
            payment_method: "PayMongo",
            status: "pending",
          },
        ])
        .select()
        .single();
    });

    if (topupError || !topup) {
      throw topupError || new Error("Could not create the top-up row");
    }

    const siteUrl = getSiteUrl(req);

    // Where PayMongo returns the customer.
    //
    // On the website they go back to the MAIN site, not the /app area: the
    // wallet pill sits in the main header, and TopUpReturnWatcher shows the
    // "payment received" notice there and refreshes that balance. Returning to
    // /app/profile dropped website customers into the app-style pages they
    // never opened.
    //
    // Inside the Android app they stay on /app/profile, which has its own
    // poller - sending the app to the public site would push the customer out
    // of the app shell.
    const returnPath = isClientApp(req) ? "/app/profile" : "/";

    let session;
    try {
      session = await createCheckoutSession({
        amountCentavos,
        description: `Wallet top-up for ${user.email}`,
        referenceNumber: topup.id,
        metadata: {
          topup_id: topup.id,
          user_id: user.id,
          email: user.email,
        },
        successUrl: `${siteUrl}${returnPath}?topup=processing`,
        cancelUrl: `${siteUrl}${returnPath}?topup=cancelled`,
        idempotencyKey: topup.id,
      });
    } catch (sessionError: any) {
      // Do not leave a dangling pending top-up if the gateway refused.
      await dualWrite(async (client) => {
        return client.from("topups").delete().eq("id", topup.id);
      });
      throw sessionError;
    }

    const { error: linkError } = await supabase
      .from("paymongo_topups")
      .insert([
        {
          user_id: user.id,
          email: user.email,
          topup_id: topup.id,
          amount: normalizedAmount,
          amount_centavos: amountCentavos,
          checkout_session_id: session.id,
          status: "pending",
        },
      ]);

    if (linkError) {
      await dualWrite(async (client) => {
        return client.from("topups").delete().eq("id", topup.id);
      });
      throw linkError;
    }

    return NextResponse.json({
      success: true,
      topupId: topup.id,
      amount: normalizedAmount,
      checkoutUrl: session.checkoutUrl,
    });
  } catch (err: any) {
    console.error("PayMongo checkout API failed:", err);
    return NextResponse.json(
      { error: err?.message || "Could not start the PayMongo checkout." },
      { status: 500 }
    );
  }
}
