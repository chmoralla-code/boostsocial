import { SupabaseClient } from "@supabase/supabase-js";

const OPENCODE_ZEN_API_KEY = process.env.OPENCODE_ZEN_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
const OPENCODE_ZEN_BASE = "https://opencode.ai/zen/v1";
const VISION_MODEL = "mimo-v2.5-free";

/** Canonical GCash payee shown on site (masked on receipts as HE•••Y S.). */
export const APPROVED_GCASH_RECEIVER_LABEL = "HE•••Y S.";

export interface VerificationResult {
  success: boolean;
  extractedAmount: number | null;
  confidence: number;
  rawText: string;
  reason?: string;
  isAIGenerated?: boolean;
  aiGeneratedScore?: number;
  isDuplicate?: boolean;
  duplicateRef?: string;
  referenceNumber?: string | null;
  receiverName?: string | null;
  receiverMatched?: boolean;
  referenceUnique?: boolean;
}

const INACTIVE_STATUSES = new Set([
  "rejected",
  "cancelled",
  "canceled",
  "failed",
  "declined",
  "voided",
]);

function isInactiveStatus(status: unknown) {
  return INACTIVE_STATUSES.has(String(status ?? "").trim().toLowerCase());
}

async function callVisionModel(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
  if (!OPENCODE_ZEN_API_KEY) {
    throw new Error("No API key configured for receipt verification");
  }

  const res = await fetch(`${OPENCODE_ZEN_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENCODE_ZEN_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 512,
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "unknown");
    throw new Error(`Vision API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

/**
 * Normalize GCash Ref No to digits only (e.g. "4043 390 526380" -> "4043390526380").
 */
export function normalizeGcashReference(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits;
}

/**
 * Accept masked HE•••Y S. / HE...Y S. and unmasked Henry S.
 */
export function isApprovedGCashReceiver(name: unknown): boolean {
  const raw = String(name ?? "").trim().toUpperCase();
  if (!raw) return false;

  if (/^HE[•·*.…\-_]+Y\s*S\.?$/.test(raw)) return true;
  if (/^HENRY\s*S\.?$/.test(raw)) return true;

  const letters = raw.replace(/[^A-Z]/g, "");
  return letters === "HEYS" || letters === "HENRYS";
}

function tryParseJSON(text: string): Record<string, any> | null {
  try {
    return JSON.parse(text);
  } catch {}

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {}
  }

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch {}
  }

  return null;
}

function extractReferenceFromReceiptData(receiptData: unknown): string | null {
  if (!receiptData) return null;
  try {
    const parsed = typeof receiptData === "string" ? JSON.parse(receiptData) : receiptData;
    return (
      normalizeGcashReference(parsed?.reference_number) ||
      normalizeGcashReference(parsed?.gcash_reference) ||
      normalizeGcashReference(parsed?.referenceNumber)
    );
  } catch {
    return normalizeGcashReference(receiptData);
  }
}

/**
 * True when this GCash Ref No was already used on an active top-up or order.
 */
export async function findActiveDuplicateGcashReference(
  supabase: SupabaseClient,
  referenceNumber: string,
  exclude?: { topupId?: string; orderId?: string }
): Promise<string | null> {
  const normalized = normalizeGcashReference(referenceNumber);
  if (!normalized) return null;

  try {
    const [topupsRes, ordersRes] = await Promise.all([
      supabase
        .from("topups")
        .select("id, status, receipt_data, gcash_reference")
        .or(`gcash_reference.eq.${normalized},receipt_data.ilike.%${normalized}%`)
        .limit(25),
      supabase
        .from("orders")
        .select("id, status, receipt_data, gcash_reference")
        .or(`gcash_reference.eq.${normalized},receipt_data.ilike.%${normalized}%`)
        .limit(25),
    ]);

    type RefRow = {
      id?: string;
      status?: string;
      receipt_data?: unknown;
      gcash_reference?: string | null;
    };

    // If gcash_reference column is missing, fall back to receipt_data-only scans.
    let topupRows: RefRow[] =
      (topupsRes.data as RefRow[] | null) || [];
    if (topupsRes.error && /gcash_reference|schema cache|column/i.test(topupsRes.error.message || "")) {
      const fallback = await supabase
        .from("topups")
        .select("id, status, receipt_data")
        .ilike("receipt_data", `%${normalized}%`)
        .limit(25);
      topupRows = (fallback.data as RefRow[] | null) || [];
    }

    for (const row of topupRows) {
      if (exclude?.topupId && row.id === exclude.topupId) continue;
      if (isInactiveStatus(row.status)) continue;
      const rowRef =
        normalizeGcashReference(row.gcash_reference) || extractReferenceFromReceiptData(row.receipt_data);
      if (rowRef === normalized) return row.id || "topup";
    }

    let orderRows: RefRow[] = (ordersRes.data as RefRow[] | null) || [];
    if (ordersRes.error && /gcash_reference|receipt_data|schema cache|column/i.test(ordersRes.error.message || "")) {
      const fallback = await supabase
        .from("orders")
        .select("id, status, receipt_data")
        .ilike("receipt_data", `%${normalized}%`)
        .limit(25);
      orderRows = (fallback.data as RefRow[] | null) || [];
    }

    for (const row of orderRows) {
      if (exclude?.orderId && row.id === exclude.orderId) continue;
      if (isInactiveStatus(row.status)) continue;
      const status = String(row.status ?? "").toLowerCase();
      if (status === "rejected" || status === "cancelled" || status === "canceled") continue;
      const rowRef =
        normalizeGcashReference(row.gcash_reference) || extractReferenceFromReceiptData(row.receipt_data);
      if (rowRef === normalized) return row.id || "order";
    }
  } catch (error) {
    console.warn("GCash reference duplicate lookup skipped:", error);
  }

  return null;
}

