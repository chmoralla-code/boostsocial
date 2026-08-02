import { SupabaseClient } from "@supabase/supabase-js";
import {
  NEURALWATT_VISION_MODEL,
  requestNeuralwattChat,
  type NeuralwattTool,
} from "@/lib/neuralwatt";
import {
  expectedPaymentDestinationLabel,
  isApprovedPaymentDestination,
  normalizeGcashReference,
  normalizePaymentReference,
} from "@/lib/paymentReceiptRules";

export {
  APPROVED_GCASH_RECEIVER_LABEL,
  isApprovedGCashReceiver,
  normalizeGcashReference,
  normalizePaymentReference,
} from "@/lib/paymentReceiptRules";

const RECEIPT_ANALYSIS_TOOL_NAME = "analyze_payment_receipt";
const RECEIPT_ANALYSIS_FIELDS = [
  "is_payment_receipt",
  "amount",
  "currency",
  "reference_number",
  "sender",
  "recipient",
  "recipient_account",
  "recipient_institution",
  "payment_rail",
  "date",
  "is_ai_generated",
  "ai_generated_score",
  "tampering_score",
  "confidence",
  "reason",
  "receipt_description",
] as const;
const RECEIPT_ANALYSIS_TOOL: NeuralwattTool = {
  type: "function",
  function: {
    name: RECEIPT_ANALYSIS_TOOL_NAME,
    description:
      "Return a structured visual analysis of an uploaded Philippine payment proof, including GCash, InstaPay, PESONet, and bank-transfer confirmations.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        is_payment_receipt: {
          type: "boolean",
          description:
            "True only when the image visibly appears to be a genuine completed payment or transfer confirmation. A GCash receipt, InstaPay transfer to GCash, PESONet transfer, or bank-transfer confirmation can qualify when the completion details are visible.",
        },
        amount: {
          type: ["number", "null"],
          description:
            "The final amount actually paid in Philippine pesos, or null when it is not clearly readable.",
        },
        currency: {
          type: ["string", "null"],
          enum: ["PHP", null],
          description: "PHP when the visible receipt uses Philippine pesos; otherwise null.",
        },
        reference_number: {
          type: ["string", "null"],
          description: "The visible transaction/reference number, or null when unreadable.",
        },
        sender: {
          type: ["string", "null"],
          description: "The visible sender/account name, or null when absent or unreadable.",
        },
        recipient: {
          type: ["string", "null"],
          description: "The visible destination account-holder/payee name only, copied exactly as shown, or null when absent or unreadable.",
        },
        recipient_account: {
          type: ["string", "null"],
          description: "The visible destination phone number or bank account number, preserving any visible masking, or null when absent or unreadable.",
        },
        recipient_institution: {
          type: ["string", "null"],
          description: "The visible destination institution or wallet, such as GCash or G-Xchange, Inc (GCash), or null when absent or unreadable.",
        },
        payment_rail: {
          type: ["string", "null"],
          enum: ["gcash", "instapay", "pesonet", "bank_transfer", "other", "unknown", null],
          description: "The payment rail visibly identified by the receipt: gcash, instapay, pesonet, bank_transfer, other, or unknown when it cannot be determined.",
        },
        date: {
          type: ["string", "null"],
          description: "The visible transaction date and time exactly as shown, or null.",
        },
        is_ai_generated: {
          type: "boolean",
          description:
            "True only when there are strong, visible generative-image artifacts; uncertainty must be false.",
        },
        ai_generated_score: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description:
            "Visible-evidence score from 0 (no generative artifacts) to 100 (strong generative artifacts).",
        },
        tampering_score: {
          type: "number",
          minimum: 0,
          maximum: 100,
          description:
            "Visible-evidence score from 0 (no obvious edits) to 100 (strong signs of altered text or amounts).",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description:
            "Confidence that the amount and transaction details were read correctly, from 0 to 1.",
        },
        reason: {
          type: ["string", "null"],
          description:
            "A concise reason when the receipt or amount cannot be verified; otherwise null.",
        },
        receipt_description: {
          type: "string",
          description:
            "A short factual summary of the visible receipt without inventing hidden details.",
        },
      },
      required: RECEIPT_ANALYSIS_FIELDS,
    },
  },
};

