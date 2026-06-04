import { NextRequest, NextResponse } from "next/server";
import { parseDescription } from "@/utils/serviceHelpers";
import { findServiceLandingPageForQuery } from "@/lib/serviceLandingPages";

type ServiceKind = "smm" | "gemini" | "pisowifi" | "eap" | "software" | "none";

type OfferedService = {
  id: string;
  title: string;
  description?: unknown;
  starting_price?: number;
  icon_type?: string;
};

type SmmCatalogService = {
  id: string;
  name: string;
  category: string;
  ratePer1k?: number;
  startingPrice?: number;
  min?: number;
  max?: number;
  desc?: string;
};

type Recommendation = {
  kind: "smm" | "service" | "page" | "catalog";
  title: string;
  description: string;
  href: string;
  action: "open_catalog" | "open_order" | "open_page";
  serviceId?: string;
  smmServiceId?: string;
  searchKeyword?: string;
  priceLabel?: string;
  actionLabel?: string;
};

const STOP_WORDS = new Set([
  "a", "an", "and", "ang", "are", "can", "do", "for", "how", "i", "is", "ko", "me",
  "my", "ng", "of", "on", "or", "pa", "po", "sa", "the", "to", "what", "with", "you",
]);

const PLATFORM_ALIASES: Record<string, string[]> = {
  facebook: ["facebook", "fb", "meta"],
  instagram: ["instagram", "ig", "reels", "reel"],
  tiktok: ["tiktok", "tt"],
  youtube: ["youtube", "yt", "shorts", "subscriber", "subscribers"],
  twitter: ["twitter", "x"],
  telegram: ["telegram", "tg"],
};

const INTENT_ALIASES: Record<string, string[]> = {
  follower: ["follower", "followers", "follow", "page follower", "profile follower"],
  subscriber: ["subscriber", "subscribers", "subs", "sub"],
  like: ["like", "likes", "heart", "hearts"],
  reaction: ["reaction", "reactions", "react", "love", "care", "haha", "wow", "sad", "angry"],
  view: ["view", "views", "watch", "plays", "play"],
  comment: ["comment", "comments"],
  share: ["share", "shares"],
  save: ["save", "saves", "favorite", "favorites"],
  member: ["member", "members"],
};

const UTILITY_MATCHERS: Array<{ kind: Exclude<ServiceKind, "smm" | "none">; aliases: string[] }> = [
  { kind: "gemini", aliases: ["gemini", "ai subscription", "pro ai", "google ai"] },
  { kind: "pisowifi", aliases: ["pisowifi", "piso wifi", "wifi vendo", "portal", "captive portal"] },
  { kind: "eap", aliases: ["eap", "tp-link", "tplink", "omada", "controller", "router"] },
  { kind: "software", aliases: ["software", "autocad", "sketchup", "lumion", "revit", "v-ray", "vray", "d5 render", "architectural"] },
];

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return "Search temporarily unavailable.";
}

