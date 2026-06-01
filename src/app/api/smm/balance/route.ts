import { NextResponse } from "next/server";
import { getPrimaryAdminClient } from "@/utils/supabase/dual-db";
import { notifyLowProviderBalanceIfNeeded } from "@/lib/providerBalanceMonitor";

export async function GET() {
  try {
    const apiKey = process.env.RIXEYSMM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ balance: 0.0 });
    }

    const res = await fetch("https://rixeysmm.shop/api/v2", {
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
      return NextResponse.json({ balance: 0.0 });
    }

    const data = await res.json();
    const balance = Number(data.balance || 0);

    try {
      await notifyLowProviderBalanceIfNeeded(getPrimaryAdminClient(), balance);
    } catch (alertErr) {
      console.error("Provider balance monitor failed:", alertErr);
    }

    return NextResponse.json({ balance });
  } catch (err) {
    console.error("Failed fetching SMM balance:", err);
    return NextResponse.json({ balance: 0.0 });
  }
}