async function persistGcashReference(
  supabase: SupabaseClient,
  table: "topups" | "orders",
  id: string,
  referenceNumber: string | null,
  receiptPayload: Record<string, unknown>
) {
  const normalized = normalizeGcashReference(referenceNumber);
  const withRef = {
    ...receiptPayload,
    reference_number: normalized,
    gcash_reference: normalized,
  };

  const primary = await supabase
    .from(table)
    .update({
      receipt_data: JSON.stringify(withRef),
      ...(normalized ? { gcash_reference: normalized } : {}),
    })
    .eq("id", id);

  if (!primary.error) return;

  if (/gcash_reference|schema cache|column/i.test(primary.error.message || "")) {
    const fallback = await supabase
      .from(table)
      .update({ receipt_data: JSON.stringify(withRef) })
      .eq("id", id);
    if (fallback.error && /receipt_data|schema cache|column/i.test(fallback.error.message || "")) {
      console.warn(`Could not persist receipt_data on ${table}:`, fallback.error.message);
    }
    return;
  }

  if (/receipt_data|schema cache|column/i.test(primary.error.message || "")) {
    if (normalized) {
      await supabase.from(table).update({ gcash_reference: normalized }).eq("id", id);
    }
    return;
  }

  console.warn(`Failed persisting receipt metadata on ${table}:`, primary.error.message);
}

export async function verifyReceipt(
  imageBuffer: Buffer,
  mimeType: string,
  supabase?: SupabaseClient,
  _userEmail?: string,
  exclude?: { topupId?: string; orderId?: string }
): Promise<VerificationResult> {
  try {
    const base64 = imageBuffer.toString("base64");

    const primaryPrompt = `You are a GCash receipt verification AI. Analyze this receipt image and return a JSON object with these exact fields:
{
  "amount": <number or null if not found>,
  "currency": "<PHP or null>",
  "reference_number": "<string or null — GCash Ref No. digits, keep spaces if shown>",
  "receiver": "<string or null — RECEIVER / To name exactly as shown, e.g. HE•••Y S. or Henry S.>",
  "sender": "<string or null>",
  "date": "<string or null>",
  "is_ai_generated": <true/false>,
  "ai_generated_score": <number 0-100>,
  "reason": "<explanation, or null if amount found>",
  "receipt_description": "<brief 10-word summary of what this receipt shows>"
}

Rules:
- Extract total amount paid — look for Amount / Total Amount Sent with PHP, ₱, or P
- Extract the RECEIVER name (payee), NOT the sender — GCash often masks it like HE•••Y S.
- Extract Ref No. / Reference Number completely
- If amount found, reason should be null
- For is_ai_generated: look for obvious AI artifacts, weird text, unrealistic fonts, pixel inconsistencies
- ai_generated_score: 0 = definitely real photo, 100 = definitely AI generated
- receipt_description: short summary like "GCash payment ₱6 to HE•••Y S."`;

    const primaryResult = await callVisionModel(base64, mimeType, primaryPrompt);
    const parsed = tryParseJSON(primaryResult);

    const extractedAmount = parsed?.amount != null && parsed?.amount !== ""
      ? parseFloat(String(parsed.amount))
      : null;
    const isAIGenerated = parsed?.is_ai_generated === true;
    const aiGeneratedScore = typeof parsed?.ai_generated_score === "number" ? parsed.ai_generated_score : 0;
    const receiptDescription = parsed?.receipt_description || "";
    const receiverName = parsed?.receiver ? String(parsed.receiver).trim() : null;
    const referenceNumber = normalizeGcashReference(parsed?.reference_number);
    const receiverMatched = isApprovedGCashReceiver(receiverName);

    let isDuplicate = false;
    let duplicateRef: string | undefined;
    let referenceUnique = Boolean(referenceNumber);

    if (referenceNumber && supabase) {
      const duplicateId = await findActiveDuplicateGcashReference(supabase, referenceNumber, exclude);
      if (duplicateId) {
        isDuplicate = true;
        referenceUnique = false;
        duplicateRef = `GCash Ref No. already used on ${duplicateId}`;
      }
    } else if (!referenceNumber) {
      referenceUnique = false;
    }

    return {
      success: extractedAmount !== null && Number.isFinite(extractedAmount),
      extractedAmount: Number.isFinite(extractedAmount as number) ? (extractedAmount as number) : null,
      confidence: isAIGenerated ? Math.max(0.3, 1 - aiGeneratedScore / 100) : 0.85,
      rawText: (receiptDescription || primaryResult).substring(0, 500),
      reason: parsed?.reason || undefined,
      isAIGenerated,
      aiGeneratedScore,
      isDuplicate,
      duplicateRef,
      referenceNumber,
      receiverName,
      receiverMatched,
      referenceUnique,
    };
  } catch (error) {
    console.error("Receipt vision verification failed:", error);
    return {
      success: false,
      extractedAmount: null,
      confidence: 0,
      rawText: "",
      reason: error instanceof Error ? error.message : "Vision API error",
      isAIGenerated: false,
      aiGeneratedScore: 0,
      receiverMatched: false,
      referenceUnique: false,
    };
  }
}

