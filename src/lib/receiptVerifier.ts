import { createWorker } from "tesseract.js";
import { SupabaseClient } from "@supabase/supabase-js";

interface VerificationResult {
  success: boolean;
  extractedAmount: number | null;
  confidence: number;
  rawText: string;
  reason?: string;
}

const GCASH_PRICE_PATTERNS = [
  /(?:PHP|₱|P)\s*([0-9,]+(?:\.[0-9]{2})?)/i,
  /(?:total|amount|paid|sent):?\s*(?:PHP|₱|P)?\s*([0-9,]+(?:\.[0-9]{2})?)/im,
  /([0-9,]+(?:\.[0-9]{2})?)\s*(?:PHP|₱|P)?/i,
  /₱\s*([0-9,]+(?:\.[0-9]{2})?)/,
];

function parseAmount(text: string): { amount: number | null; confidence: number } {
  const cleanText = text.replace(/[^a-zA-Z0-9₱.,\n\r\s:]/g, "");

  for (const pattern of GCASH_PRICE_PATTERNS) {
    const match = cleanText.match(pattern);
    if (match) {
      const parsed = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        return { amount: parsed, confidence: 0.85 };
      }
    }
  }

  // Fallback: extract any number that looks like a PHP amount (50-50000 range)
  const numberMatches = cleanText.match(/([0-9,]+(?:\.[0-9]{2})?)/g);
  if (numberMatches) {
    const validAmounts = numberMatches
      .map((n) => parseFloat(n.replace(/,/g, "")))
      .filter((n) => !isNaN(n) && n >= 20 && n <= 50000);

    if (validAmounts.length === 1) {
      return { amount: validAmounts[0], confidence: 0.6 };
    }
    // If multiple, pick the one closest to a common top-up amount
    const commonAmounts = [50, 100, 150, 200, 250, 300, 500, 1000];
    const bestMatch = validAmounts.find((n) => commonAmounts.includes(n));
    if (bestMatch) {
      return { amount: bestMatch, confidence: 0.5 };
    }
  }

  return { amount: null, confidence: 0 };
}

export async function verifyReceipt(
  imageBuffer: Buffer
): Promise<VerificationResult> {
  try {
    const worker = await createWorker("eng+fil");

    const { data } = await worker.recognize(imageBuffer);
    const rawText = data.text.trim();

    await worker.terminate();

    if (!rawText) {
      return {
        success: false,
        extractedAmount: null,
        confidence: 0,
        rawText: "",
        reason: "No text detected in receipt image",
      };
    }

    const { amount: extractedAmount, confidence } = parseAmount(rawText);

    if (!extractedAmount) {
      return {
        success: false,
        extractedAmount: null,
        confidence,
        rawText,
        reason: "Could not extract payment amount from receipt",
      };
    }

    return {
      success: true,
      extractedAmount,
      confidence,
      rawText: rawText.substring(0, 500),
    };
  } catch (error) {
    console.error("Receipt OCR verification failed:", error);
    return {
      success: false,
      extractedAmount: null,
      confidence: 0,
      rawText: "",
      reason: error instanceof Error ? error.message : "OCR processing error",
    };
  }
}

export async function autoVerifyAndApproveTopup(params: {
  supabase: SupabaseClient;
  topupId: string;
  requestedAmount: number;
  imageBuffer: Buffer;
}) {
  const { supabase, topupId, requestedAmount, imageBuffer } = params;

  const result = await verifyReceipt(imageBuffer);

  const match =
    result.extractedAmount !== null &&
    Math.abs(result.extractedAmount - requestedAmount) <= requestedAmount * 0.05; // 5% tolerance

  // Update topup with AI verification data
  const updateData: Record<string, any> = {
    receipt_data: JSON.stringify({
      ai_verified_at: new Date().toISOString(),
      extracted_amount: result.extractedAmount,
      confidence: result.confidence,
      raw_text_preview: result.rawText.substring(0, 200),
      auto_approved: match,
      reason: result.reason || null,
    }),
  };

  await supabase.from("topups").update(updateData).eq("id", topupId);

  // If amount matches, auto-approve
  if (match) {
    try {
      const { error: approvalError } = await supabase.rpc("approve_topup_atomic", {
        p_topup_id: topupId,
        p_amount: requestedAmount,
        p_reviewed_by: "ai-verifier",
      });

      if (approvalError) {
        console.error("Auto-approval RPC failed:", approvalError);
        return { autoApproved: false, reason: approvalError.message, ...result };
      }

      return { autoApproved: true, reason: "AI verified - amount matches receipt", ...result };
    } catch (err) {
      console.error("Auto-approval failed:", err);
      return { autoApproved: false, reason: "Atomic approval failed", ...result };
    }
  }

  return {
    autoApproved: false,
    reason: result.reason || `Amount mismatch: extracted ₱${result.extractedAmount} vs requested ₱${requestedAmount}`,
    ...result,
  };
}
