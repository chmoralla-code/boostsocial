import { NextResponse } from "next/server";
import { parseDescription } from "@/utils/serviceHelpers";
import { fallbackRead } from "@/utils/supabase/dual-db";
import { readServiceCandidatesFromAnyDatabase } from "@/lib/serviceCandidatesServer";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ServiceRow = {
  id: string;
  title: string;
  description: unknown;
  starting_price: number | string;
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

function priceLine(service: ServiceRow) {
  const parsed = parseDescription(service.description);
  const single = service.title.toLowerCase().includes("page")
    || service.title.toLowerCase().includes("gemini")
    || service.title.toLowerCase().includes("pisowifi")
    || service.title.toLowerCase().includes("software")
    || service.title.toLowerCase().includes("license");
  const price = Number(service.starting_price || 0);
  const label = single ? `PHP ${price.toFixed(2)} per unit` : `PHP ${(price * 1000).toFixed(2)} per 1k`;
  return `- ${service.title}: ${label}. Link: /app. ${parsed?.subtitle || parsed?.description || ""}`;
}

async function readServices() {
  const { data } = await fallbackRead<ServiceRow[]>(async (client) =>
    await client
      .from("services")
      .select("id,title,description,starting_price")
      .order("created_at", { ascending: true })
  );

  return Array.isArray(data) ? data : [];
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
  try {
    const body = await request.json();
    const messages = Array.isArray(body.messages) ? body.messages as ChatMessage[] : [];
    const userMessage = latestUserMessage(messages);

    if (!userMessage) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const orderReply = await findOrder(userMessage);
    if (orderReply) {
      return NextResponse.json({ content: orderReply });
    }

    const [services, candidates] = await Promise.all([
      readServices(),
      readServiceCandidatesFromAnyDatabase(),
    ]);

    const serviceContext = services.slice(0, 60).map(priceLine).join("\n");
    const candidateContext = candidates.map((candidate) =>
      `- ${candidate.tag || candidate.title}: ${candidate.title}. ${candidate.description}. Rate: ${candidate.rate_text || "varies"}. App link: /app`
    ).join("\n");

    const promptMessages: ChatMessage[] = [
      {
        role: "system",
        content: [
          "You are the PinoyBoosting mobile app AI assistant.",
          "Be smarter and clearer than a generic support bot.",
          "Answer in concise English, Taglish when natural, and never invent services.",
          "Always mention the exact app link /app for service cards, /app/profile for wallet top-ups, /app/auth?mode=login for login, /app/auth?mode=register for signup, and /app/orders for orders when relevant.",
          "When a client asks for a specific service, name the closest live candidate or stored service exactly, include the price/rate if available, and include /app as the tappable service link.",
          "Buying is prohibited until the client logs in or registers.",
          "Keep answers short: 3-6 useful sentences or a few short bullets.",
          "Live candidate services:",
          candidateContext,
          "Live stored services:",
          serviceContext,
        ].join("\n"),
      },
      ...messages.slice(-6),
    ];

    const res = await fetch("https://text.pollinations.ai/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai",
        messages: promptMessages,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return NextResponse.json({ content: localFallback(userMessage) });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    return NextResponse.json({
      content: typeof content === "string" && content.trim() ? content.trim() : localFallback(userMessage),
    });
  } catch (error) {
    console.error("App chat route failed:", error);
    return NextResponse.json({
      content: localFallback(getErrorMessage(error)),
    });
  }
}
