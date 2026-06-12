import { SupabaseClient } from "@supabase/supabase-js";
import { getFBReactionRetailPrice, getFBReactionsSMMDetails } from "@/utils/fbReactions";
import { parseDescription } from "@/utils/serviceHelpers";
import { getSmmCatalogServiceById } from "@/lib/smmCatalog";

const CATALOG_SERVICE_ID = "e6f61249-71fe-40df-84f3-96d03d3e8dcf";
const CUSTOM_PAGE_SMM_ID = "1141";
const BASE_PAGE_PRICE = 1999;
const INCLUDED_PAGE_FOLLOWERS = 10000;
const FALLBACK_PAGE_FOLLOWER_PRICE = 0.02752;
const MIN_ORDER_AMOUNT = 5;

type ServiceRow = {
  id: string;
  title: string;
  description: unknown;
  starting_price: number | string;
  price_per_unit?: number | string | null;
  min_quantity?: number | string | null;
  max_quantity?: number | string | null;
  smm_service_id?: string | number | null;
};

export type ResolvedOrderPricing = {
  serviceId: string;
  serviceTitle: string;
  quantity: number;
  regularAmount: number;
  smmServiceId: string | null;
};

type ResolveArgs = {
  client: SupabaseClient;
  serviceId: string;
  quantity: number;
  targetUrl?: string;
  requestedSmmServiceId?: string | number | null;
};

function toNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function isSingleItemService(title: string) {
  return /page|gemini|piso\s*wifi|pisowifi|eap|tplink|software|license|architectural|autonomous|bot/i.test(title);
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function parseSelectedReactions(targetUrl: string) {
  const match = targetUrl.match(/Reactions:\s*\[([^\]]+)\]/i);
  if (!match?.[1]) return null;

  const values = match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return values.length > 0 ? values : null;
}

function isCustomPageOrder(targetUrl: string, requestedSmmServiceId?: string | number | null) {
  if (String(requestedSmmServiceId || "") !== CUSTOM_PAGE_SMM_ID) return false;
  return /^Page Wants:/i.test(targetUrl.trim()) || /custom facebook page|Compiling custom Facebook page/i.test(targetUrl);
}

async function fetchService(client: SupabaseClient, serviceId: string): Promise<ServiceRow> {
  const { data, error } = await client
    .from("services")
    .select("id, title, description, starting_price, price_per_unit, min_quantity, max_quantity, smm_service_id")
    .eq("id", serviceId)
    .single();

  if (error || !data) {
    throw new Error("Selected service was not found.");
  }

  return data as ServiceRow;
}

export async function resolveOrderPricing({
  client,
  serviceId,
  quantity,
  targetUrl = "",
  requestedSmmServiceId,
}: ResolveArgs): Promise<ResolvedOrderPricing> {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
    throw new Error("Invalid order quantity.");
  }

  const service = await fetchService(client, serviceId);
  const parsed = parseDescription(service.description) || {};
  const title = String(service.title || "SMM Service");
  const isCatalog = service.id === CATALOG_SERVICE_ID || /^all services$/i.test(title.trim());
  const cleanRequestedSmmId = requestedSmmServiceId === undefined || requestedSmmServiceId === null
    ? ""
    : String(requestedSmmServiceId).trim();

  if (isCatalog && cleanRequestedSmmId) {
    const catalogService = await getSmmCatalogServiceById(cleanRequestedSmmId);
    if (!catalogService) {
      throw new Error("Selected SMM provider service is not available.");
    }

    const minimumQuantity = Math.max(Number(catalogService.min || 1), 1);
    const finalQuantity = Math.max(quantity, minimumQuantity);
    const maximumQuantity = Number(catalogService.max || 0);
    if (maximumQuantity > 0 && finalQuantity > maximumQuantity) {
      throw new Error(`Quantity cannot exceed ${maximumQuantity.toLocaleString()}.`);
    }

    const regularAmount = isCustomPageOrder(targetUrl, cleanRequestedSmmId)
      ? BASE_PAGE_PRICE + Math.max(finalQuantity - INCLUDED_PAGE_FOLLOWERS, 0) * (catalogService.startingPrice || FALLBACK_PAGE_FOLLOWER_PRICE)
      : Math.max(finalQuantity * catalogService.startingPrice, MIN_ORDER_AMOUNT);

    return {
      serviceId: service.id,
      serviceTitle: `[SMM #${catalogService.id}] ${catalogService.name}`,
      quantity: finalQuantity,
      regularAmount: roundMoney(regularAmount),
      smmServiceId: String(catalogService.id),
    };
  }

  const singleItem = isSingleItemService(title);
  const minimumQuantity = singleItem
    ? 1
    : Math.max(toNumber(parsed.min_quantity ?? parsed.smm_min ?? service.min_quantity, 100), 1);
  const finalQuantity = Math.max(quantity, minimumQuantity);
  const maximumQuantity = toNumber(parsed.smm_max ?? service.max_quantity, 0);
  if (maximumQuantity > 0 && finalQuantity > maximumQuantity) {
    throw new Error(`Quantity cannot exceed ${maximumQuantity.toLocaleString()}.`);
  }

  const reactions = /reaction|react/i.test(title) ? parseSelectedReactions(targetUrl) : null;
  if (reactions) {
    const reactionDetails = getFBReactionsSMMDetails(reactions);
    return {
      serviceId: service.id,
      serviceTitle: title,
      quantity: finalQuantity,
      regularAmount: roundMoney(Math.max(finalQuantity * getFBReactionRetailPrice(reactions), MIN_ORDER_AMOUNT)),
      smmServiceId: String(reactionDetails.smmId),
    };
  }

  const canonicalSmmId = parsed.smm_service_id || service.smm_service_id || null;
  const unitPrice = toNumber(service.price_per_unit ?? service.starting_price, 0);
  if (unitPrice <= 0) {
    throw new Error("Selected service has invalid pricing.");
  }

  if (cleanRequestedSmmId && canonicalSmmId && String(canonicalSmmId) !== cleanRequestedSmmId) {
    throw new Error("Selected provider service does not match this product.");
  }

  return {
    serviceId: service.id,
    serviceTitle: title,
    quantity: finalQuantity,
    regularAmount: roundMoney(Math.max(finalQuantity * unitPrice, MIN_ORDER_AMOUNT)),
    smmServiceId: canonicalSmmId ? String(canonicalSmmId) : null,
  };
}
