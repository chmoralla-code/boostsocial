import { NextResponse } from "next/server";
import { getPrimaryAdminClient } from "@/utils/supabase/dual-db";
import { notifyLowProviderBalanceIfNeeded } from "@/lib/providerBalanceMonitor";

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

export async function GET() {
  const apiKey = process.env.RIXEYSMM_API_KEY?.replace(/['"\r\n]/g, "").trim();

  // A missing key is not the same as an unfunded account. Keep `balance` at 0
  // for existing callers but make the reason explicit so an unconfigured local
  // environment doesn't look like a real zero balance in the admin UI.
  if (!apiKey) {
    return NextResponse.json({
      balance: 0.0,
      ok: false,
      status: "missing_key",
      error: "RIXEYSMM_API_KEY is not configured.",
    });
  }

  try {
    const res = await fetch(RIXEYSMM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        key: apiKey,
        action: "balance",
      }),
    });

    if (!res.ok) {
      // The panel answers a bad key with HTTP 400 + {"error":"Invalid API key"}.
      return NextResponse.json({
        balance: 0.0,
        ok: false,
        status: "provider_error",
        error: `RixeySMM returned HTTP ${res.status}. The API key is most likely missing, malformed or revoked.`,
      });
    }

    const data = await res.json();

    if (data?.error) {
      return NextResponse.json({
        balance: 0.0,
        ok: false,
        status: "provider_error",
        error: String(data.error),
      });
    }

    const balance = Number(data.balance || 0);

    // Only alert on a balance we actually read from the provider.
    try {
      await notifyLowProviderBalanceIfNeeded(getPrimaryAdminClient(), balance);
    } catch (alertErr) {
      console.error("Provider balance monitor failed:", alertErr);
    }

    return NextResponse.json({ balance, ok: true, status: "ok" });
  } catch (err) {
    console.error("Failed fetching SMM balance:", err);
    return NextResponse.json({
      balance: 0.0,
      ok: false,
      status: "network_error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
