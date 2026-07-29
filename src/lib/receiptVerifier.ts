import { SupabaseClient } from "@supabase/supabase-js";
import {
  NEURALWATT_VISION_MODEL,
  requestNeuralwattChat,
  type NeuralwattTool,
} from "@/lib/neuralwatt";

const RECEIPT_ANALYSIS_TOOL_NAME = "analyze_payment_receipt";
const RECEIPT_ANALYSIS_FIELDS = [
  "is_payment_receipt",
  "amount",
  "currency",
  "reference_number",
  "sender",
  "recipient",
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
      "Return a structured visual analysis of an uploaded GCash or BPI proof-of-payment image.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        is_payment_receipt: {
          type: "boolean",
          description:
            "True only when the image visibly appears to be a GCash or BPI payment/transfer confirmation.",
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
          description: "The visible recipient/account name, or null when absent or unreadable.",
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
  referenceNumber?: string;
  providerModel?: string;
  isDuplicate?: boolean;
  duplicateRef?: string;
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

export async function verifyReceipt(
  imageBuffer: Buffer,
  mimeType: string
): Promise<VerificationResult> {
  try {
    const base64 = imageBuffer.toString("base64");
    const primaryPrompt = [
      "Inspect this uploaded proof-of-payment image.",
      "It may be a GCash receipt or a BPI transfer confirmation.",
      "Read the final amount paid, currency, visible transaction/reference number, sender, recipient, and date.",
      "Use null for any unreadable or missing detail.",
      "Only flag AI generation or tampering when there is strong visible evidence; do not treat compression, screenshots, or ordinary UI rendering as suspicious.",
    ].join(" ");

    const primaryResult = await callVisionModel(base64, mimeType, primaryPrompt);
    const parsed = parseReceiptAnalysis(primaryResult.rawText);
    if (!parsed) {
      throw new Error("Kimi receipt analysis did not match the required schema");
    }

    // NOTE: A previous implementation compared the current receipt's text
    // description against past `receipt_description` strings using the vision
    // model and set `isDuplicate` from that comparison. This was unreliable:
    // the model only sees the current image (not the prior receipt), so it
    // guessed based on wording similarity alone — producing false-positive
    // "Duplicate transaction detected" rejections on legitimate resubmissions.
    //
    // True duplicate detection is handled authoritatively by the
    // receipt-hash DB lookup in each API route
    // (`findActiveDuplicateReceiptRecord`), which runs BEFORE the AI verifier
    // and respects transaction status. The AI verifier's job here is amount
    // extraction + AI-generated-image detection only.
    const isDuplicate = false;
    const duplicateRef: string | undefined = undefined;

    return {
      success: parsed.isPaymentReceipt && parsed.amount !== null,
      extractedAmount: parsed.amount,
      currency: parsed.currency,
      confidence: parsed.confidence,
      rawText: parsed.receiptDescription.substring(0, 200),
      reason: parsed.reason || undefined,
      isAIGenerated: parsed.isAIGenerated,
      aiGeneratedScore: parsed.aiGeneratedScore,
      tamperingScore: parsed.tamperingScore,
      isPaymentReceipt: parsed.isPaymentReceipt,
      referenceNumber: parsed.referenceNumber || undefined,
      providerModel: primaryResult.model,
      isDuplicate,
      duplicateRef,
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
    };
  }
}

type ParsedReceiptAnalysis = {
  isPaymentReceipt: boolean;
  amount: number | null;
  currency: "PHP" | null;
  referenceNumber: string | null;
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

  const requiredFields = [
    "is_payment_receipt",
    "amount",
    "currency",
    "reference_number",
    "sender",
    "recipient",
    "date",
    "is_ai_generated",
    "ai_generated_score",
    "tampering_score",
    "confidence",
    "reason",
    "receipt_description",
  ];
  if (!requiredFields.every((field) => Object.hasOwn(parsed, field))) {
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

  if (
    typeof parsed.is_payment_receipt !== "boolean" ||
    typeof parsed.is_ai_generated !== "boolean" ||
    (amount !== null && amount <= 0) ||
    (parsed.currency !== null && parsed.currency !== "PHP") ||
    !isNullableString(parsed.reference_number) ||
    !isNullableString(parsed.sender) ||
    !isNullableString(parsed.recipient) ||
    !isNullableString(parsed.date) ||
    !isNullableString(parsed.reason) ||
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
    isAIGenerated: parsed.is_ai_generated,
    aiGeneratedScore,
    tamperingScore,
    confidence,
    reason: nullableString(parsed.reason),
    receiptDescription,
  };
}

function tryParseJSON(text: string): Record<string, unknown> | null {
  // Try direct parse first
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {}

  // Try to extract JSON from markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      const value = JSON.parse(jsonMatch[1].trim());
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    } catch {}
  }

  // Try to find { } pattern
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

export async function autoVerifyAndApproveTopup(params: {
  supabase: SupabaseClient;
  topupId: string;
  requestedAmount: number;
  imageBuffer: Buffer;
  mimeType: string;
}) {
  const { supabase, topupId, requestedAmount, imageBuffer, mimeType } = params;

  const result = await verifyReceipt(imageBuffer, mimeType);

  // Reject AI-generated receipts immediately
  if (result.isAIGenerated && (result.aiGeneratedScore ?? 0) > 70) {
    await supabase.from("topups").update({
      status: "rejected",
      receipt_data: JSON.stringify({
        ai_verified_at: new Date().toISOString(),
        extracted_amount: result.extractedAmount,
        confidence: result.confidence,
        is_ai_generated: true,
        ai_generated_score: result.aiGeneratedScore,
        auto_approved: false,
        reason: `AI-generated receipt detected (score: ${result.aiGeneratedScore}%)`,
      }),
    }).eq("id", topupId);

    return { ...result, autoApproved: false, rejectedAsFake: true };
  }

  // Reject duplicate transactions
  if (result.isDuplicate) {
    await supabase.from("topups").update({
      status: "rejected",
      receipt_data: JSON.stringify({
        ai_verified_at: new Date().toISOString(),
        extracted_amount: result.extractedAmount,
        confidence: result.confidence,
        is_duplicate: true,
        duplicate_reason: result.duplicateRef,
        auto_approved: false,
        reason: `Duplicate transaction detected: ${result.duplicateRef || "Same receipt used again"}`,
      }),
    }).eq("id", topupId);

    return { ...result, autoApproved: false, rejectedAsDuplicate: true };
  }

  const match = result.success &&
    result.isPaymentReceipt === true &&
    result.currency === "PHP" &&
    result.confidence >= 0.7 &&
    !result.isAIGenerated &&
    (result.tamperingScore ?? 0) < 70 &&
    result.extractedAmount !== null &&
    Math.abs(result.extractedAmount - requestedAmount) <= requestedAmount * 0.05; // 5% tolerance

  const updateData: Record<string, unknown> = {
    receipt_data: JSON.stringify({
      ai_verified_at: new Date().toISOString(),
      extracted_amount: result.extractedAmount,
      currency: result.currency,
      confidence: result.confidence,
      is_ai_generated: result.isAIGenerated,
      ai_generated_score: result.aiGeneratedScore,
      tampering_score: result.tamperingScore,
      is_payment_receipt: result.isPaymentReceipt,
      reference_number: result.referenceNumber,
      provider_model: result.providerModel,
      auto_approved: match,
      receipt_description: result.rawText.substring(0, 200),
      reason: result.reason || null,
    }),
  };

  await supabase.from("topups").update(updateData).eq("id", topupId);

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

      return { ...result, autoApproved: true, reason: "AI verified — amount matches receipt" };
    } catch (err) {
      console.error("Auto-approval failed:", err);
      return { ...result, autoApproved: false, reason: "Atomic approval failed" };
    }
  }

  return {
    ...result,
    autoApproved: false,
    reason: result.reason || `Amount mismatch: extracted ₱${result.extractedAmount} vs requested ₱${requestedAmount}`,
  };
}
