import { NextResponse } from 'next/server';
import {
  hasNeuralwattApiKey,
  NEURALWATT_CHAT_MODEL,
  requestNeuralwattChat,
} from "@/lib/neuralwatt";

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

async function askNeuralwatt(messages: ChatMessage[]): Promise<string> {
  if (!hasNeuralwattApiKey()) return "";
  try {
    const completion = await requestNeuralwattChat({
      model: NEURALWATT_CHAT_MODEL,
      messages,
      maxTokens: 600,
      temperature: 0.55,
      timeoutMs: 20_000,
    });
    return completion.message.content?.trim() || "";
  } catch (err) {
    console.warn("NeuralWatt chat request failed:", err);
    return "";
  }
}

async function askOpenCodeGo(messages: ChatMessage[]): Promise<string> {
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
        max_tokens: 600,
        temperature: 0.55,
      }),
      signal: AbortSignal.timeout(20_000),
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

async function askPollinationsText(messages: ChatMessage[]): Promise<string> {
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
      signal: AbortSignal.timeout(15_000),
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

  if (text.includes("price") || text.includes("cost") || text.includes("magkano") || text.includes("package")) {
    return "💰 Sure! Prices depend on the exact service and quantity. Open the SERVICES section and choose the package that matches your goal. Tell me the platform (Facebook likes, TikTok views, etc.) and I can point you to the closest option.";
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

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const cleanMessages = sanitizeMessages(messages);

    if (cleanMessages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const latestMessage = latestUserMessage(cleanMessages);
    const apiMessages: ChatMessage[] = [
      HUMAN_SUPPORT_SYSTEM,
      ...cleanMessages.filter((message) => message.role !== "system").slice(-8),
    ];

    // Multi-tier AI Engine: NeuralWatt -> OpenCode -> Pollinations
    let content = await askNeuralwatt(apiMessages);
    if (!content) {
      content = await askOpenCodeGo(apiMessages);
    }
    if (!content) {
      content = await askPollinationsText(apiMessages);
    }

    if (content) {
      return NextResponse.json({ content });
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