export interface VerificationResult {
  success: boolean;
  extractedAmount: number | null;
  currency?: "PHP" | null;
  confidence: number;
  rawText: string;
  reason?: string;
  isAIGenerated?: boolean;
  aiGeneratedScore?: number;
  tamperingScore?: number;
  isPaymentReceipt?: boolean;
  providerModel?: string;
  isDuplicate?: boolean;
  duplicateRef?: string;
  referenceNumber?: string | null;
  receiverName?: string | null;
  receiverAccount?: string | null;
  receiverInstitution?: string | null;
  paymentRail?: PaymentRail | null;
  receiverMatched?: boolean;
  referenceUnique?: boolean;
}

const PAYMENT_RAILS = [
  "gcash",
  "instapay",
  "pesonet",
  "bank_transfer",
  "other",
  "unknown",
] as const;

type PaymentRail = (typeof PAYMENT_RAILS)[number];

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

async function callVisionModel(
  imageBase64: string,
  mimeType: string,
  prompt: string
): Promise<{ rawText: string; model: string }> {
  const completion = await requestNeuralwattChat({
    model: NEURALWATT_VISION_MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You are a payment-receipt visual extraction system.",
          "Use only details that are visibly present in the image.",
          "Never infer a transaction, amount, reference, sender, recipient, or authenticity signal that cannot be seen.",
          "A normal digital screenshot is not evidence that an image was AI-generated or tampered with.",
          "Return one JSON object and no surrounding prose.",
          `It must contain exactly these keys: ${RECEIPT_ANALYSIS_FIELDS.join(", ")}.`,
          "All keys are required. Use null for missing receipt text fields and amount.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: RECEIPT_ANALYSIS_TOOL_NAME,
        strict: true,
        schema: RECEIPT_ANALYSIS_TOOL.function.parameters,
      },
    },
    maxTokens: 2_048,
    temperature: 0.1,
    timeoutMs: 45_000,
    disableThinking: true,
  });

  const toolCall = completion.message.tool_calls?.find(
    (call) => call.function?.name === RECEIPT_ANALYSIS_TOOL_NAME
  );
  const rawText =
    toolCall?.function?.arguments ||
    (completion.message.function_call?.name === RECEIPT_ANALYSIS_TOOL_NAME
      ? completion.message.function_call.arguments
      : "") ||
    completion.message.content?.trim() ||
    "";

  if (!rawText) {
    throw new Error("Kimi receipt analysis returned no structured result");
  }

  return {
    rawText,
    model: completion.model || NEURALWATT_VISION_MODEL,
  };
}

type ParsedReceiptAnalysis = {
  isPaymentReceipt: boolean;
  amount: number | null;
  currency: "PHP" | null;
  referenceNumber: string | null;
  recipient: string | null;
  recipientAccount: string | null;
  recipientInstitution: string | null;
  paymentRail: PaymentRail | null;
  isAIGenerated: boolean;
  aiGeneratedScore: number;
  tamperingScore: number;
  confidence: number;
  reason: string | null;
  receiptDescription: string;
};

