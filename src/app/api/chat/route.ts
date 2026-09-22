import { NextResponse } from 'next/server';
import {
  hasNeuralwattApiKey,
  NEURALWATT_CHAT_MODEL,
  requestNeuralwattChat,
} from "@/lib/neuralwatt";
import { getSmmCatalogServices, type SmmCatalogService } from "@/lib/smmCatalog";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const HUMAN_SUPPORT_SYSTEM: ChatMessage = {
  role: "system",
  content: [
    "You are PinoyBoosting's customer support assistant.",
    "Sound natural, warm, and humanlike, but never claim to be a real human.",
    "You can answer general questions outside PinoyBoosting too. For non-service questions, answer normally instead of forcing a sales or support answer.",
    "Start with the direct answer, then give the next step. Keep it short unless the customer asks for detail.",
    "Use light Taglish (Tagalog-English mix) or Bisaya when it fits the customer's wording. Avoid robotic phrases, hype, and repeated exclamation marks.",
    "Use relevant emojis naturally in your replies to make them more readable and friendly (1-3 emojis per message).",
    "Never invent prices, order statuses, discounts, timelines, or policies. If unsure, say what you can verify and ask one simple follow-up.",
    "PRICING: a LIVE PRICING list from our own SERVICES catalog is provided below when the customer asks about price. Quote those exact numbers. Never guess a price that is not in that list.",
    "Quote social media prices per 1k (for example: PHP 25.18 per 1k) and mention the minimum order quantity when you have it.",
    "For buying, guide users to choose a service, submit the target link, pay with GCash or wallet, and upload the receipt screenshot.",
    "GCash Payment Info: 09505339963 • Henry S. (Direct GCash / InstaPay transfer accepted).",
    "BPI Bank Transfer Info: Account #4059901356.",
    "For orders, ask for a Tracking ID like BS-D5D1D849 if they did not provide one.",
    "CREATOR INFO: If anyone asks who created, built, made, or owns this website/app, or asks about the developer/creator, answer: 'This website was created by Cyrhiel Moralla. You can check out his Facebook here: [Cyrhiel Moralla](https://www.facebook.com/profile.php?id=61584774638218)'. Always include the clickable link. Do not invent any other creator names.",
  ].join(" "),
};

const SUPPORT_INTENT_WORDS = [
  "pinoyboosting", "cynetwork", "service", "services", "price", "pricing", "rate", "rates", "magkano", "package",
  "order", "tracking", "track", "status", "gcash", "payment", "receipt", "wallet", "topup", "top-up", "login",
  "register", "account", "facebook", "fb", "instagram", "ig", "tiktok", "youtube", "telegram", "followers",
  "follower", "likes", "like", "reactions", "reaction", "views", "view", "comments", "shares", "subscribers",
  "pisowifi", "piso wifi", "wifi", "gemini", "software", "autocad", "sketchup", "revit", "eap", "tp-link",
  "creator", "created", "developer", "built", "made", "owner", "cyrhiel", "moralla",
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function latestUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content?.trim() || "";
}

function sanitizeMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((message) => {
      if (!message || typeof message !== "object") return null;
      const item = message as Partial<ChatMessage>;
      if (item.role !== "user" && item.role !== "assistant" && item.role !== "system") return null;
      if (typeof item.content !== "string" || !item.content.trim()) return null;
      return { role: item.role, content: item.content.trim() };
    })
    .filter((message): message is ChatMessage => Boolean(message));
}

function textPromptFromMessages(messages: ChatMessage[]) {
  return messages
    .map((m) => `${m.role === "assistant" ? "Assistant" : m.role === "system" ? "System" : "User"}: ${m.content}`)
    .join("\n\n");
}

async function askNeuralwatt(messages: ChatMessage[], remainingMs: number): Promise<string> {
  if (!hasNeuralwattApiKey()) return "";
  try {
    const completion = await requestNeuralwattChat({
      model: NEURALWATT_CHAT_MODEL,
      messages,
      // The configured model is a reasoning model: it needs room to finish
      // thinking before it emits an answer, otherwise `content` comes back
      // empty and the caller falls through to a canned reply.
      maxTokens: 2048,
      temperature: 0.55,
      timeoutMs: Math.min(45_000, remainingMs),
    });
    return completion.message.content?.trim() || "";
  } catch (err) {
    console.warn("NeuralWatt chat request failed:", err);
    return "";
  }
}

