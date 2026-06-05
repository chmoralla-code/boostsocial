import { NextResponse } from "next/server";
import { parseDescription } from "@/utils/serviceHelpers";
import { fallbackRead } from "@/utils/supabase/dual-db";
import { readServiceCandidatesFromAnyDatabase } from "@/lib/serviceCandidatesServer";
import { readMobileAppSettingsFromAnyDatabase } from "@/lib/mobileAppServer";

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
  services?: { title?: string } | null;
};

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

function priceLine(service: ServiceRow) {
  const parsed = parseDescription(service.description);
  const label = servicePriceLabel(service);
  return [
    `- ${service.title}`,
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
  if (words.length === 0) return candidates;

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

  return matched.length > 0 ? matched : candidates;
}

async function readProviderBalance() {
  const apiKey = process.env.RIXEYSMM_API_KEY;
  if (!apiKey) return "Not configured";

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

    if (!res.ok) return "Unavailable";
    const data = await res.json();
    const balance = Number(data.balance || 0);
    return Number.isFinite(balance) ? `PHP ${balance.toFixed(2)}` : "Unavailable";
  } catch {
    return "Unavailable";
  }
}

async function askPollinations(messages: ChatMessage[]) {
  const model = process.env.POLLINATIONS_MODEL || "openai";
  const requests = [
    {
      url: "https://gen.pollinations.ai/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.POLLINATIONS_API_KEY ? { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` } : {}),
      },
    },
    {
      url: "https://text.pollinations.ai/openai",
      headers: { "Content-Type": "application/json" },
    },
  ];

  for (const request of requests) {
    try {
      const res = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(14000),
      });

      if (!res.ok) {
        console.warn("Pollinations app chat returned non-OK status:", request.url, res.status);
        continue;
      }
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) return content.trim();
    } catch (error) {
      console.warn("Pollinations app chat request failed:", error);
    }
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
      "Here are the closest live services I found:",
      ...matchedServices.slice(0, 4).map((service) =>
        `- ${service.title}: ${servicePriceLabel(service)}. Open ${serviceAppLink(service)}`
      ),
      "Login is required before checkout.",
    ].join("\n");
  }

  if (matchedCandidates.length > 0) {
    return [
      "Here are the closest service categories I found:",
      ...matchedCandidates.slice(0, 4).map((candidate) =>
        `- ${candidate.title}: ${candidate.rate_text || "Rate varies"}. Open /app`
      ),
      "Login is required before buying any service.",
    ].join("\n");
  }

  return localFallback(message);
}

