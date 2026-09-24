import { NextRequest, NextResponse } from "next/server";
import { describeAiProviders } from "@/lib/neuralwatt";
import { verifyReceipt } from "@/lib/receiptVerifier";
import { getPrimaryAdminClient } from "@/utils/supabase/dual-db";

export const dynamic = "force-dynamic";
// The optional live probe makes one vision call (up to ~45s).
export const maxDuration = 60;

type TopupRow = {
  id: string;
  created_at: string | null;
  amount: number | string | null;
  status: string | null;
  reviewed_by: string | null;
  receipt_url: string | null;
  receipt_data: unknown;
};

function parseReceiptData(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function dataUrlToBuffer(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], buffer: Buffer.from(match[2], "base64") };
}

/**
 * Admin-only (gated by src/proxy.ts) health check for receipt auto-approval.
 *
 *   GET /api/admin/receipt-verifier-health          -> config + recent decisions
 *   GET /api/admin/receipt-verifier-health?probe=1  -> also re-reads the latest
 *        top-up receipt with the vision model (read-only, nothing is approved)
 */
export async function GET(req: NextRequest) {
  const providers = describeAiProviders();
  const report: Record<string, unknown> = {
    aiConfigured: providers.length > 0,
    providers,
    problems: [] as string[],
  };
  const problems = report.problems as string[];
  if (!providers.length) {
    problems.push("No AI key set. Add COMMANDCODE_API_KEY (or OPENROUTER_API_KEY) in Vercel, then redeploy. Every receipt goes to manual review until then.");
  }

  let latestReceipt: TopupRow | null = null;
  try {
    const supabase = getPrimaryAdminClient();
    const { data, error } = await supabase
      .from("topups")
      .select("id, created_at, amount, status, reviewed_by, receipt_url, receipt_data")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;

    const rows = (data || []) as TopupRow[];
    latestReceipt = rows.find((row) => row.receipt_url?.startsWith("data:")) || null;

    const recent = rows.map((row) => {
      const meta = parseReceiptData(row.receipt_data);
      return {
        id: row.id,
        createdAt: row.created_at,
        amount: Number(row.amount) || 0,
        status: row.status,
        reviewedBy: row.reviewed_by,
        aiChecked: Boolean(meta?.ai_verified_at),
        autoApproved: meta?.auto_approved === true,
        extractedAmount: meta?.extracted_amount ?? null,
        reason: meta?.reason ?? null,
      };
    });
    const aiChecked = recent.filter((row) => row.aiChecked).length;
    const autoApproved = recent.filter((row) => row.autoApproved).length;
    report.recentTopups = {
      total: recent.length,
      aiChecked,
      autoApproved,
      sentToManualReview: aiChecked - autoApproved,
      notCheckedByAi: recent.length - aiChecked,
      rows: recent,
    };
    if (recent.length && aiChecked === 0) {
      problems.push("None of the last 20 top-ups were checked by the AI. The AI call is failing or not configured. See each row's reason.");
    }
  } catch (err) {
    problems.push(`Could not read recent top-ups: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (req.nextUrl.searchParams.get("probe") === "1") {
    const image = latestReceipt?.receipt_url ? dataUrlToBuffer(latestReceipt.receipt_url) : null;
    if (!image) {
      report.probe = { ran: false, reason: "No stored top-up receipt image to test with." };
    } else {
      const startedAt = Date.now();
      // No Supabase client: read-only, no duplicate lookup and no writes.
      const result = await verifyReceipt(image.buffer, image.mimeType);
      report.probe = {
        ran: true,
        testedTopupId: latestReceipt?.id,
        ms: Date.now() - startedAt,
        readSucceeded: result.success,
        model: result.providerModel,
        extractedAmount: result.extractedAmount,
        referenceNumber: result.referenceNumber ?? null,
        receiverName: result.receiverName ?? null,
        receiverMatched: Boolean(result.receiverMatched),
        confidence: result.confidence,
        reason: result.reason ?? null,
      };
      if (!result.success) {
        problems.push(`Live AI probe failed: ${result.reason || "unknown error"}`);
      }
    }
  }

  report.healthy = problems.length === 0;
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}
