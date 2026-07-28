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
  // Full catalog is ~900+ services and commonly takes 8–12s from serverless.
  const timeoutMs = options?.timeoutMs ?? 15000;
  const res = await fetch(RIXEYSMM_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, action: "services" }),
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

  // Prefer live Rixey when the key is set. Returning the small stored Supabase
  // snapshot first left delisted IDs (e.g. #118) in the UI and broke orders.
  try {
    const live = await fetchLiveRixeyCatalog(apiKey, markupMultiplier);
    if (live.services.length > 0) return live;
  } catch (error) {
    console.error("Failed fetching SMM services catalog:", error);
  }

  const fallback = await getFallbackCatalog(markupMultiplier);
  if (fallback.services.length > 0) return fallback;

  throw new Error("SMM services are currently unavailable.");
}

/**
 * Resolve one SMM provider service by ID.
 * Prefers memory cache, then live Rixey (when keyed), then stored Supabase.
 * Stored-only IDs must not win over a successful live catalog that lacks them
 * (provider delists services; our DB snapshot can stay stale).
 */
export async function getSmmCatalogServiceById(serviceId: string | number) {
  const id = String(serviceId);
  if (cachedServicesById?.has(id)) {
    return cachedServicesById.get(id) || null;
  }

  const markupMultiplier = await getMarkupMultiplier();
  const apiKey = process.env.RIXEYSMM_API_KEY?.replace(/[\'"\r\n]/g, "").trim();

  if (apiKey) {
    try {
      const live = await fetchLiveRixeyCatalog(apiKey, markupMultiplier);
      if (cachedServicesById?.has(id)) {
        return cachedServicesById.get(id) || null;
      }
      // Live catalog loaded successfully but this ID is gone — do not fall back
      // to a stale stored row for the same provider service id.
      if (live.services.length > 0) return null;
    } catch (error) {
      console.error(`Failed live lookup for SMM service #${id}:`, getErrorMessage(error));
    }
  }

  try {
    const stored = await getStoredServicesFallback(markupMultiplier);
    const fromStored = stored.find((service) => String(service.id) === id);
    if (fromStored) {
      if (!cachedServicesById) cachedServicesById = new Map();
      cachedServicesById.set(id, fromStored);
      return fromStored;
    }
  } catch (error) {
    console.warn("Stored catalog lookup failed:", getErrorMessage(error));
  }

  return null;
}