function amountMatches(extracted: number | null, requested: number) {
  if (extracted === null || !Number.isFinite(extracted) || !Number.isFinite(requested)) return false;
  return Math.abs(extracted - requested) <= Math.max(requested * 0.05, 0.5);
}

export async function autoVerifyAndApproveTopup(params: {
  supabase: SupabaseClient;
  topupId: string;
  requestedAmount: number;
  imageBuffer: Buffer;
  mimeType: string;
  userEmail: string;
}) {
  const { supabase, topupId, requestedAmount, imageBuffer, mimeType } = params;

  const result = await verifyReceipt(imageBuffer, mimeType, supabase, params.userEmail, { topupId });

  const baseMeta = {
    ai_verified_at: new Date().toISOString(),
    extracted_amount: result.extractedAmount,
    confidence: result.confidence,
    is_ai_generated: result.isAIGenerated,
    ai_generated_score: result.aiGeneratedScore,
    receiver_name: result.receiverName || null,
    receiver_matched: Boolean(result.receiverMatched),
    reference_number: result.referenceNumber || null,
    reference_unique: Boolean(result.referenceUnique),
    receipt_description: result.rawText.substring(0, 200),
  };

  if (result.isAIGenerated && (result.aiGeneratedScore ?? 0) > 70) {
    await persistGcashReference(supabase, "topups", topupId, result.referenceNumber || null, {
      ...baseMeta,
      auto_approved: false,
      reason: `AI-generated receipt detected (score: ${result.aiGeneratedScore}%)`,
    });
    await supabase.from("topups").update({ status: "rejected" }).eq("id", topupId);
    return { ...result, autoApproved: false, rejectedAsFake: true };
  }

  if (result.isDuplicate) {
    await persistGcashReference(supabase, "topups", topupId, result.referenceNumber || null, {
      ...baseMeta,
      auto_approved: false,
      is_duplicate: true,
      duplicate_reason: result.duplicateRef,
      reason: `Duplicate Ref No.: ${result.duplicateRef || "Same GCash reference used again"}`,
    });
    await supabase.from("topups").update({ status: "rejected" }).eq("id", topupId);
    return { ...result, autoApproved: false, rejectedAsDuplicate: true };
  }

  const match =
    amountMatches(result.extractedAmount, requestedAmount) &&
    Boolean(result.receiverMatched) &&
    Boolean(result.referenceNumber) &&
    Boolean(result.referenceUnique) &&
    !result.isDuplicate;

  let reason = result.reason || null;
  if (!result.receiverMatched) {
    reason = `Receiver name mismatch: saw "${result.receiverName || "unknown"}", expected ${APPROVED_GCASH_RECEIVER_LABEL} / Henry S.`;
  } else if (!result.referenceNumber) {
    reason = "GCash Ref No. not found on receipt";
  } else if (!result.referenceUnique) {
    reason = result.duplicateRef || "GCash Ref No. is not unique";
  } else if (!amountMatches(result.extractedAmount, requestedAmount)) {
    reason = `Amount mismatch: extracted ₱${result.extractedAmount} vs requested ₱${requestedAmount}`;
  }

  await persistGcashReference(supabase, "topups", topupId, result.referenceNumber || null, {
    ...baseMeta,
    auto_approved: match,
    reason,
  });

  if (match) {
    try {
      const { error: approvalError } = await supabase.rpc("approve_topup_atomic", {
        p_topup_id: topupId,
        p_amount: requestedAmount,
        p_reviewed_by: "ai-verifier",
      });

      if (approvalError) {
        console.error("Auto-approval RPC failed:", approvalError);
        return { ...result, autoApproved: false, reason: approvalError.message };
      }

      return {
        ...result,
        autoApproved: true,
        reason: `AI verified — receiver ${APPROVED_GCASH_RECEIVER_LABEL}, unique Ref No., amount matches`,
      };
    } catch (err) {
      console.error("Auto-approval failed:", err);
      return { ...result, autoApproved: false, reason: "Atomic approval failed" };
    }
  }

  return {
    ...result,
    autoApproved: false,
    reason: reason || "Receipt did not meet auto-approval rules",
  };
}