function finiteNumber(value: unknown) {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function boundedNumber(value: unknown, min: number, max: number) {
  const number = finiteNumber(value);
  if (number === null || number < min || number > max) return null;
  return number;
}

function nullableString(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const clean = value.trim();
  return clean || null;
}

function isNullableString(value: unknown) {
  return value === null || typeof value === "string";
}

function parseReceiptAnalysis(text: string): ParsedReceiptAnalysis | null {
  const parsed = tryParseJSON(text);
  if (!parsed) return null;

  if (!RECEIPT_ANALYSIS_FIELDS.every((field) => Object.hasOwn(parsed, field))) {
    return null;
  }

  const amount =
    parsed.amount === null
      ? null
      : finiteNumber(parsed.amount);
  const aiGeneratedScore = boundedNumber(parsed.ai_generated_score, 0, 100);
  const tamperingScore = boundedNumber(parsed.tampering_score, 0, 100);
  const confidence = boundedNumber(parsed.confidence, 0, 1);
  const receiptDescription = nullableString(parsed.receipt_description);
  const paymentRail = nullableString(parsed.payment_rail);

  if (
    typeof parsed.is_payment_receipt !== "boolean" ||
    typeof parsed.is_ai_generated !== "boolean" ||
    (amount !== null && amount <= 0) ||
    (parsed.currency !== null && parsed.currency !== "PHP") ||
    !isNullableString(parsed.reference_number) ||
    !isNullableString(parsed.sender) ||
    !isNullableString(parsed.recipient) ||
    !isNullableString(parsed.recipient_account) ||
    !isNullableString(parsed.recipient_institution) ||
    !isNullableString(parsed.date) ||
    !isNullableString(parsed.reason) ||
    (paymentRail !== null && !PAYMENT_RAILS.includes(paymentRail as PaymentRail)) ||
    aiGeneratedScore === null ||
    tamperingScore === null ||
    confidence === null ||
    !receiptDescription
  ) {
    return null;
  }

  return {
    isPaymentReceipt: parsed.is_payment_receipt,
    amount,
    currency: parsed.currency === "PHP" ? "PHP" : null,
    referenceNumber: nullableString(parsed.reference_number),
    recipient: nullableString(parsed.recipient),
    recipientAccount: nullableString(parsed.recipient_account),
    recipientInstitution: nullableString(parsed.recipient_institution),
    paymentRail: paymentRail as PaymentRail | null,
    isAIGenerated: parsed.is_ai_generated,
    aiGeneratedScore,
    tamperingScore,
    confidence,
    reason: nullableString(parsed.reason),
    receiptDescription,
  };
}

function tryParseJSON(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {}

  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const value = JSON.parse(jsonMatch[1].trim());
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    } catch {}
  }

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      const value = JSON.parse(braceMatch[0]);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    } catch {}
  }

  return null;
}

function extractReferenceFromReceiptData(receiptData: unknown): string | null {
  if (!receiptData) return null;
  try {
    const parsed = typeof receiptData === "string" ? JSON.parse(receiptData) : receiptData;
    return (
      normalizePaymentReference(parsed?.reference_number) ||
      normalizePaymentReference(parsed?.gcash_reference) ||
      normalizePaymentReference(parsed?.referenceNumber)
    );
  } catch {
    return normalizePaymentReference(receiptData);
  }
}

function paymentReferencesMatch(left: unknown, right: unknown) {
  const leftCanonical = normalizePaymentReference(left);
  const rightCanonical = normalizePaymentReference(right);
  if (leftCanonical && rightCanonical && leftCanonical === rightCanonical) return true;

  // Older records stored GCash references as digits only. Compare that legacy
  // representation too, so a reused InstaPay reference cannot bypass history.
  const leftLegacy = normalizeGcashReference(left);
  const rightLegacy = normalizeGcashReference(right);
  return Boolean(leftLegacy && rightLegacy && leftLegacy === rightLegacy);
}

/**
 * True when this payment reference was already used on an active top-up or order.
 * The database column keeps its historical gcash_reference name for backwards
 * compatibility, but it now stores bank and InstaPay references as well.
 */
