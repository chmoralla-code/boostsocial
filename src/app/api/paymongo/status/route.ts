import { NextResponse } from "next/server";
import { isPaymongoConfigured } from "@/lib/paymongo";

export const runtime = "nodejs";

/**
 * Public read-only flag: is the PayMongo rail switched on?
 * The top-up modal calls this so the button only appears when the keys exist.
 * It exposes no secret — just a yes/no.
 */
export async function GET() {
  return NextResponse.json({ enabled: isPaymongoConfigured() });
}
