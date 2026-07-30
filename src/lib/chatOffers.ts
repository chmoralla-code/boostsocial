import type { SmmCatalogService } from "@/lib/smmCatalog";

export const CHAT_CATALOG_SERVICE_ID = "e6f61249-71fe-40df-84f3-96d03d3e8dcf";

const BLOCKED_SERVICE_IDS = new Set(["118"]);
const CHEAPEST_ALIASES = ["cheap", "cheapest", "lowest", "budget", "affordable", "barato", "mura"];
const ALL_CATALOG_ALIASES = [
  "all smm",
  "all smm orders",
  "all smm offers",
  "all smm services",
  "every smm order",
  "every smm offer",
  "every smm service",
  "all social media",
  "all social media orders",
  "all social media offers",
  "all social media services",
  "all social",
  "all offers",
  "all services",
  "every platform",
];

const PLATFORM_ALIASES = {
  facebook: ["facebook", "fb", "meta"],
  instagram: ["instagram", "ig"],
  tiktok: ["tiktok", "tik tok"],
  youtube: ["youtube", "yt", "shorts"],
  telegram: ["telegram", "tg"],
  twitter: ["twitter", "x.com", " x "],
} as const;

const INTENT_ALIASES = {
  followers: ["follower", "followers", "follow"],
  likes: ["like", "likes", "heart", "hearts"],
  reactions: ["reaction", "reactions", "love", "care", "haha", "wow"],
  views: ["view", "views", "watch", "plays"],
  comments: ["comment", "comments"],
  shares: ["share", "shares"],
  subscribers: ["subscriber", "subscribers", "subs"],
  members: ["member", "members"],
} as const;

export type ChatOfferIntent = keyof typeof INTENT_ALIASES;
export type ChatOfferPlatform = keyof typeof PLATFORM_ALIASES;

export type ChatOfferCandidate = {
  platform: ChatOfferPlatform | "all";
  service: SmmCatalogService;
  estimatedMinimumTotal: number;
};

export type DetectedChatOfferQuery = {
  isOfferQuery: boolean;
  showAllCatalog: boolean;
  platform: ChatOfferPlatform | null;
  intent: ChatOfferIntent | null;
};

function normalize(value: unknown) {
  return ` ${String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

function includesAny(text: string, aliases: readonly string[]) {
  return aliases.some((alias) => text.includes(normalize(alias)));
}

function serviceText(service: SmmCatalogService) {
  return normalize(`${service.name} ${service.category} ${service.desc || ""}`);
}

function validCatalogService(service: SmmCatalogService) {
  const startingPrice = Number(service.startingPrice);
  const minimum = Number(service.min);
  const maximum = Number(service.max);

  return (
    Boolean(service.id) &&
    !BLOCKED_SERVICE_IDS.has(String(service.id)) &&
    Number.isFinite(startingPrice) &&
    startingPrice > 0 &&
    Number.isFinite(minimum) &&
    minimum > 0 &&
    (!Number.isFinite(maximum) || maximum <= 0 || maximum >= minimum)
  );
}

function matchesPlatform(service: SmmCatalogService, platform: ChatOfferPlatform) {
  return includesAny(serviceText(service), PLATFORM_ALIASES[platform]);
}

function matchesIntent(service: SmmCatalogService, intent: ChatOfferIntent) {
  return includesAny(serviceText(service), INTENT_ALIASES[intent]);
}

function detectServicePlatform(service: SmmCatalogService): ChatOfferPlatform | "all" {
  const platform = (Object.keys(PLATFORM_ALIASES) as ChatOfferPlatform[])
    .find((candidate) => matchesPlatform(service, candidate));
  return platform || "all";
}

function estimatedMinimumTotal(service: SmmCatalogService) {
  return Number(Math.max(Number(service.startingPrice) * Math.max(Number(service.min), 1), 5).toFixed(2));
}

function cheapestCandidate(
  services: SmmCatalogService[],
  platform: ChatOfferPlatform | null,
  intent: ChatOfferIntent | null
): ChatOfferCandidate | null {
  const matches = services
    .filter(validCatalogService)
    .filter((service) => !platform || matchesPlatform(service, platform))
    .filter((service) => !intent || matchesIntent(service, intent))
    .map((service) => ({
      platform: platform || "all",
      service,
      estimatedMinimumTotal: estimatedMinimumTotal(service),
    } satisfies ChatOfferCandidate))
    .sort((a, b) =>
      a.estimatedMinimumTotal - b.estimatedMinimumTotal ||
      Number(a.service.startingPrice) - Number(b.service.startingPrice) ||
      Number(a.service.id) - Number(b.service.id)
    );

  return matches[0] || null;
}

export function detectChatOfferQuery(query: string): DetectedChatOfferQuery {
  const text = normalize(query);
  const showAllCatalog = includesAny(text, ALL_CATALOG_ALIASES);
  const platformEntry = Object.entries(PLATFORM_ALIASES).find(([, aliases]) => includesAny(text, aliases));
  const intentEntry = Object.entries(INTENT_ALIASES).find(([, aliases]) => includesAny(text, aliases));
  const hasCheapestIntent = includesAny(text, CHEAPEST_ALIASES);

  return {
    isOfferQuery: showAllCatalog || hasCheapestIntent,
    showAllCatalog,
    platform: (platformEntry?.[0] as ChatOfferPlatform | undefined) || null,
    intent: (intentEntry?.[0] as ChatOfferIntent | undefined) || null,
  };
}

export function selectAllChatOfferCandidates(
  services: SmmCatalogService[],
  query: string
): ChatOfferCandidate[] {
  const detected = detectChatOfferQuery(query);
  if (!detected.showAllCatalog) return [];

  const platformOrder = new Map(
    (Object.keys(PLATFORM_ALIASES) as ChatOfferPlatform[])
      .map((platform, index) => [platform, index])
  );

  return services
    .filter(validCatalogService)
    .filter((service) => !detected.platform || matchesPlatform(service, detected.platform))
    .filter((service) => !detected.intent || matchesIntent(service, detected.intent))
    .map((service) => ({
      platform: detectServicePlatform(service),
      service,
      estimatedMinimumTotal: estimatedMinimumTotal(service),
    } satisfies ChatOfferCandidate))
    .sort((a, b) =>
      (platformOrder.get(a.platform as ChatOfferPlatform) ?? Number.MAX_SAFE_INTEGER) -
        (platformOrder.get(b.platform as ChatOfferPlatform) ?? Number.MAX_SAFE_INTEGER) ||
      a.service.category.localeCompare(b.service.category) ||
      a.estimatedMinimumTotal - b.estimatedMinimumTotal ||
      a.service.name.localeCompare(b.service.name) ||
      Number(a.service.id) - Number(b.service.id)
    );
}

export function selectChatOfferCandidates(
  services: SmmCatalogService[],
  query: string
): ChatOfferCandidate[] {
  const detected = detectChatOfferQuery(query);
  if (!detected.isOfferQuery) return [];

  const candidate = cheapestCandidate(services, detected.platform, detected.intent);
  return candidate ? [candidate] : [];
}
