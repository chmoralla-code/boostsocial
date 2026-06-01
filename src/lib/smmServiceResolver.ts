import { formatSmmServiceName } from "@/utils/serviceHelpers";

const RIXEYSMM_API_URL = "https://rixeysmm.shop/api/v2";
const SERVICE_CACHE_TTL_MS = 5 * 60 * 1000;

type RixeyService = {
  service?: string | number;
  id?: string | number;
  name?: string;
  desc?: string;
  category?: string;
};

type ServiceJoin = {
  title?: string | null;
};

type OrderWithService = {
  smm_service_id?: string | number | null;
  services?: ServiceJoin | ServiceJoin[] | null;
};

let cachedServiceMap: Map<string, RixeyService> | null = null;
let cachedAt = 0;
let pendingServiceMap: Promise<Map<string, RixeyService>> | null = null;

function getCandidateTitle(orderOrTitle: string | OrderWithService) {
  if (typeof orderOrTitle === "string") return orderOrTitle;

  const services = orderOrTitle.services;
  if (Array.isArray(services)) return services[0]?.title || "";
  return services?.title || "";
}

function isGenericCandidateTitle(title: string) {
  return /^(all services|smm catalog explorer|smm service|boost campaign)$/i.test(title.trim());
}

function fallbackTitle(smmServiceId?: string | number | null, fallback?: string | null) {
  const cleanFallback = String(fallback || "").trim();
  const cleanId = smmServiceId === undefined || smmServiceId === null ? "" : String(smmServiceId).trim();

  if (cleanId) {
    if (cleanFallback && !isGenericCandidateTitle(cleanFallback)) {
      return `${cleanFallback} - SMM ID ${cleanId}`;
    }
    return `SMM Service ID ${cleanId}`;
  }

  if (cleanFallback && !isGenericCandidateTitle(cleanFallback)) return cleanFallback;
  return "Specific SMM Service";
}

async function getRixeyServiceMap() {
  const now = Date.now();
  if (cachedServiceMap && now - cachedAt < SERVICE_CACHE_TTL_MS) {
    return cachedServiceMap;
  }

  if (pendingServiceMap) return pendingServiceMap;

  pendingServiceMap = fetchRixeyServiceMap().finally(() => {
    pendingServiceMap = null;
  });

  return pendingServiceMap;
}

async function fetchRixeyServiceMap() {
  const now = Date.now();
  const apiKey = process.env.RIXEYSMM_API_KEY?.replace(/['"\r\n]/g, "").trim();
  if (!apiKey) {
    cachedServiceMap = new Map();
    cachedAt = now;
    return cachedServiceMap;
  }

  const res = await fetch(RIXEYSMM_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      key: apiKey,
      action: "services",
    }),
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`RixeySMM services lookup failed with status ${res.status}`);
  }

  const services = await res.json();
  const map = new Map<string, RixeyService>();

  if (Array.isArray(services)) {
    for (const service of services as RixeyService[]) {
      const serviceId = service.service ?? service.id;
      if (serviceId !== undefined && serviceId !== null) {
        map.set(String(serviceId), service);
      }
    }
  }

  cachedServiceMap = map;
  cachedAt = now;
  return map;
}

export async function resolveSmmServiceTitle(
  smmServiceId?: string | number | null,
  fallback?: string | null
) {
  const cleanId = smmServiceId === undefined || smmServiceId === null ? "" : String(smmServiceId).trim();
  if (!cleanId) return fallbackTitle(null, fallback);

  try {
    const serviceMap = await getRixeyServiceMap();
    const service = serviceMap.get(cleanId);
    if (service?.name) {
      return formatSmmServiceName(service.name, cleanId, service.desc || service.category || "");
    }
  } catch (error) {
    console.error("SMM service title lookup failed:", error);
  }

  return fallbackTitle(cleanId, fallback);
}

export async function enrichOrdersWithResolvedServiceTitles<T extends OrderWithService>(orders: T[] | null | undefined) {
  if (!orders?.length) return [];

  return Promise.all(
    orders.map(async (order) => ({
      ...order,
      resolved_service_title: await resolveSmmServiceTitle(order.smm_service_id, getCandidateTitle(order)),
    }))
  );
}
