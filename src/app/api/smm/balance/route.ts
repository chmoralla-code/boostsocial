import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getPrimaryAdminClient } from "@/utils/supabase/dual-db";
import { notifyLowProviderBalanceIfNeeded } from "@/lib/providerBalanceMonitor";
import { enforceRateLimit } from "@/utils/security/rate-limit";

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

async function getRequestEmail(): Promise<string | null> {
  try {
    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    return user?.email?.trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

/**
 * Reports whether the provider account is funded, not how much is in it.
 *
 * The exact figure used to be returned to anyone who called this endpoint,
 * which leaked our supplier float to competitors and made the chatbot quote it
 * back to customers. The callers only ever needed the yes/no: it decides the
 * "your order may be queued" notice on the checkout and track screens.
 */
export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "smm-balance-get",
      maxRequests: 60,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const requesterEmail = await getRequestEmail();
    if (!requesterEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.RIXEYSMM_API_KEY?.replace(/['"\r\n]/g, "").trim();

    // A missing key is not the same as an unfunded account, so report it as
    // unknown rather than letting it read as a real zero balance.
    if (!apiKey) {
      return NextResponse.json({ funded: true, ok: false, status: "missing_key" });
    }

    const res = await fetch(RIXEYSMM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        key: apiKey,
        action: "balance",
      }),
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });

    if (!res.ok) {
      // The panel answers a bad key with HTTP 400 + {"error":"Invalid API key"}.
      return NextResponse.json({ funded: true, ok: false, status: "provider_error" });
    }

    const data = await res.json();

    if (data?.error) {
      return NextResponse.json({ funded: true, ok: false, status: "provider_error" });
    }

    const balance = Number(data.balance || 0);
    const funded = !Number.isFinite(balance) || balance > 0;

    // Only alert on a balance we actually read from the provider.
    try {
      await notifyLowProviderBalanceIfNeeded(getPrimaryAdminClient(), balance);
    } catch (alertErr) {
      console.error("Provider balance monitor failed:", alertErr);
    }

    return NextResponse.json({ funded, ok: true, status: "ok" });
  } catch (err) {
    console.error("Failed fetching SMM balance:", err);
    return NextResponse.json({ funded: true, ok: false, status: "network_error" });
  }
}
