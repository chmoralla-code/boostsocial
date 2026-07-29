import { NextRequest, NextResponse } from "next/server";
import { CHAT_CATALOG_SERVICE_ID, detectChatOfferQuery, selectChatOfferCandidates } from "@/lib/chatOffers";
import { getSmmCatalogServices } from "@/lib/smmCatalog";
import { enforceRateLimit } from "@/utils/security/rate-limit";

const MAX_QUERY_LENGTH = 180;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "chat-offers",
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const body = await req.json();
    const query = String(body?.query || "").trim().slice(0, MAX_QUERY_LENGTH);
    const detected = detectChatOfferQuery(query);

    if (!query || !detected.isOfferQuery) {
      return NextResponse.json(
        { error: "Ask for a cheapest service or all social media offers." },
        { status: 400 }
      );
    }

    const { services, source } = await getSmmCatalogServices();
    const candidates = selectChatOfferCandidates(services, query);

    if (candidates.length === 0) {
      return NextResponse.json({
        offers: [],
        message: "No matching live offer is available right now. Try another platform or service type.",
        source,
      });
    }

    const offers = candidates.map(({ platform, service, estimatedMinimumTotal }) => {
      const catalogSnapshot = {
        id: service.id,
        name: service.name,
        startingPrice: service.startingPrice,
        min: service.min,
        max: service.max,
      };

      return {
        id: `smm-${service.id}`,
        platform,
        serviceId: CHAT_CATALOG_SERVICE_ID,
        smmServiceId: service.id,
        name: service.name,
        category: service.category,
        quantity: Math.max(Number(service.min), 1),
        min: service.min,
        max: service.max,
        pricePerThousand: Number(service.ratePer1k),
        regularTotal: estimatedMinimumTotal,
        total: estimatedMinimumTotal,
        vipDiscountPercent: 0,
        catalogSnapshot,
      };
    });

    return NextResponse.json({
      offers,
      source,
      message: detected.showAllPlatforms
        ? "Here are the cheapest currently available offers per social platform."
        : "This is the cheapest live match I found for your request.",
    });
  } catch (error) {
    console.error("Chat offer lookup failed:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Live offers are temporarily unavailable." },
      { status: 500 }
    );
  }
}