export async function autoVerifyAndApproveOrder(params: {
  supabase: SupabaseClient;
  orderId: string;
  requestedAmount: number;
  imageBuffer: Buffer;
  mimeType: string;
  userEmail?: string;
}) {
  const { supabase, orderId, requestedAmount, imageBuffer, mimeType } = params;

  const result = await verifyReceipt(imageBuffer, mimeType, supabase, params.userEmail, { orderId });

  const baseMeta = {
    ai_verified_at: new Date().toISOString(),
    extracted_amount: result.extractedAmount,
    confidence: result.confidence,
    is_ai_generated: result.isAIGenerated,
    ai_generated_score: result.aiGeneratedScore,
    receiver_name: result.receiverName || null,
    receiver_matched: Boolean(result.receiverMatched),
    reference_number: result.referenceNumber || null,
    reference_unique: Boolean(result.referenceUnique),
    receipt_description: result.rawText.substring(0, 200),
  };

  if (result.isAIGenerated && (result.aiGeneratedScore ?? 0) > 70) {
    await persistGcashReference(supabase, "orders", orderId, result.referenceNumber || null, {
      ...baseMeta,
      auto_approved: false,
      reason: `AI-generated receipt detected (score: ${result.aiGeneratedScore}%)`,
    });
    return { ...result, autoApproved: false, rejectedAsFake: true };
  }

  if (result.isDuplicate) {
    await persistGcashReference(supabase, "orders", orderId, result.referenceNumber || null, {
      ...baseMeta,
      auto_approved: false,
      is_duplicate: true,
      duplicate_reason: result.duplicateRef,
      reason: `Duplicate Ref No.: ${result.duplicateRef || "Same GCash reference used again"}`,
    });
    return { ...result, autoApproved: false, rejectedAsDuplicate: true };
  }

  const match =
    amountMatches(result.extractedAmount, requestedAmount) &&
    Boolean(result.receiverMatched) &&
    Boolean(result.referenceNumber) &&
    Boolean(result.referenceUnique);

  let reason = result.reason || null;
  if (!result.receiverMatched) {
    reason = `Receiver name mismatch: saw "${result.receiverName || "unknown"}", expected ${APPROVED_GCASH_RECEIVER_LABEL} / Henry S.`;
  } else if (!result.referenceNumber) {
    reason = "GCash Ref No. not found on receipt";
  } else if (!result.referenceUnique) {
    reason = result.duplicateRef || "GCash Ref No. is not unique";
  } else if (!amountMatches(result.extractedAmount, requestedAmount)) {
    reason = `Amount mismatch: extracted ₱${result.extractedAmount} vs requested ₱${requestedAmount}`;
  }

  await persistGcashReference(supabase, "orders", orderId, result.referenceNumber || null, {
    ...baseMeta,
    auto_approved: match,
    reason,
  });

  if (!match) {
    return {
      ...result,
      autoApproved: false,
      reason: reason || "Receipt did not meet auto-approval rules",
    };
  }

  const { data: updated, error: updateError } = await supabase
    .from("orders")
    .update({ status: "Processing" })
    .eq("id", orderId)
    .eq("status", "Pending")
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Order auto-approval status update failed:", updateError);
    return { ...result, autoApproved: false, reason: updateError.message };
  }

  if (!updated) {
    return { ...result, autoApproved: false, reason: "Order was already updated" };
  }

  return {
    ...result,
    autoApproved: true,
    reason: `AI verified — receiver ${APPROVED_GCASH_RECEIVER_LABEL}, unique Ref No., amount matches`,
  };
}
