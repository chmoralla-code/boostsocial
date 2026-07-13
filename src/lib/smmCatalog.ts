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

export async function getSmmCatalogServices() {
  const markupMultiplier = await getMarkupMultiplier();
  const apiKey = process.env.RIXEYSMM_API_KEY?.replace(/[\'"\r\n]/g, "").trim();
  if (!apiKey) return getFallbackCatalog(markupMultiplier);

  const now = Date.now();
  if (cachedServices && cachedServicesById && now - lastFetchTime < CACHE_TTL) {
    return { services: cachedServices, source: "memory_cache" };
  }

  try {
    const res = await fetch(RIXEYSMM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ key: apiKey, action: "services" }),
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error(`RixeySMM API returned status ${res.status}`);

    const services = await res.json();
    if (!Array.isArray(services)) throw new Error("Invalid response format from RixeySMM API");

    cachedServices = services.map((s: RixeyService) => processRixeyService(s, markupMultiplier)).filter(Boolean) as SmmCatalogService[];
    indexServicesById(cachedServices);
    lastFetchTime = now;
    return { services: cachedServices, source: "rixeysmm" };
  } catch (error) {
    console.error("Failed fetching SMM services catalog:", error);
    const fallback = await getFallbackCatalog(markupMultiplier);
    if (fallback.services.length > 0) {
      indexServicesById(fallback.services);
      return fallback;
    }
    throw new Error(`SMM services are currently unavailable. ${getErrorMessage(error)}`);
  }
}

export async function getSmmCatalogServiceById(serviceId: string | number) {
  const id = String(serviceId);
  if (cachedServicesById && Date.now() - lastFetchTime < CACHE_TTL) {
    const hit = cachedServicesById.get(id);
    if (hit) return hit;
  }

  const { services } = await getSmmCatalogServices();
  if (!cachedServicesById) indexServicesById(services);
  return cachedServicesById?.get(id) || null;
}
