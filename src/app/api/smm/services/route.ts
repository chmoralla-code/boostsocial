import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseDescription } from "@/utils/serviceHelpers";

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";

type RixeyService = {
  service?: string | number;
  name?: string;
  category?: string;
  rate?: string | number;
  min?: string | number;
  max?: string | number;
  desc?: string;
};

type SmmCatalogService = {
  id: string;
  name: string;
  category: string;
  originalRate: number;
  ratePer1k: number;
  startingPrice: number;
  min: number;
  max: number;
  desc: string;
  source?: string;
};

// Simple in-memory cache for development/server instances
let cachedServices: SmmCatalogService[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

async function getStoredServicesFallback() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("services")
    .select("id, title, description, starting_price, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const seen = new Set<string>();

  return (data || [])
    .map((service) => {
      const parsed = parseDescription(service.description);
      const smmServiceId = parsed?.smm_service_id ? String(parsed.smm_service_id) : "";
      if (!smmServiceId || seen.has(smmServiceId)) {
        return null;
      }

      seen.add(smmServiceId);

      const startingPrice = Number(service.starting_price || 0);
      const ratePer1k = Number.isFinite(startingPrice) ? Number((startingPrice * 1000).toFixed(6)) : 0;
      const originalRate = Number(parsed?.smm_original_rate || (ratePer1k > 0 ? ratePer1k / 2 : 0));

      return {
        id: smmServiceId,
        name: parsed?.smm_original_name || parsed?.subtitle || service.title,
        category: parsed?.subtitle || service.title || "Stored SMM Services",
        originalRate,
        ratePer1k,
        startingPrice,
        min: Number(parsed?.smm_min || parsed?.min_quantity || 100),
        max: Number(parsed?.smm_max || 10000),
        desc: parsed?.description || parsed?.smm_original_name || "",
        source: "stored_catalog",
      };
    })
    .filter(Boolean);
}

async function getFallbackCatalog() {
  if (cachedServices?.length) {
    return {
      services: cachedServices,
      source: "stale_rixeysmm_cache",
    };
  }

  const storedServices = await getStoredServicesFallback();
  return {
    services: storedServices,
    source: "stored_supabase_catalog",
  };
}

export async function GET() {
  try {
    const apiKey = process.env.RIXEYSMM_API_KEY;
    if (!apiKey) {
      const fallback = await getFallbackCatalog();
      if (fallback.services.length > 0) {
        return NextResponse.json(fallback.services, {
          headers: {
            "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
            "X-SMM-Catalog-Source": fallback.source,
          },
        });
      }

      return NextResponse.json({ error: "SMM catalog is unavailable." }, { status: 503 });
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

    const services = (await res.json()) as unknown;
    if (!Array.isArray(services)) {
      throw new Error("Invalid response format from RixeySMM API");
    }

    // Automatically multiply to x2 of reseller's price
    const markupMultiplier = 2.0;

    // Process and enrich services
    const processedServices = (services as RixeyService[]).flatMap((s): SmmCatalogService[] => {
      if (s.service === undefined || s.service === null || !s.name) {
        return [];
      }

      const originalRate = Number(s.rate || 0);
      const ourRatePer1k = originalRate * markupMultiplier;
      const ourPricePerPiece = ourRatePer1k / 1000;

      return [{
        id: String(s.service),
        name: s.name,
        category: s.category || "General Services",
        originalRate,
        ratePer1k: ourRatePer1k,
        startingPrice: ourPricePerPiece,
        min: Number(s.min || 100),
        max: Number(s.max || 10000),
        desc: s.desc || ""
      }];
    });

    // Save in cache
    cachedServices = processedServices;
    lastFetchTime = now;

    return NextResponse.json(processedServices, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });

  } catch (err: unknown) {
    console.error("Failed fetching SMM services catalog:", err);
    try {
      const fallback = await getFallbackCatalog();
      if (fallback.services.length > 0) {
        return NextResponse.json(fallback.services, {
          headers: {
            "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
            "X-SMM-Catalog-Source": fallback.source,
          },
        });
      }
    } catch (fallbackErr) {
      console.error("Stored SMM catalog fallback failed:", fallbackErr);
    }

    return NextResponse.json({
      error: "SMM services are currently unavailable.",
      details: getErrorMessage(err)
    }, { status: 503 });
  }
}