async function findOrder(message: string) {
  const uuidMatch = message.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  const trackMatch = message.match(/BS-([0-9a-f]{8})/i);
  if (!uuidMatch && !trackMatch) return null;

  const { data } = await fallbackRead<OrderRow>(async (client) => {
    let query = client.from("orders").select("id,quantity,target_url,amount,status,services(title)");
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
    return `Order ID not found: ${label}. Please copy the Tracking ID from your checkout success screen and try again.`;
  }

  const displayId = `BS-${data.id.slice(0, 8).toUpperCase()}`;
  return [
    `Tracking ID: ${displayId}`,
    `Service: ${data.services?.title || "Service"}`,
    `Quantity: ${Number(data.quantity || 0).toLocaleString()}`,
    `Target: ${data.target_url || "Not set"}`,
    `Amount: PHP ${Number(data.amount || 0).toFixed(2)}`,
    `Status: ${data.status}`,
    "Open /app/orders to view this inside the APK.",
    data.status === "Pending"
      ? "Next step: wait for admin payment verification, or upload the correct GCash receipt if missing."
      : data.status === "Processing"
        ? "Your order is already processing and delivery is active."
        : data.status === "Completed"
          ? "Your order is completed."
          : "Please contact support if this status looks wrong.",
  ].join("\n");
}

function localFallback(message: string) {
  const text = message.toLowerCase();
  if (text.includes("top up") || text.includes("top-up") || text.includes("topup") || text.includes("wallet")) {
    return "Login first at /app/auth?mode=login, then open /app/profile to top up your app wallet. Upload your GCash receipt there and admin can approve it from the app dashboard or Telegram top-up bot.";
  }
  if (text.includes("gcash") || text.includes("payment") || text.includes("bayad")) {
    return "We accept GCash. Login first at /app/auth?mode=login, choose a service at /app, submit your target link, then upload the payment receipt during checkout.";
  }
  if (text.includes("login") || text.includes("register") || text.includes("account")) {
    return "Use /app/auth?mode=login or /app/auth?mode=register. Buying is locked until your account is logged in, then you will return to /app.";
  }
  if (text.includes("pisowifi") || text.includes("piso wifi")) {
    return "Open /app, tap PISOWIFI PACKAGE under SERVICES, then choose the package. Login is required before checkout.";
  }
  return "Open /app and choose the matching SERVICES card. I can also answer prices, recommend services, or track orders at /app/orders if you send a Tracking ID like BS-D5D1D849.";
}

export async function POST(request: Request) {
  let userMessage = "";

  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages as ChatMessage[] : [];
    userMessage = latestUserMessage(messages);

    if (!userMessage) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const orderReply = await findOrder(userMessage);
    if (orderReply) {
      return NextResponse.json({ content: orderReply });
    }

    const [services, candidates, appSettings, providerBalance] = await Promise.all([
      readServices(),
      readServiceCandidatesFromAnyDatabase(),
      readMobileAppSettingsFromAnyDatabase(),
      readProviderBalance(),
    ]);

    const matchedServices = topServicesForQuery(services, userMessage);
    const matchedCandidates = topCandidatesForQuery(candidates, userMessage);
    const serviceContext = matchedServices.map(priceLine).join("\n");
    const candidateContext = matchedCandidates.slice(0, 12).map((candidate) =>
      `- ${candidate.tag || candidate.title}: ${candidate.title}. ${candidate.description}. Rate: ${candidate.rate_text || "varies"}. App link: /app`
    ).join("\n");

    const promptMessages: ChatMessage[] = [
      {
        role: "system",
        content: [
          "You are the PinoyBoosting mobile app AI assistant.",
          "Use Pollinations AI, but your accuracy must come from the live data below. Do not invent packages, prices, discounts, durations, or policies.",
          "Answer in concise English, Taglish when natural. If live data is missing, say exactly what is available and suggest the nearest app action.",
          "Always mention the exact app link from live service rows, /app for general service cards, /app/profile for wallet top-ups, /app/auth?mode=login for login, /app/auth?mode=register for signup, and /app/orders for orders when relevant.",
          "When a client asks for a specific service, name the closest live candidate or stored service exactly, include the price/rate if available, and include the exact /app?service=... link when one is available. If multiple services match, recommend the most relevant 2-4.",
          "Buying is prohibited until the client logs in or registers.",
          "Keep answers short: 3-6 useful sentences or a few short bullets. Do not mention internal provider IDs unless the user gives a Tracking ID or asks for admin details.",
          `Realtime snapshot: ${new Date().toISOString()}`,
          `Mobile app name: ${appSettings.appName}`,
          `Mobile app banner: ${appSettings.appBanner || "None"}`,
          `Current provider balance: ${providerBalance}`,
          "Live candidate services matching this question:",
          candidateContext,
          "Live stored services matching this question:",
          serviceContext,
          services.length > matchedServices.length ? `Total stored services available: ${services.length}` : "",
        ].join("\n"),
      },
      ...messages.slice(-6),
    ];

    const content = await askPollinations(promptMessages);
    return NextResponse.json({
      content: content || liveDataFallback(matchedServices, matchedCandidates, userMessage),
    });
  } catch (error) {
    console.error("App chat route failed:", error);
    return NextResponse.json({
      content: localFallback(userMessage || getErrorMessage(error)),
    });
  }
}