export async function findActiveDuplicateGcashReference(
  supabase: SupabaseClient,
  referenceNumber: string,
  exclude?: { topupId?: string; orderId?: string }
): Promise<string | null> {
  const normalized = normalizePaymentReference(referenceNumber);
  if (!normalized) return null;

  const legacyNormalized = normalizeGcashReference(referenceNumber);
  const lookupValues = Array.from(
    new Set(
      [normalized, legacyNormalized].filter(
        (value): value is string => Boolean(value)
      )
    )
  );
  const duplicateLookup = lookupValues
    .flatMap((value) => [
      `gcash_reference.eq.${value}`,
      `receipt_data.ilike.%${value}%`,
    ])
    .join(",");
  const receiptDataLookup = lookupValues
    .map((value) => `receipt_data.ilike.%${value}%`)
    .join(",");

  try {
    const [topupsRes, ordersRes] = await Promise.all([
      supabase
        .from("topups")
        .select("id, status, receipt_data, gcash_reference")
        .or(duplicateLookup)
        .limit(25),
      supabase
        .from("orders")
        .select("id, status, receipt_data, gcash_reference")
        .or(duplicateLookup)
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
        .or(receiptDataLookup)
        .limit(25);
      topupRows = (fallback.data as RefRow[] | null) || [];
    }

    for (const row of topupRows) {
      if (exclude?.topupId && row.id === exclude.topupId) continue;
      if (isInactiveStatus(row.status)) continue;
      const rowRef = row.gcash_reference || extractReferenceFromReceiptData(row.receipt_data);
      if (paymentReferencesMatch(rowRef, normalized)) return row.id || "topup";
    }

    let orderRows: RefRow[] = (ordersRes.data as RefRow[] | null) || [];
    if (ordersRes.error && /gcash_reference|receipt_data|schema cache|column/i.test(ordersRes.error.message || "")) {
      const fallback = await supabase
        .from("orders")
        .select("id, status, receipt_data")
        .or(receiptDataLookup)
        .limit(25);
      orderRows = (fallback.data as RefRow[] | null) || [];
    }

    for (const row of orderRows) {
      if (exclude?.orderId && row.id === exclude.orderId) continue;
      if (isInactiveStatus(row.status)) continue;
      const status = String(row.status ?? "").toLowerCase();
      if (status === "rejected" || status === "cancelled" || status === "canceled") continue;
      const rowRef = row.gcash_reference || extractReferenceFromReceiptData(row.receipt_data);
      if (paymentReferencesMatch(rowRef, normalized)) return row.id || "order";
    }
  } catch (error) {
    console.warn("Payment reference duplicate lookup skipped:", error);
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
  const normalized = normalizePaymentReference(referenceNumber);
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
    const primaryPrompt = [
      "Inspect this uploaded Philippine payment proof image. It may be a direct GCash receipt, an InstaPay transfer, a PESONet transfer, or a bank-transfer confirmation.",
      "Read the final amount paid, PHP currency, complete transaction/reference number (including visible letters or prefixes), sender, destination recipient/payee, destination account or phone number, destination institution, payment rail, and date.",
      `Copy the destination evidence exactly as visible so the server can compare it with ${expectedPaymentDestinationLabel()}.`,
      "For example, if the image visibly says InstaPay, To Henry, a destination ending 9963, and G-Xchange, Inc (GCash), return payment_rail=instapay, recipient=Henry, recipient_account with the visible masked number, and recipient_institution=G-Xchange, Inc (GCash). Do not use this example unless those details are visibly present.",
      "Use null for unreadable or missing details.",
      "Only flag AI generation or tampering when strong visible evidence exists; screenshots and compression alone are not suspicious.",
    ].join(" ");

    const primaryResult = await callVisionModel(base64, mimeType, primaryPrompt);
    const parsed = parseReceiptAnalysis(primaryResult.rawText);
    if (!parsed) {
      throw new Error("Kimi receipt analysis did not match the required schema");
    }

    const extractedAmount = parsed.amount;
    const receiverName = parsed.recipient;
    const receiverAccount = parsed.recipientAccount;
    const receiverInstitution = parsed.recipientInstitution;
    const referenceNumber = normalizePaymentReference(parsed.referenceNumber);
    const receiverMatched = isApprovedPaymentDestination({
      recipient: receiverName,
      recipientAccount: receiverAccount,
      recipientInstitution: receiverInstitution,
    });

    let isDuplicate = false;
    let duplicateRef: string | undefined;
    let referenceUnique = Boolean(referenceNumber);

    if (referenceNumber && supabase) {
      const duplicateId = await findActiveDuplicateGcashReference(supabase, referenceNumber, exclude);
      if (duplicateId) {
        isDuplicate = true;
        referenceUnique = false;
        duplicateRef = `Payment reference already used on ${duplicateId}`;
      }
    } else if (!referenceNumber) {
      referenceUnique = false;
    }

    return {
      success:
        parsed.isPaymentReceipt &&
        parsed.currency === "PHP" &&
        extractedAmount !== null &&
        Number.isFinite(extractedAmount),
      extractedAmount,
      currency: parsed.currency,
      confidence: parsed.confidence,
      rawText: parsed.receiptDescription.substring(0, 500),
      reason: parsed.reason || undefined,
      isAIGenerated: parsed.isAIGenerated,
      aiGeneratedScore: parsed.aiGeneratedScore,
      tamperingScore: parsed.tamperingScore,
      isPaymentReceipt: parsed.isPaymentReceipt,
      providerModel: primaryResult.model,
      isDuplicate,
      duplicateRef,
      referenceNumber,
      receiverName,
      receiverAccount,
      receiverInstitution,
      paymentRail: parsed.paymentRail,
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
      tamperingScore: 0,
      isPaymentReceipt: false,
      providerModel: NEURALWATT_VISION_MODEL,
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
  userEmail?: string;
}) {
  const { supabase, topupId, requestedAmount, imageBuffer, mimeType } = params;

  const result = await verifyReceipt(imageBuffer, mimeType, supabase, params.userEmail, { topupId });

  const baseMeta = {
    ai_verified_at: new Date().toISOString(),
    extracted_amount: result.extractedAmount,
    confidence: result.confidence,
    is_ai_generated: result.isAIGenerated,
    ai_generated_score: result.aiGeneratedScore,
    tampering_score: result.tamperingScore,
    is_payment_receipt: result.isPaymentReceipt,
    currency: result.currency,
    provider_model: result.providerModel,
    payment_rail: result.paymentRail || null,
    receiver_name: result.receiverName || null,
    receiver_account: result.receiverAccount || null,
    receiver_institution: result.receiverInstitution || null,
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
      reason: `Duplicate payment reference: ${result.duplicateRef || "Same reference used again"}`,
    });
    await supabase.from("topups").update({ status: "rejected" }).eq("id", topupId);
    return { ...result, autoApproved: false, rejectedAsDuplicate: true };
  }

  const match =
    result.success &&
    result.isPaymentReceipt === true &&
    result.currency === "PHP" &&
    result.confidence >= 0.7 &&
    !result.isAIGenerated &&
    (result.tamperingScore ?? 0) < 70 &&
    amountMatches(result.extractedAmount, requestedAmount) &&
    Boolean(result.receiverMatched) &&
    Boolean(result.referenceNumber) &&
    Boolean(result.referenceUnique) &&
    !result.isDuplicate;

  let reason = result.reason || null;
  if (!result.receiverMatched) {
    reason = `Payment destination mismatch: saw "${result.receiverName || "unknown"}", expected ${expectedPaymentDestinationLabel()}.`;
  } else if (!result.referenceNumber) {
    reason = "Payment reference number not found on receipt";
  } else if (!result.referenceUnique) {
    reason = result.duplicateRef || "Payment reference is not unique";
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
        reason: "AI verified — payment destination, unique reference, and amount match",
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
    tampering_score: result.tamperingScore,
    is_payment_receipt: result.isPaymentReceipt,
    currency: result.currency,
    provider_model: result.providerModel,
    payment_rail: result.paymentRail || null,
    receiver_name: result.receiverName || null,
    receiver_account: result.receiverAccount || null,
    receiver_institution: result.receiverInstitution || null,
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
    await supabase
      .from("orders")
      .update({ status: "Rejected" })
      .eq("id", orderId)
      .eq("status", "Pending");
    return { ...result, autoApproved: false, rejectedAsFake: true };
  }

  if (result.isDuplicate) {
    await persistGcashReference(supabase, "orders", orderId, result.referenceNumber || null, {
      ...baseMeta,
      auto_approved: false,
      is_duplicate: true,
      duplicate_reason: result.duplicateRef,
      reason: `Duplicate payment reference: ${result.duplicateRef || "Same reference used again"}`,
    });
    await supabase
      .from("orders")
      .update({ status: "Rejected" })
      .eq("id", orderId)
      .eq("status", "Pending");
    return { ...result, autoApproved: false, rejectedAsDuplicate: true };
  }

  const match =
    result.success &&
    result.isPaymentReceipt === true &&
    result.currency === "PHP" &&
    result.confidence >= 0.7 &&
    !result.isAIGenerated &&
    (result.tamperingScore ?? 0) < 70 &&
    amountMatches(result.extractedAmount, requestedAmount) &&
    Boolean(result.receiverMatched) &&
    Boolean(result.referenceNumber) &&
    Boolean(result.referenceUnique);

  let reason = result.reason || null;
  if (!result.receiverMatched) {
    reason = `Payment destination mismatch: saw "${result.receiverName || "unknown"}", expected ${expectedPaymentDestinationLabel()}.`;
  } else if (!result.referenceNumber) {
    reason = "Payment reference number not found on receipt";
  } else if (!result.referenceUnique) {
    reason = result.duplicateRef || "Payment reference is not unique";
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
    reason: "AI verified — payment destination, unique reference, and amount match",
  };
}
