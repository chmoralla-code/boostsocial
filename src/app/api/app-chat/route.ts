import { NextRequest, NextResponse } from "next/server";
import { formatSmmServiceName, parseDescription } from "@/utils/serviceHelpers";
import { fallbackRead } from "@/utils/supabase/dual-db";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { readServiceCandidatesFromAnyDatabase } from "@/lib/serviceCandidatesServer";
import { readMobileAppSettingsFromAnyDatabase } from "@/lib/mobileAppServer";
import { resolveSmmServiceTitle } from "@/lib/smmServiceResolver";
import {
  hasNeuralwattApiKey,
  NEURALWATT_CHAT_MODEL,
  requestNeuralwattChat,
} from "@/lib/neuralwatt";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ServiceRow = {
  id: string;
  title: string;
  description: unknown;
  starting_price: number | string;
  icon_type?: string | null;
};

type OrderRow = {
  id: string;
  quantity: number;
  target_url: string;
  amount: number | string;
  status: string;
  smm_service_id?: string | number | null;
  customer_email?: string | null;
  services?: { title?: string } | null;
};

/**
 * The chat model is a reasoning model: it needs a generous token budget and
 * enough wall-clock time to finish thinking before `content` appears. These
 * bounds keep the whole provider chain inside the route's `maxDuration`.
 */
const AI_ROUTE_BUDGET_MS = 52_000;
/** Skip a fallback provider unless at least this much of the budget is left. */
const AI_ROUTE_MIN_PROVIDER_MS = 8_000;

/** Keep one message inside the model's budget and stop oversized payloads. */
const MAX_CHAT_MESSAGE_LENGTH = 2_000;

