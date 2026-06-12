import { NextResponse } from "next/server";
import { getSmmCatalogServices } from "@/lib/smmCatalog";

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export async function GET() {
  try {
    const { services, source } = await getSmmCatalogServices();
    return NextResponse.json(services, {
      headers: {
        "Cache-Control": source === "rixeysmm" || source === "memory_cache"
          ? "public, s-maxage=300, stale-while-revalidate=600"
          : "public, s-maxage=120, stale-while-revalidate=600",
        "X-SMM-Catalog-Source": source,
      },
    });
  } catch (err: unknown) {
    console.error("Failed fetching SMM services catalog:", err);
    return NextResponse.json({
      error: "SMM services are currently unavailable.",
      details: getErrorMessage(err)
    }, { status: 503 });
  }
}
