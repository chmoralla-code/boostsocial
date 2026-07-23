import { createClient } from "@supabase/supabase-js";
import { parseDescription } from "@/utils/serviceHelpers";
import { getMarkupMultiplier } from "@/lib/markupConfig";

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";
const CACHE_TTL = 5 * 60 * 1000;

type RixeyService = {
  service?: string | number;
  name?: string;
  category?: string;
  rate?: string | number;
  min?: string | number;
  max?: string | number;
  desc?: string;
};

export type SmmCatalogService = {
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

let cachedServices: SmmCatalogService[] | null = null;
let cachedServicesById: Map<string, SmmCatalogService> | null = null;
let lastFetchTime = 0;

function indexServicesById(services: SmmCatalogService[]) {
  cachedServicesById = new Map(services.map((service) => [String(service.id), service]));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function processRixeyService(service: RixeyService, markupMultiplier: number): SmmCatalogService | null {
  if (service.service === undefined || service.service === null || !service.name) {
    return null;
  }

  const originalRate = Number(service.rate || 0);
  const ratePer1k = originalRate * markupMultiplier;

  return {
    id: String(service.service),
    name: service.name,
    category: service.category || "General Services",
    originalRate,
    ratePer1k,
    startingPrice: ratePer1k / 1000,
    min: Number(service.min || 100),
    max: Number(service.max || 10000),
    desc: service.desc || "",
  };
}

async function getStoredServicesFallback(markupMultiplier: number) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) return [];

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from("services")
    .select("id, title, description, starting_price, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const seen = new Set<string>();
  return (data || [])
    .map((service) => {
      const parsed = parseDescription(service.description);
      const smmServiceId = parsed?.smm_service_id ? String(parsed.smm_service_id) : "";
      if (!smmServiceId || seen.has(smmServiceId)) return null;

      seen.add(smmServiceId);

      const startingPrice = Number(service.starting_price || 0);
      const ratePer1k = Number.isFinite(startingPrice) ? Number((startingPrice * 1000).toFixed(6)) : 0;
      const originalRate = Number(parsed?.smm_original_rate || (ratePer1k > 0 ? ratePer1k / markupMultiplier : 0));

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
      } as SmmCatalogService;
    })
    .filter(Boolean) as SmmCatalogService[];
}

async function getFallbackCatalog(markupMultiplier: number) {
  if (cachedServices?.length) {
    return { services: cachedServices, source: "stale_rixeysmm_cache" };
  }

  return { services: await getStoredServicesFallback(markupMultiplier), source: "stored_supabase_catalog" };
}

async function fetchLiveRixeyCatalog(
  apiKey: string,
  markupMultiplier: number,
  options?: { timeoutMs?: number }
) {
  const timeoutMs = options?.timeoutMs ?? 2500;
  const res = await fetch(RIXEYSMM_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, action: "services" }),
    // Keep default live fetches short so order creation stays snappy.
    // Lookup-by-id paths may pass a longer timeout.
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`RixeySMM API returned status ${res.status}`);

  const services = await res.json();
  if (!Array.isArray(services)) throw new Error("Invalid response format from RixeySMM API");

  cachedServices = services.map((s: RixeyService) => processRixeyService(s, markupMultiplier)).filter(Boolean) as SmmCatalogService[];
  indexServicesById(cachedServices);
  lastFetchTime = Date.now();
  return { services: cachedServices, source: "rixeysmm" as const };
}

export async function getSmmCatalogServices() {
  const markupMultiplier = await getMarkupMultiplier();
  const apiKey = process.env.RIXEYSMM_API_KEY?.replace(/[\'"\r\n]/g, "").trim();
  if (!apiKey) return getFallbackCatalog(markupMultiplier);

  const now = Date.now();
  if (cachedServices && cachedServicesById && now - lastFetchTime < CACHE_TTL) {
    return { services: cachedServices, source: "memory_cache" };
  }

  // Prefer stored/stale catalog immediately; refresh live catalog in the background.
  // This keeps /api/orders/create fast on cold serverless instances.
  const fallbackPromise = getFallbackCatalog(markupMultiplier);
  const livePromise = fetchLiveRixeyCatalog(apiKey, markupMultiplier).catch((error) => {
    console.error("Failed fetching SMM services catalog:", error);
    return null;
  });

  const fallback = await fallbackPromise;
  if (fallback.services.length > 0) {
    if (!cachedServicesById) indexServicesById(fallback.services);
    // Warm cache from live provider without blocking the caller.
    void livePromise.then((live) => {
      if (live?.services?.length) {
        cachedServices = live.services;
        indexServicesById(live.services);
        lastFetchTime = Date.now();
      }
    });
    return fallback;
  }

  const live = await livePromise;
  if (live?.services?.length) return live;

  throw new Error("SMM services are currently unavailable.");
}

/**
 * Resolve one SMM provider service by ID.
 * If the fast fallback/stale cache does not contain the ID (common for catalog
 * services that only exist on RixeySMM), force a live provider fetch so orders
 * don't fail with a false "temporarily unavailable".
 */
export async function getSmmCatalogServiceById(serviceId: string | number) {
  const id = String(serviceId);
  if (cachedServicesById) {
    const hit = cachedServicesById.get(id);
    if (hit) return hit;
  }

  const { services } = await getSmmCatalogServices();
  if (!cachedServicesById) indexServicesById(services);
  const fromCache = cachedServicesById?.get(id);
  if (fromCache) return fromCache;

  // Missed in fallback/stale catalog — wait for live Rixey list.
  const apiKey = process.env.RIXEYSMM_API_KEY?.replace(/[\'"\r\n]/g, "").trim();
  if (!apiKey) return null;

  try {
    const markupMultiplier = await getMarkupMultiplier();
    const live = await fetchLiveRixeyCatalog(apiKey, markupMultiplier, { timeoutMs: 6000 });
    return live.services.find((service) => String(service.id) === id) || cachedServicesById?.get(id) || null;
  } catch (error) {
    console.error(`Failed live lookup for SMM service #${id}:`, getErrorMessage(error));
    return null;
  }
}