async function askOpenCodeGo(messages: ChatMessage[], remainingMs: number): Promise<string> {
  const apiKey = process.env.OPENCODE_API_KEY;
  if (!apiKey) return "";

  try {
    const res = await fetch("https://opencode.ai/zen/go/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "mimo-v2.5",
        messages,
        max_tokens: 2048,
        temperature: 0.55,
      }),
      signal: AbortSignal.timeout(Math.min(20_000, remainingMs)),
      cache: "no-store",
    });

    if (!res.ok) return "";
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.warn("OpenCode Go API request failed:", err);
    return "";
  }
}

async function askPollinationsText(messages: ChatMessage[], remainingMs: number): Promise<string> {
  const model = process.env.POLLINATIONS_TEXT_MODEL || process.env.POLLINATIONS_MODEL || "openai";
  const prompt = textPromptFromMessages(messages);
  const params = new URLSearchParams({
    model,
    seed: String(Date.now()),
    referrer: "pinoyboosting-chathead",
    json: "false",
  });
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(Math.min(15_000, remainingMs)),
      cache: "no-store",
    });

    if (!res.ok) return "";
    const content = (await res.text()).trim();
    if (!content || content.startsWith("{\"error\"")) return "";
    return content;
  } catch (error) {
    console.warn("Pollinations request failed:", error);
    return "";
  }
}