/** Matches a raw order UUID or a customer-facing BS-XXXXXXXX tracking id. */
const ORDER_ID_PATTERN = /BS-[0-9a-f]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const PINOYBOOSTING_INTENT_WORDS = [
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

function normalizeWords(text: string) {
  const stopWords = new Set([
    "the", "and", "for", "with", "what", "how", "can", "you", "ako", "po", "ng", "sa", "is", "are", "best", "service",
    "services", "price", "rate", "need", "want", "buy", "order", "please", "send", "link",
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function scoreText(haystack: string, words: string[]) {
  const cleanHaystack = haystack.toLowerCase();
  return words.reduce((score, word) => score + (cleanHaystack.includes(word) ? 1 : 0), 0);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includesIntentWord(text: string, word: string) {
  const cleanWord = word.toLowerCase();
  if (/^[a-z0-9-]+$/.test(cleanWord) && cleanWord.length <= 4) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(cleanWord)}([^a-z0-9]|$)`).test(text);
  }
  return text.includes(cleanWord);
}

function isPinoyBoostingQuestion(message: string) {
  const normalized = message.toLowerCase();
  return PINOYBOOSTING_INTENT_WORDS.some((word) => includesIntentWord(normalized, word));
}

function servicePriceLabel(service: ServiceRow) {
  const single = service.title.toLowerCase().includes("page")
    || service.title.toLowerCase().includes("gemini")
    || service.title.toLowerCase().includes("pisowifi")
    || service.title.toLowerCase().includes("software")
    || service.title.toLowerCase().includes("license");
  const price = Number(service.starting_price || 0);
  return single ? `PHP ${price.toFixed(2)} per unit` : `PHP ${(price * 1000).toFixed(2)} per 1k`;
}

function serviceAppLink(service: ServiceRow) {
  return `/app?service=${encodeURIComponent(service.id)}`;
}

function isGenericServiceTitle(title: string) {
  return /^(all services|smm catalog explorer|smm service|boost campaign)$/i.test(title.trim());
}

function compactServiceNameFromText(text: string) {
  const combined = text.toLowerCase();
  const platform =
    /\bfacebook\b|\bfb\b/.test(combined) ? "FB" :
    /\binstagram\b|\big\b/.test(combined) ? "IG" :
    combined.includes("tiktok") ? "TikTok" :
    /\byoutube\b|\byt\b/.test(combined) ? "YT" :
    combined.includes("telegram") ? "Telegram" :
    combined.includes("twitter") ? "Twitter" :
    combined.includes("threads") ? "Threads" :
    combined.includes("spotify") ? "Spotify" :
    "";

  const serviceType =
    combined.includes("subscriber") ? "Subscribers" :
    combined.includes("follower") ? "Followers" :
    combined.includes("reaction") || combined.includes("react") ? "Reactions" :
    combined.includes("like") ? "Likes" :
    combined.includes("view") || combined.includes("play") ? "Views" :
    combined.includes("comment") ? "Comments" :
    combined.includes("share") ? "Shares" :
    combined.includes("member") ? "Members" :
    combined.includes("watch hour") ? "Watch Hours" :
    "Boost";

  return [platform || "SMM", serviceType].filter(Boolean).join(" ");
}

function serviceDisplayTitle(service: ServiceRow, message = "") {
  const parsed = parseDescription(service.description);
  const smmServiceId = parsed?.smm_service_id ?? parsed?.smmServiceId ?? parsed?.provider_service_id;
  const providerName = parsed?.smm_original_name ?? parsed?.provider_name ?? parsed?.name;
  const providerDescription = parsed?.description ?? parsed?.subtitle ?? "";

  if (isGenericServiceTitle(service.title)) {
    if (providerName && smmServiceId) {
      return formatSmmServiceName(String(providerName), String(smmServiceId), String(providerDescription));
    }
    if (providerName) return String(providerName);
    if (smmServiceId) return `SMM Service ID ${smmServiceId}`;

    return compactServiceNameFromText([
      message,
      service.icon_type,
      parsed?.subtitle,
      parsed?.description,
      parsed?.button_text,
    ].filter(Boolean).join(" "));
  }

  return service.title;
}

function priceLine(service: ServiceRow, message = "") {
  const parsed = parseDescription(service.description);
  const label = servicePriceLabel(service);
  const title = serviceDisplayTitle(service, message);
  return [
    `- ${title}`,
    `Price: ${label}`,
    `App link: ${serviceAppLink(service)}`,
    parsed?.subtitle || parsed?.description || "",
    parsed?.button_text ? `Button: ${parsed.button_text}` : "",
    parsed?.smm_original_name ? `Provider name: ${parsed.smm_original_name}` : "",
  ].filter(Boolean).join(". ");
}

async function readServices() {
  const { data } = await fallbackRead<ServiceRow[]>(async (client) =>
    await client
      .from("services")
      .select("id,title,description,starting_price,icon_type")
      .order("created_at", { ascending: true })
  );

  return Array.isArray(data) ? data : [];
}

function topServicesForQuery(services: ServiceRow[], message: string) {
  const words = normalizeWords(message);
  if (words.length === 0) return services.slice(0, 18);

  return [...services]
    .map((service) => {
      const parsed = parseDescription(service.description);
      const text = [
        service.title,
        service.icon_type,
        parsed?.subtitle,
        parsed?.description,
        parsed?.button_text,
        parsed?.smm_original_name,
      ].filter(Boolean).join(" ");

      return { service, score: scoreText(text, words) };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.service.title).localeCompare(String(b.service.title)))
    .slice(0, 18)
    .map((item) => item.service);
}

function topCandidatesForQuery(candidates: Awaited<ReturnType<typeof readServiceCandidatesFromAnyDatabase>>, message: string) {
  const words = normalizeWords(message);
  if (words.length === 0) return isPinoyBoostingQuestion(message) ? candidates : [];

  const matched = [...candidates]
    .map((candidate) => ({
      candidate,
      score: scoreText([
        candidate.id,
        candidate.tag,
        candidate.title,
        candidate.caption,
        candidate.description,
        candidate.rate_text,
      ].filter(Boolean).join(" "), words),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.candidate);

  return matched.length > 0 ? matched : isPinoyBoostingQuestion(message) ? candidates : [];
}

/**
 * Resolve the signed-in customer's email. The order lookup must never run for
 * an anonymous caller: `orders.target_url` stores portal usernames and
 * passwords for the PisoWiFi / EAP services, so an ungated lookup handed a
 * stranger another customer's credentials.
 */
async function getRequestEmail(): Promise<string | null> {
  try {
    const sessionClient = await createServerClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();
    const email = user?.email?.trim().toLowerCase();
    return email || null;
  } catch {
    return null;
  }
}

/**
 * Hide any credential a service asked the customer to paste into the target
 * field, so the chat can never echo a password back to the screen.
 */
function maskSensitiveTarget(value: string) {
  const text = String(value || "").trim();
  if (!text) return "Not set";
  if (!/password|pwd|username|user\s*[:=]/i.test(text)) return text;

  return text
    .replace(/(password|pass|pwd)(\s*[:=]\s*)[^\],;\n]+/gi, "$1$2••••••")
    .replace(/(username|user)(\s*[:=]\s*)[^\],;\n]+/gi, "$1$2••••••");
}

/**
 * The provider balance drives the "orders may queue" wording. Return a status
 * only, never the amount: the number is internal and the model was echoing it
 * back to customers on request.
 */
async function readProviderFundingStatus() {
  const apiKey = process.env.RIXEYSMM_API_KEY;
  if (!apiKey) return "Unknown";

  try {
    const res = await fetch("https://rixeysmm.shop/api/v2", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: apiKey,
        action: "balance",
      }),
      signal: AbortSignal.timeout(6500),
    });

    if (!res.ok) return "Unknown";
    const data = await res.json();
    const balance = Number(data.balance || 0);
    if (!Number.isFinite(balance)) return "Unknown";
    return balance > 0 ? "Funded" : "Low - new orders may queue";
  } catch {
    return "Unknown";
  }
}

function limitText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 20).trim()}\n[truncated]`;
}

function textPromptFromMessages(messages: ChatMessage[]) {
  const system = messages.find((message) => message.role === "system")?.content || "";
  const recentChat = messages
    .filter((message) => message.role !== "system")
    .slice(-6)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");

  return [
    "Return only the assistant reply. Do not include role labels.",
    "Answer naturally and humanlike. Keep it accurate, concise, and helpful.",
    `SYSTEM AND LIVE PINOYBOOSTING DATA:\n${limitText(system, 4800)}`,
    `RECENT CHAT:\n${limitText(recentChat, 1600)}`,
    "ASSISTANT:",
  ].join("\n\n");
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
      temperature: 0.7,
      timeoutMs: Math.min(45_000, remainingMs),
    });
    return completion.message.content?.trim() || "";
  } catch (error) {
    console.warn("NeuralWatt app chat request failed:", error);
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
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(Math.min(20_000, remainingMs)),
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("OpenCode Go API returned non-OK status:", res.status);
      return "";
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return "";
    return content;
  } catch (error) {
    console.warn("OpenCode Go API request failed:", error);
    return "";
  }
}

async function askPollinationsText(messages: ChatMessage[], remainingMs: number): Promise<string> {
  const model = process.env.POLLINATIONS_TEXT_MODEL || process.env.POLLINATIONS_MODEL || "openai";
  const prompt = textPromptFromMessages(messages);
  const params = new URLSearchParams({
    model,
    seed: String(Date.now()),
    referrer: "pinoyboosting-apk",
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

    if (!res.ok) {
      console.warn("Pollinations returned non-OK status:", res.status);
      return "";
    }

    const content = (await res.text()).trim();
    if (!content || content.startsWith("{\"error\"")) return "";
    return content;
  } catch (error) {
    console.warn("Pollinations request failed:", error);
    return "";
  }
}

async function askAI(messages: ChatMessage[], remainingMs: () => number): Promise<string> {
  const neuralwatt = await askNeuralwatt(messages, remainingMs());
  if (neuralwatt) return neuralwatt;

  if (remainingMs() >= AI_ROUTE_MIN_PROVIDER_MS) {
    const openCodeGo = await askOpenCodeGo(messages, remainingMs());
    if (openCodeGo) return openCodeGo;
  }

  if (remainingMs() >= AI_ROUTE_MIN_PROVIDER_MS) {
    const pollinations = await askPollinationsText(messages, remainingMs());
    if (pollinations) return pollinations;
  }

  return "";
}

function liveDataFallback(
  matchedServices: ServiceRow[],
  matchedCandidates: Awaited<ReturnType<typeof readServiceCandidatesFromAnyDatabase>>,
  message: string
) {
  if (matchedServices.length > 0) {
    return [
      "🔍 Got you! I checked the live services and these are the closest matches:",
      ...matchedServices.slice(0, 4).map((service) =>
        `➡️ ${serviceDisplayTitle(service, message)}: ${servicePriceLabel(service)}. Open ${serviceAppLink(service)}`
      ),
      "📋 You can browse first, but login is needed before checkout. If you want, I can also help you pick the cheapest or safest option.",
    ].join("\n");
  }

  if (matchedCandidates.length > 0) {
    return [
      "📂 Sure! I found a few service categories that fit what you asked:",
      ...matchedCandidates.slice(0, 4).map((candidate) =>
        `➡️ ${candidate.title}: ${candidate.rate_text || "Rate varies"}. Open /app`
      ),
      "📲 Open /app to view them. Login is only required when you are ready to buy.",
    ].join("\n");
  }

  return localFallback(message);
}

async function findOrder(message: string, requesterEmail: string) {
  const uuidMatch = message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const trackMatch = message.match(/BS-([0-9a-f]{8})/i);
  if (!uuidMatch && !trackMatch) return null;

  const { data } = await fallbackRead<OrderRow>(async (client) => {
    let query = client
      .from("orders")
      .select("id,quantity,target_url,amount,status,smm_service_id,customer_email,services(title)")
      // Ownership check: an order is only ever readable by the account that
      // placed it. Without this, any caller could read any order.
      .eq("customer_email", requesterEmail);

    if (uuidMatch) {
      query = query.eq("id", uuidMatch[0]);
    } else if (trackMatch) {
      const lowerHex = trackMatch[1].toLowerCase();
      query = query
        .gte("id", `${lowerHex}-0000-0000-0000-000000000000`)
        .lte("id", `${lowerHex}-ffff-ffff-ffff-ffffffffffff`);
    }
    return await query.single();
  });

  if (!data) {
    const label = uuidMatch ? uuidMatch[0] : `BS-${trackMatch?.[1]?.toUpperCase()}`;
    return `❌ I could not find that order on your account: ${label}. Please copy the Tracking ID from your checkout screen and try again, and make sure you are logged in with the account that placed the order.`;
  }

  const displayId = `BS-${data.id.slice(0, 8).toUpperCase()}`;
  const serviceTitle = await resolveSmmServiceTitle(data.smm_service_id, data.services?.title || "Service");
  return [
    "✅ I found your order!",
    `📦 Tracking ID: ${displayId}`,
    `📋 Service: ${serviceTitle}`,
    `🔢 Quantity: ${Number(data.quantity || 0).toLocaleString()}`,
    `🔗 Target: ${maskSensitiveTarget(data.target_url)}`,
    `💰 Amount: PHP ${Number(data.amount || 0).toFixed(2)}`,
    `📊 Status: ${data.status}`,
    "📲 Open /app/orders to view this inside the APK.",
    data.status === "Pending"
      ? "⏳ Next step: this order is still waiting for payment. Open /app/profile to top up your wallet, then pay the order from your balance - it starts processing right away."
      : data.status === "Processing"
        ? "⚙️ Your order is already processing, so delivery is active now."
        : data.status === "Completed"
          ? "🎉 Your order is completed! Please check the target link when you have a moment."
          : "💬 If this status looks wrong, send a message to support and we will check it.",
  ].join("\n");
}

function localFallback(message: string) {
  const text = message.toLowerCase();
  if (text.includes("creator") || text.includes("created") || text.includes("built") || text.includes("made") || text.includes("developer") || text.includes("who made") || text.includes("who own")) {
    return "This app was created by Cyrhiel Moralla. You can check out his Facebook here: [Cyrhiel Moralla](https://www.facebook.com/profile.php?id=61584774638218)";
  }
  if (text.includes("top up") || text.includes("top-up") || text.includes("topup") || text.includes("wallet")) {
    return "💰 Sure! Login at /app/auth?mode=login, then open /app/profile and tap Top Up Wallet. PayMongo handles the payment (GCash, Maya and more) and your balance is credited automatically - no admin approval needed.";
  }
  if (text.includes("gcash") || text.includes("payment") || text.includes("bayad") || text.includes("receipt")) {
    return "💳 Payments are now fully automated through our secure PayMongo checkout (GCash, Maya and more). Top up your wallet first, then every order is paid instantly from your balance - no receipt uploads and no waiting for approval.";
  }
  if (text.includes("login") || text.includes("register") || text.includes("account")) {
    return "🔐 No problem! Use /app/auth?mode=login if you already have an account, or /app/auth?mode=register if you are new. After login, buying will be unlocked.";
  }
  if (text.includes("pisowifi") || text.includes("piso wifi")) {
    return "📶 Yes, PisoWiFi packages are available! Open /app, tap PISOWIFI PACKAGE under SERVICES, then choose Starter, Professional, or Enterprise. Login is required only before checkout.";
  }
  return "👋 I can help with that! Open /app to browse SERVICES, or tell me the platform and goal — Facebook followers, TikTok views, PisoWiFi, or top-up help. If you have an order, send a Tracking ID like BS-D5D1D849 and I will check it.";
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let userMessage = "";

  try {
    // The AI calls are the most expensive thing on the site, so this route is
    // rate-limited like every other public endpoint.
    const rateLimitResponse = enforceRateLimit(request, {
      key: "app-chat-post",
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages as ChatMessage[] : [];
    userMessage = latestUserMessage(messages);

    if (!userMessage) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    if (userMessage.length > MAX_CHAT_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or fewer.` },
        { status: 400 }
      );
    }

    // Order lookup is owner-only: no session means no order data at all.
    if (ORDER_ID_PATTERN.test(userMessage)) {
      const requesterEmail = await getRequestEmail();
      if (!requesterEmail) {
        return NextResponse.json({
          content: "🔐 To check an order, please log in first at /app/auth?mode=login. Orders are private to the account that placed them, so I can only look them up after you sign in.",
        });
      }

      const orderReply = await findOrder(userMessage, requesterEmail);
      if (orderReply) {
        return NextResponse.json({ content: orderReply });
      }
    }

    const [services, candidates, appSettings, providerFunding] = await Promise.all([
      readServices(),
      readServiceCandidatesFromAnyDatabase(),
      readMobileAppSettingsFromAnyDatabase(),
      readProviderFundingStatus(),
    ]);

    const matchedServices = topServicesForQuery(services, userMessage);
    const matchedCandidates = topCandidatesForQuery(candidates, userMessage);
    const pinoyBoostingQuestion = isPinoyBoostingQuestion(userMessage);
    const serviceContext = matchedServices.map((service) => priceLine(service, userMessage)).join("\n");
    const candidateContext = matchedCandidates.slice(0, 12).map((candidate) =>
      `- ${candidate.tag || candidate.title}: ${candidate.title}. ${candidate.description}. Rate: ${candidate.rate_text || "varies"}. App link: /app`
    ).join("\n");

    const promptMessages: ChatMessage[] = [
      {
        role: "system",
        content: [
          "You are the PinoyBoosting mobile app AI assistant. Sound like a calm, friendly human support rep, but never pretend to be a real human.",
          "Your accuracy must come from the live data below. Do not invent packages, prices, discounts, durations, or policies.",
          "You may answer general questions outside PinoyBoosting too. For non-service questions, answer normally and humanlike without forcing a sales answer.",
          "Answer in concise English, Taglish when natural. Use warm phrases like 'Got you', 'Sure', or 'No worries' only when they fit. Avoid stiff chatbot lines.",
          "Use relevant emojis naturally in your replies to make them more readable and friendly. Use 1-3 emojis per message, placed at the start of key lines or sentences. Do not overuse emojis or put them on every word.",
          "Start with the direct answer, then give the useful next step. If the user is vague, ask one simple follow-up question instead of listing too much.",
          "If live data is missing, say exactly what is available and suggest the nearest app action.",
          "Always mention the exact app link from live service rows, /app for general service cards, /app/profile for wallet top-ups, /app/auth?mode=login for login, /app/auth?mode=register for signup, and /app/orders for orders when relevant.",
          "When a client asks for a specific service, name the closest live candidate or stored service exactly, include the price/rate if available, and include the exact /app?service=... link when one is available. If multiple services match, recommend the most relevant 2-4.",
          "Buying is prohibited until the client logs in or registers.",
          "Keep answers short: 3-6 useful sentences or a few short bullets. Do not overuse exclamation marks. Do not mention internal provider IDs unless the user gives a Tracking ID or asks for admin details.",
          "For questions about pricing, always show the exact price from live data. If the price is per 1k, say 'per 1k'. If it's per unit, say 'per unit'.",
          "For order tracking, ask for the Tracking ID (format: BS-XXXXXXXX) if not provided.",
          "CREATOR INFO: If anyone asks who created, built, made, or owns this website/app, or asks about the developer/creator, answer: 'This app was created by Cyrhiel Moralla. You can check out his Facebook here: [Cyrhiel Moralla](https://www.facebook.com/profile.php?id=61584774638218)'. Always include the clickable link. Do not invent any other creator names.",
          `Realtime snapshot: ${new Date().toISOString()}`,
          `Mobile app name: ${appSettings.appName}`,
          `Mobile app banner: ${appSettings.appBanner || "None"}`,
          `Provider funding status: ${providerFunding}`,
          "Never reveal internal provider balances, supplier names, cost prices, or internal service IDs to the customer. If asked, say the team monitors capacity and move on.",
          "Live candidate services matching this question:",
          candidateContext,
          "Live stored services matching this question:",
          serviceContext,
          services.length > matchedServices.length ? `Total stored services available: ${services.length}` : "",
        ].join("\n"),
      },
      ...messages.slice(-8), // Increased context window for better conversation
    ];

    // Share one deadline across the provider chain so a slow reasoning model
    // cannot push the route past maxDuration.
    const aiStartedAt = Date.now();
    const aiRemainingMs = () => Math.max(0, AI_ROUTE_BUDGET_MS - (Date.now() - aiStartedAt));

    const content = await askAI(promptMessages, aiRemainingMs);
    const fallbackContent = pinoyBoostingQuestion
      ? liveDataFallback(matchedServices, matchedCandidates, userMessage)
      : "⏳ I can help with that, but the AI service is temporarily busy. Please send the question again in a few seconds, or ask me about services, wallet top-up, or an order Tracking ID.";

    return NextResponse.json({
      content: content || fallbackContent,
    });
  } catch (error) {
    console.error("App chat route failed:", error);
    return NextResponse.json({
      content: localFallback(userMessage || getErrorMessage(error)),
    });
  }
}
