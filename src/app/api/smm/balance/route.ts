import { NextResponse } from "next/server";

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
    return NextResponse.json({ balance: Number(data.balance || 0) });
  } catch (err) {
    console.error("Failed fetching SMM balance:", err);
    return NextResponse.json({ balance: 0.0 });
  }
}