function tokenize(query: string) {
  return normalize(query)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesAlias(text: string, alias: string) {
  const cleanAlias = normalize(alias);
  if (!cleanAlias) return false;

  if (/^[a-z0-9]+$/.test(cleanAlias) && cleanAlias.length <= 3) {
    return new RegExp(`(^|\\s)${escapeRegExp(cleanAlias)}(\\s|$)`, "i").test(text);
  }

  return text.includes(cleanAlias);
}

function includesAny(text: string, aliases: string[]) {
  return aliases.some((alias) => includesAlias(text, alias));
}

function detectQuery(query: string) {
  const q = normalize(query);
  const platforms = Object.entries(PLATFORM_ALIASES)
    .filter(([, aliases]) => includesAny(q, aliases))
    .map(([platform]) => platform);
  const intents = Object.entries(INTENT_ALIASES)
    .filter(([, aliases]) => includesAny(q, aliases))
    .map(([intent]) => intent);
  const utility = UTILITY_MATCHERS.find((matcher) => includesAny(q, matcher.aliases))?.kind || null;
  const wantsPhBase = includesAny(q, ["ph base", "ph-base", "filipino", "philippines", "pinoy", "local"]);
  const wantsCheap = includesAny(q, ["cheap", "cheapest", "barato", "lowest", "budget", "affordable"]);
  const explicitServiceCue = platforms.length > 0 || intents.length > 0 || utility !== null || wantsPhBase;

  return { q, platforms, intents, utility, wantsPhBase, wantsCheap, explicitServiceCue };
}

function serviceText(service: OfferedService) {
  const parsed = parseDescription(service.description);
  return normalize([
    service.title,
    service.icon_type,
    parsed?.description,
    parsed?.subtitle,
    parsed?.button_text,
    parsed?.smm_original_name,
  ].filter(Boolean).join(" "));
}

function scoreTokens(text: string, tokens: string[]) {
  return tokens.reduce((score, token) => score + (text.includes(token) ? Math.min(12, token.length + 3) : 0), 0);
}

function scoreUtilityService(service: OfferedService, query: string, kind: Exclude<ServiceKind, "smm" | "none">) {
  const text = serviceText(service);
  const matcher = UTILITY_MATCHERS.find((item) => item.kind === kind);
  const aliases = matcher?.aliases || [];
  let score = scoreTokens(text, tokenize(query));
  if (includesAny(text, aliases)) score += 80;
  if (kind === "pisowifi" && includesAny(text, ["wifi", "pisowifi", "piso wifi"])) score += 20;
  if (kind === "software" && includesAny(text, ["license", "architectural", "activated"])) score += 20;
  return score;
}

function findStoredService(services: OfferedService[], query: string, kind: Exclude<ServiceKind, "smm" | "none">) {
  return [...services]
    .map((service) => ({ service, score: scoreUtilityService(service, query, kind) }))
    .sort((a, b) => b.score - a.score || Number(a.service.starting_price || 0) - Number(b.service.starting_price || 0))[0];
}

function scoreSmmService(service: SmmCatalogService, query: string, detected: ReturnType<typeof detectQuery>) {
  const text = normalize(`${service.name} ${service.category} ${service.desc || ""} ${service.id}`);
  let score = scoreTokens(text, tokenize(query));

  if (detected.q === String(service.id).toLowerCase()) score += 150;

  if (detected.platforms.length > 0) {
    const platformMatch = detected.platforms.some((platform) => includesAny(text, PLATFORM_ALIASES[platform] || [platform]));
    score += platformMatch ? 65 : -45;
  }

  if (detected.intents.length > 0) {
    const intentMatch = detected.intents.some((intent) => includesAny(text, INTENT_ALIASES[intent] || [intent]));
    score += intentMatch ? 55 : -20;
  }

  if (detected.wantsPhBase) {
    score += includesAny(text, ["ph base", "ph-base", "philippine", "filipino", "pinoy"]) ? 70 : -35;
  }

  if (detected.wantsCheap && Number.isFinite(service.startingPrice)) {
    score += Math.max(0, 24 - Number(service.startingPrice || 0) * 1000);
  }

  if (includesAny(text, ["no refill", "r0"]) && !includesAny(detected.q, ["cheap", "fast", "no refill"])) {
    score -= 5;
  }

  return score;
}

function pricePer1k(service: SmmCatalogService) {
  const amount = Number(service.ratePer1k || 0);
  return amount > 0 ? `PHP ${amount.toFixed(2)} / 1k` : undefined;
}

async function fetchSmmCatalog(origin: string) {
  try {
    const res = await fetch(`${origin}/api/smm/services`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data as SmmCatalogService[] : [];
  } catch {
    return [];
  }
}

function buildRecommendationFromSmm(service: SmmCatalogService): Recommendation {
  const compactName = service.name.length > 78 ? `${service.name.slice(0, 75).trim()}...` : service.name;
  return {
    kind: "smm",
    title: compactName,
    description: `${service.category || "SMM Service"}${service.min ? ` - min ${service.min.toLocaleString()}` : ""}${service.max ? ` - max ${service.max.toLocaleString()}` : ""}`,
    href: `/?smm_service=${encodeURIComponent(service.id)}`,
    action: "open_catalog",
    smmServiceId: service.id,
    searchKeyword: service.id,
    priceLabel: pricePer1k(service),
    actionLabel: "Open service",
  };
}

function buildRecommendationFromStored(service: OfferedService, kind: Exclude<ServiceKind, "smm" | "none">): Recommendation {
  const parsed = parseDescription(service.description);
  return {
    kind: "service",
    title: service.title,
    description: parsed?.description || parsed?.subtitle || `${kind.toUpperCase()} service package`,
    href: `/?service_id=${encodeURIComponent(service.id)}`,
    action: "open_order",
    serviceId: service.id,
    priceLabel: service.starting_price ? `Starts at PHP ${Number(service.starting_price).toFixed(2)}` : undefined,
    actionLabel: "Open checkout",
  };
}

function fallbackExplanation(query: string, service: ServiceKind, recommendations: Recommendation[]) {
  if (service === "none") {
    return `Here is the clearest answer I can give: ${query.trim()} depends on context, but the best next step is to identify the exact goal, constraints, and desired outcome first. If this is about growing an account or setting up a digital service, I can also route you to the matching PinoyBoosting service link below.`;
  }

  const primary = recommendations[0];
  if (!primary) {
    return "I found the closest matching service category, but the live catalog did not return a precise item yet. You can open the full services catalog and search the same phrase to continue.";
  }

  return `Best match: ${primary.title}. I matched your search to this service using the platform, service type, local/PH-base wording, and price intent in your question. Use the service link below to open the exact package or checkout flow directly.`;
}

async function generateExplanation(query: string, service: ServiceKind, recommendations: Recommendation[]) {
  const fallback = fallbackExplanation(query, service, recommendations);
  const serviceLines = recommendations.slice(0, 3).map((item, index) =>
    `${index + 1}. ${item.title} | ${item.priceLabel || "price varies"} | link ${item.href} | ${item.description}`
  ).join("\n");

  try {
    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: [
          {
            role: "system",
            content: "You are PinoyBoosting's smartest AI search consultant. Answer accurately, use Taglish only when natural, never invent services, and include the exact provided service link when a match exists. Keep it useful in 4-7 concise sentences."
          },
          {
            role: "user",
            content: `Customer question: ${query}\nMatched service category: ${service}\nSpecific service links:\n${serviceLines || "No matched service links."}\nWrite the best answer.`
          }
        ]
      }),
      signal: AbortSignal.timeout(9000),
    });

    if (!res.ok) return fallback;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : fallback;
  } catch {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = String(body.query || "").trim();
    const services = Array.isArray(body.services) ? (body.services as OfferedService[]).slice(0, 100) : [];

    if (!query) {
      return NextResponse.json({ error: "Missing search query" }, { status: 400 });
    }

    const detected = detectQuery(query);
    const recommendations: Recommendation[] = [];
    const landingPage = findServiceLandingPageForQuery(query);
    let service: ServiceKind = "none";
    let searchKeyword = "";

    if (detected.utility) {
      service = detected.utility;
      const match = findStoredService(services, query, detected.utility);
      if (match?.service && match.score >= 25) {
        recommendations.push(buildRecommendationFromStored(match.service, detected.utility));
        searchKeyword = match.service.title;
      }
    } else if (detected.explicitServiceCue) {
      const catalog = await fetchSmmCatalog(req.nextUrl.origin);
      const scored = catalog
        .map((item) => ({ item, score: scoreSmmService(item, query, detected) }))
        .filter((item) => item.score > 20)
        .sort((a, b) => b.score - a.score || Number(a.item.startingPrice || 0) - Number(b.item.startingPrice || 0))
        .slice(0, 3);

      if (scored.length > 0) {
        service = "smm";
        recommendations.push(...scored.map(({ item }) => buildRecommendationFromSmm(item)));
        searchKeyword = scored[0].item.id;
      } else {
        service = "smm";
        searchKeyword = detected.wantsPhBase ? "PH Base" : query;
        recommendations.push({
          kind: "catalog",
          title: "All Services Catalog",
          description: "Open the live catalog filtered to your search phrase.",
          href: `/?smm_search=${encodeURIComponent(searchKeyword)}`,
          action: "open_catalog",
          searchKeyword,
          actionLabel: "Open catalog",
        });
      }
    }

    if (service === "none" && includesAny(detected.q, ["order page", "facebook page", "custom page"])) {
      recommendations.push({
        kind: "page",
        title: "Custom Facebook Page Order",
        description: "Page setup package with profile assets, cover assets, bio, and followers option.",
        href: "/order-page",
        action: "open_page",
        actionLabel: "Open page order",
      });
    }

    if (landingPage && !recommendations.some((item) => item.href === `/services/${landingPage.slug}`)) {
      recommendations.splice(Math.min(1, recommendations.length), 0, {
        kind: "page",
        title: `${landingPage.shortTitle} Service Guide`,
        description: landingPage.description,
        href: `/services/${landingPage.slug}`,
        action: "open_page",
        searchKeyword: landingPage.searchQuery,
        actionLabel: "Read guide",
      });
    }

    const explanation = await generateExplanation(query, service, recommendations);

    return NextResponse.json({
      service,
      search_keyword: searchKeyword,
      explanation,
      recommendations,
      confidence: recommendations.length > 0 ? "high" : service === "none" ? "general" : "medium",
    });
  } catch (err) {
    console.error("AI search route failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
