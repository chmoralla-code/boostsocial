import { NextResponse } from "next/server";

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

// Simple in-memory cache for development/server instances
let cachedServices: any[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

export async function GET() {
  try {
    const apiKey = process.env.RIXEYSMM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RixeySMM API Key is missing on the server" }, { status: 500 });
    }

    const now = Date.now();
    if (cachedServices && (now - lastFetchTime < CACHE_TTL)) {
      return NextResponse.json(cachedServices, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }

    // Fetch from RixeySMM API
    const res = await fetch(RIXEYSMM_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        key: apiKey,
        action: "services",
      }),
      next: { revalidate: 300 } // Next.js level caching (5 minutes)
    });

    if (!res.ok) {
      throw new Error(`RixeySMM API returned status ${res.status}`);
    }

    const services: any[] = await res.json();
    if (!Array.isArray(services)) {
      throw new Error("Invalid response format from RixeySMM API");
    }

    // Automatically multiply to x2 of reseller's price
    const markupMultiplier = 2.0;

    // Process and enrich services
    const processedServices = services.map(s => {
      const originalRate = Number(s.rate || 0);
      const ourRatePer1k = originalRate * markupMultiplier;
      const ourPricePerPiece = ourRatePer1k / 1000;

      return {
        id: s.service,
        name: s.name,
        category: s.category || "General Services",
        originalRate,
        ratePer1k: ourRatePer1k,
        startingPrice: ourPricePerPiece,
        min: Number(s.min || 100),
        max: Number(s.max || 10000),
        desc: s.desc || ""
      };
    });

    // Save in cache
    cachedServices = processedServices;
    lastFetchTime = now;

    return NextResponse.json(processedServices, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });

  } catch (err: any) {
    console.error("Failed fetching SMM services catalog:", err);
    // Strict Lockdown: Do not make services available when they did not fetch from Rixeysmm
    return NextResponse.json({ 
      error: "Rixeysmm services are currently unavailable.",
      details: err.message || err.toString()
    }, { status: 503 });
  }
}
