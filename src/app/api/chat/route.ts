import { NextResponse } from 'next/server';

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
    "Use light Taglish when it fits the customer's wording. Avoid robotic phrases, hype, and repeated exclamation marks.",
    "Never invent prices, order statuses, discounts, timelines, or policies. If unsure, say what you can verify and ask one simple follow-up.",
    "For buying, guide users to choose a service, submit the target link, pay with GCash or wallet, and upload the receipt if needed.",
    "For orders, ask for a Tracking ID like BS-D5D1D849 if they did not provide one.",
  ].join(" "),
};

const SUPPORT_INTENT_WORDS = [
  "pinoyboosting", "cynetwork", "service", "services", "price", "pricing", "rate", "rates", "magkano", "package",
  "order", "tracking", "track", "status", "gcash", "payment", "receipt", "wallet", "topup", "top-up", "login",
  "register", "account", "facebook", "fb", "instagram", "ig", "tiktok", "youtube", "telegram", "followers",
  "follower", "likes", "like", "reactions", "reaction", "views", "view", "comments", "shares", "subscribers",
  "pisowifi", "piso wifi", "wifi", "gemini", "software", "autocad", "sketchup", "revit", "eap", "tp-link",
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

function humanFallback(message: string) {
  const text = message.toLowerCase();

  if (text.includes("price") || text.includes("cost") || text.includes("magkano") || text.includes("package")) {
    return "Sure. Prices depend on the exact service and quantity, so the best move is to open the SERVICES section and choose the package that matches your goal. Tell me the platform, like Facebook likes or TikTok views, and I can point you to the closest option.";
  }

  if (text.includes("gcash") || text.includes("payment") || text.includes("bayad") || text.includes("receipt")) {
    return "Yes, you can pay with GCash. After checkout, upload the receipt screenshot here or on the payment step so admin can verify it and start processing your order.";
  }

  if (text.includes("track") || text.includes("status") || text.includes("order")) {
    return "No worries. Send your Tracking ID, for example BS-D5D1D849, and I can check the order status for you.";
  }

  if (text.includes("login") || text.includes("register") || text.includes("account")) {
    return "You can register or login before buying so your orders and wallet stay saved to your account. After login, go back to SERVICES and continue from there.";
  }

  return "Got you. Tell me what you want to grow or set up, like Facebook followers, reactions, views, PisoWiFi, or wallet top-up, and I will guide you to the right next step.";
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

function buildClientFallbackPrompt(messages: ChatMessage[], message: string) {
  const recent = messages
    .filter((item) => item.role !== "system")
    .slice(-6)
    .map((item) => `${item.role}: ${item.content}`)
    .join("\n");

  return [
    "Answer like a calm, friendly assistant.",
    "You can answer general knowledge, everyday, school, tech, business, and support questions.",
    "Be honest if unsure. Keep it concise unless the user asks for detail.",
    "Do not pretend to be a real human. For high-stakes medical, legal, or financial questions, give general info and suggest a qualified professional.",
    `Recent chat:\n${recent || `user: ${message}`}`,
    `User question: ${message}`,
  ].join("\n\n");
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const cleanMessages = sanitizeMessages(messages);

    if (cleanMessages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    // Attempt Pollinations AI (Unlimited & Lifetime Free OpenAI-compatible Endpoint)
    // equipped with automatic retry loops for maximum stability.
    let content = "";
    let attempts = 3;
    let success = false;
    let lastError: unknown = null;
    const latestMessage = latestUserMessage(cleanMessages);
    const apiMessages = [
      HUMAN_SUPPORT_SYSTEM,
      ...cleanMessages.filter((message) => message.role !== "system").slice(-8),
    ];

    while (attempts > 0 && !success) {
      try {
        const res = await fetch('https://text.pollinations.ai/openai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'openai',
            messages: apiMessages,
            temperature: 0.55,
          })
        });

        if (res.ok) {
          const data = await res.json();
          const responseText = data.choices?.[0]?.message?.content;
          if (responseText) {
            content = responseText;
            success = true;
          }
        } else {
          console.warn(`Pollinations AI attempt failed, status: ${res.status}`);
          lastError = new Error(`Pollinations returned status ${res.status}`);
        }
      } catch (err: unknown) {
        console.error('Pollinations AI request attempt error:', err);
        lastError = err;
      }
      
      if (!success) {
        attempts--;
        if (attempts > 0) {
          // Subtle wait before retrying (250ms)
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
    }

    if (success && content) {
      return NextResponse.json({ content });
    }

    console.warn('Pollinations AI unavailable, returning human fallback:', getErrorMessage(lastError));
    const supportQuestion = isSupportQuestion(latestMessage);
    return NextResponse.json({
      content: supportQuestion
        ? humanFallback(latestMessage)
        : "I can answer that. The cloud AI is a bit busy right now, so I will try the browser AI fallback for you.",
      clientFallbackPrompt: supportQuestion ? "" : buildClientFallbackPrompt(cleanMessages, latestMessage),
    });

  } catch (err: unknown) {
    console.error('Chat endpoint error:', err);
    return NextResponse.json({ error: getErrorMessage(err) || 'Internal Server Error' }, { status: 500 });
  }
}
