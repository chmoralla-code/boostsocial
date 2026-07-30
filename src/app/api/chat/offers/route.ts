import { NextRequest, NextResponse } from "next/server";
import {
  CHAT_CATALOG_SERVICE_ID,
  detectChatOfferQuery,
  selectAllChatOfferCandidates,
  selectChatOfferCandidates,
  type ChatOfferCandidate,
} from "@/lib/chatOffers";
import { getSmmCatalogServices } from "@/lib/smmCatalog";
import { enforceRateLimit } from "@/utils/security/rate-limit";

const MAX_QUERY_LENGTH = 180;
const ALL_CATALOG_PAGE_SIZE = 8;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

function toChatOffer({ platform, service, estimatedMinimumTotal }: ChatOfferCandidate) {
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
}

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
    const requestedPage = Number(body?.page ?? 1);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
    const detected = detectChatOfferQuery(query);

    if (!query || !detected.isOfferQuery) {
      return NextResponse.json(
        { error: "Ask for a cheapest service or explicitly request all SMM services." },
        { status: 400 }
      );
    }

    const { services, source } = await getSmmCatalogServices();
    const candidates = detected.showAllCatalog
      ? selectAllChatOfferCandidates(services, query)
      : selectChatOfferCandidates(services, query);

    if (candidates.length === 0) {
      return NextResponse.json({
        offers: [],
        message: "No matching live offer is available right now. Try another platform or service type.",
        source,
      });
    }

    const totalCount = candidates.length;
    const pageSize = detected.showAllCatalog ? ALL_CATALOG_PAGE_SIZE : totalCount;
    const offset = detected.showAllCatalog ? (page - 1) * pageSize : 0;
    const pageCandidates = detected.showAllCatalog
      ? candidates.slice(offset, offset + pageSize)
      : candidates;
    const offers = pageCandidates.map(toChatOffer);
    const shownThrough = Math.min(offset + offers.length, totalCount);
    const hasMore = shownThrough < totalCount;

    return NextResponse.json({
      offers,
      source,
      catalog: {
        mode: detected.showAllCatalog ? "all" : "recommendation",
        query,
        page,
        pageSize,
        totalCount,
        hasMore,
        nextPage: hasMore ? page + 1 : null,
      },
      message: detected.showAllCatalog
        ? offers.length > 0
          ? `Showing SMM services ${offset + 1}–${shownThrough} of ${totalCount}.`
          : `All ${totalCount} matching SMM services have already been shown.`
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