function humanFallback(message: string) {
  const text = message.toLowerCase();

  if (text.includes("creator") || text.includes("created") || text.includes("built") || text.includes("made") || text.includes("developer") || text.includes("who made") || text.includes("who own")) {
    return "This website was created by Cyrhiel Moralla. You can check out his Facebook here: [Cyrhiel Moralla](https://www.facebook.com/profile.php?id=61584774638218)";
  }

  // Reached only when the live catalog AND the model both failed, so we must
  // not quote a number here: a cached guess would disagree with the website.
  if (isPriceQuestion(text)) {
    return "💰 I could not load the live price list just now. Please send your question again in a moment, or open the SERVICES section to see the current rates. Tell me the platform and goal (for example \"FB followers\") and I will pull the exact price.";
  }

  if (text.includes("gcash") || text.includes("payment") || text.includes("bayad") || text.includes("receipt")) {
    return "💳 Yes, you can pay with GCash (09505339963 • Henry S.) or BPI Bank Transfer (#4059901356)! After checkout, upload the receipt screenshot here so admin can verify it and start processing your order.";
  }

  if (text.includes("track") || text.includes("status") || text.includes("order")) {
    return "📦 No worries! Send your Tracking ID (example: BS-D5D1D849) and I can check the order status for you.";
  }

  if (text.includes("login") || text.includes("register") || text.includes("account")) {
    return "🔐 You can register or login before buying so your orders and wallet stay saved to your account. After login, go back to SERVICES and continue from there.";
  }

  return "👋 Got you! Tell me what you want to grow or set up — Facebook followers, reactions, views, PisoWiFi, or wallet top-up — and I will guide you to the right next step.";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The chat model is a reasoning model: it needs a generous token budget and
 * enough wall-clock time to finish thinking before `content` appears. These
 * bounds keep the whole provider chain inside the route's `maxDuration`, which
 * used to be overrun when a reasoning request outlived its own timeout.
 */
const AI_ROUTE_BUDGET_MS = 52_000;
/** Skip a fallback provider unless at least this much of the budget is left. */
const AI_ROUTE_MIN_PROVIDER_MS = 8_000;

function includesIntentWord(text: string, word: string) {
  const cleanWord = word.toLowerCase();
  if (/^[a-z0-9-]+$/.test(cleanWord) && cleanWord.length <= 4) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(cleanWord)}([^a-z0-9]|$)`).test(text);
  }
  return text.includes(cleanWord);
}

function isSupportQuestion(message: string) {
  const normalized = message.toLowerCase();
  return SUPPORT_INTENT_WORDS.some((word) => includesIntentWord(normalized, word));
}

// ---------------------------------------------------------------------------
// LIVE PRICING
// Pulled from the exact catalog the SERVICES page renders, so the chatbot and
// the website can never quote two different numbers. The markup multiplier is
// already applied inside getSmmCatalogServices().
// ---------------------------------------------------------------------------

/** Longest we wait for the provider catalog before answering without prices.
 *  Kept well under the AI budget so a slow catalog still leaves time to answer. */
const PRICE_CATALOG_TIMEOUT_MS = 8_000;
/** Cap injected price lines so the prompt stays inside the token budget. */
const MAX_PRICE_LINES = 14;

const PRICE_INTENT_WORDS = [
  "price", "prices", "pricing", "rate", "rates", "magkano", "how much", "presyo",
  "cost", "package", "packages", "per 1k", "per1k", "tag pila", "pila",
];

const PLATFORM_WORDS: Record<string, string[]> = {
  facebook: ["facebook", "fb", "meta"],
  instagram: ["instagram", "ig"],
  tiktok: ["tiktok", "tik tok"],
  youtube: ["youtube", "yt", "shorts"],
  telegram: ["telegram", "tg"],
  twitter: ["twitter", "x com"],
  spotify: ["spotify"],
  threads: ["threads"],
  twitch: ["twitch"],
  whatsapp: ["whatsapp"],
};

const SERVICE_WORDS: Record<string, string[]> = {
  followers: ["follower", "followers"],
  likes: ["like", "likes"],
  reactions: ["reaction", "reactions", "react"],
  views: ["view", "views", "play", "plays"],
  comments: ["comment", "comments"],
  shares: ["share", "shares"],
  subscribers: ["subscriber", "subscribers", "subs"],
  members: ["member", "members"],
  watchtime: ["watch hour", "watch hours", "watch time", "watchtime", "monetization"],
};

function normalizePriceText(value: string) {
  return ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

function includesPhrase(haystack: string, phrase: string) {
  return haystack.includes(normalizePriceText(phrase));
}

function servicePriceText(service: SmmCatalogService) {
  return normalizePriceText(`${service.name} ${service.category} ${service.desc || ""}`);
}

function isPriceQuestion(message: string) {
  const text = normalizePriceText(message);
  return PRICE_INTENT_WORDS.some((word) => includesPhrase(text, word));
}

function detectedKeys(message: string, table: Record<string, string[]>) {
  const text = normalizePriceText(message);
  return Object.entries(table)
    .filter(([, aliases]) => aliases.some((alias) => includesPhrase(text, alias)))
    .map(([key]) => key);
}

/** Rank the catalog against the question: platform and service type both score. */
function rankPriceServices(services: SmmCatalogService[], message: string) {
  const platforms = detectedKeys(message, PLATFORM_WORDS);
  const kinds = detectedKeys(message, SERVICE_WORDS);
  const text = normalizePriceText(message);
  const idMatches = [...text.matchAll(/\s(\d{2,6})\s/g)].map((match) => match[1]);

  const usable = services.filter((service) => Boolean(service.id) && Number(service.ratePer1k) > 0);
  const scored = usable.map((service) => {
    const haystack = servicePriceText(service);
    // A service whose own NAME says "Instagram Likes" must outrank a service
    // that only mentions the word somewhere in its description.
    const name = normalizePriceText(service.name);
    const hit = (aliases: string[]) => {
      if (aliases.some((alias) => includesPhrase(name, alias))) return 4;
      if (aliases.some((alias) => includesPhrase(haystack, alias))) return 1;
      return 0;
    };

    let score = 0;
    for (const key of platforms) score += hit(PLATFORM_WORDS[key]);
    for (const key of kinds) score += hit(SERVICE_WORDS[key]);
    if (idMatches.includes(String(service.id))) score += 12;
    return { service, score };
  });

  const hasFilter = platforms.length > 0 || kinds.length > 0 || idMatches.length > 0;
  if (hasFilter) {
    const matched = scored.filter((item) => item.score > 0);
    return matched
      .sort((a, b) => b.score - a.score || Number(a.service.ratePer1k) - Number(b.service.ratePer1k))
      .slice(0, MAX_PRICE_LINES)
      .map((item) => item.service);
  }

  return [];
}

/**
 * When the customer asks for prices in general ("list all prices"), return the
 * cheapest option per platform so the answer stays short and always real.
 */
function buildPriceOverview(services: SmmCatalogService[]) {
  const picks: SmmCatalogService[] = [];

  for (const platform of Object.keys(PLATFORM_WORDS)) {
    const cheapest = services
      .filter((service) => Boolean(service.id) && Number(service.ratePer1k) > 0)
      .filter((service) => PLATFORM_WORDS[platform].some((alias) => includesPhrase(servicePriceText(service), alias)))
      .sort((a, b) => Number(a.ratePer1k) - Number(b.ratePer1k))[0];

    if (cheapest) picks.push(cheapest);
  }

  return picks.slice(0, MAX_PRICE_LINES);
}

function pickPriceServices(services: SmmCatalogService[], message: string) {
  const ranked = rankPriceServices(services, message);
  return ranked.length > 0 ? ranked : buildPriceOverview(services);
}

/** The exact price list handed to the model as ground truth. */
function buildPriceContext(services: SmmCatalogService[]) {
  return services
    .map((service) =>
      `- ${service.name} (ID ${service.id}, ${service.category}): PHP ${Number(service.ratePer1k).toFixed(2)} per 1k; minimum ${Number(service.min) || 1} units; find it at /?smm_search=${encodeURIComponent(service.name)}`
    )
    .join("\n");
}

/** Deterministic answer, used when the model is unavailable so prices still work. */
function priceAnswer(services: SmmCatalogService[]) {
  if (services.length === 0) return "";

  return [
    "💰 Here are the live prices straight from our SERVICES catalog:",
    ...services.map(
      (service) => `* **${service.name}** — PHP ${Number(service.ratePer1k).toFixed(2)} per 1k (minimum ${Number(service.min) || 1} units)`
    ),
    "Tap SERVICES on the site to order, or tell me the platform and goal (for example \"FB followers\") and I'll narrow it down.",
  ].join("\n");
}

async function loadLiveCatalog() {
  // Hold the timer so it can be cleared: an orphaned timer keeps the
  // serverless invocation alive after the response is already sent.
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const catalog = await Promise.race([
      getSmmCatalogServices(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("price catalog timeout")), PRICE_CATALOG_TIMEOUT_MS);
      }),
    ]);

    return Array.isArray(catalog?.services) ? catalog.services : [];
  } catch (error) {
    console.warn("Live price catalog unavailable:", getErrorMessage(error));
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const cleanMessages = sanitizeMessages(messages);

    if (cleanMessages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const latestMessage = latestUserMessage(cleanMessages);

    // One deadline covers the whole request, catalog lookup included, so the
    // route can never overrun maxDuration.
    const aiStartedAt = Date.now();
    const aiRemainingMs = () => Math.max(0, AI_ROUTE_BUDGET_MS - (Date.now() - aiStartedAt));

    // Prices come from the live catalog the SERVICES page renders. We fetch it
    // only for price questions, so normal chat stays fast.
    const priceQuestion = isPriceQuestion(latestMessage);
    const priceServices = priceQuestion ? pickPriceServices(await loadLiveCatalog(), latestMessage) : [];
    const priceContext = priceServices.length > 0
      ? `LIVE PRICING (our own SERVICES catalog, markup already included):\n${buildPriceContext(priceServices)}`
      : "";

    // Fold the price list into the one system prompt: several providers reject
    // a request that carries more than one system message.
    const systemPrompt: ChatMessage = priceContext
      ? { role: "system", content: `${HUMAN_SUPPORT_SYSTEM.content} ${priceContext}` }
      : HUMAN_SUPPORT_SYSTEM;

    const apiMessages: ChatMessage[] = [
      systemPrompt,
      ...cleanMessages.filter((message) => message.role !== "system").slice(-8),
    ];

    // Multi-tier AI Engine: NeuralWatt -> OpenCode -> Pollinations
    let content = await askNeuralwatt(apiMessages, aiRemainingMs());
    if (!content && aiRemainingMs() >= AI_ROUTE_MIN_PROVIDER_MS) {
      content = await askOpenCodeGo(apiMessages, aiRemainingMs());
    }
    if (!content && aiRemainingMs() >= AI_ROUTE_MIN_PROVIDER_MS) {
      content = await askPollinationsText(apiMessages, aiRemainingMs());
    }

    if (content) {
      return NextResponse.json({ content });
    }

    // The model produced nothing: answer from real catalog data when we have it,
    // instead of deflecting the customer to another page.
    const catalogAnswer = priceAnswer(priceServices);
    if (catalogAnswer) {
      return NextResponse.json({ content: catalogAnswer });
    }

    const supportQuestion = isSupportQuestion(latestMessage);
    return NextResponse.json({
      content: supportQuestion
        ? humanFallback(latestMessage)
        : "👋 I can help with that! Tell me what service you're interested in (Facebook, TikTok, Instagram, YouTube, PisoWiFi), or send your Tracking ID (e.g. BS-D5D1D849) to check an existing order.",
    });

  } catch (err: unknown) {
    console.error('Chat endpoint error:', err);
    return NextResponse.json({ error: getErrorMessage(err) || 'Internal Server Error' }, { status: 500 });
  }
}
