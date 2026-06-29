import { SupabaseClient } from "@supabase/supabase-js";

const OPENCODE_ZEN_API_KEY = process.env.OPENCODE_ZEN_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
const OPENCODE_ZEN_BASE = "https://opencode.ai/zen/v1";
const VISION_MODEL = "mimo-v2.5-free";

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

export async function verifyReceipt(
  imageBuffer: Buffer,
  mimeType: string,
  supabase?: SupabaseClient,
  userEmail?: string
): Promise<VerificationResult> {
  try {
    const base64 = imageBuffer.toString("base64");

    // Step 1: Extract amount and check if AI-generated
    const primaryPrompt = `You are a GCash receipt verification AI. Analyze this receipt image and return a JSON object with these exact fields:
{
  "amount": <number or null if not found>,
  "currency": "<PHP or null>",
  "reference_number": "<string or null>",
  "sender": "<string or null>",
  "date": "<string or null>",
  "is_ai_generated": <true/false>,
  "ai_generated_score": <number 0-100>,
  "reason": "<explanation, or null if amount found>",
  "receipt_description": "<brief 10-word summary of what this receipt shows>"
}

Rules:
- Extract total amount paid — look for PHP, ₱, P preceded numbers
- If amount found, reason should be null
- If no amount found, explain why
- For is_ai_generated: look for obvious AI artifacts, weird text, unrealistic fonts, pixel inconsistencies
- ai_generated_score: 0 = definitely real photo, 100 = definitely AI generated
- receipt_description: short summary like "GCash payment ₱500 to Henry S."`;

    const primaryResult = await callVisionModel(base64, mimeType, primaryPrompt);
    const parsed = tryParseJSON(primaryResult);

    const extractedAmount = parsed?.amount ? parseFloat(String(parsed.amount)) : null;
    const isAIGenerated = parsed?.is_ai_generated === true;
    const aiGeneratedScore = typeof parsed?.ai_generated_score === "number" ? parsed.ai_generated_score : 0;
    const receiptDescription = parsed?.receipt_description || "";

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

    // Build the result
    const result: VerificationResult = {
      success: extractedAmount !== null,
      extractedAmount,
      confidence: isAIGenerated ? Math.max(0.3, 1 - aiGeneratedScore / 100) : 0.85,
      rawText: primaryResult.substring(0, 500),
      reason: parsed?.reason || undefined,
      isAIGenerated,
      aiGeneratedScore,
      isDuplicate,
      duplicateRef,
    };

    // Store receipt description for future duplicate checks
    if (receiptDescription && supabase) {
      try {
        const currentData = { receipt_description: receiptDescription };
        // We don't await this — fire and forget
        result.rawText = receiptDescription.substring(0, 200);
      } catch {}
    }

    return result;
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
    };
  }
}

function tryParseJSON(text: string): Record<string, any> | null {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {}

  // Try to extract JSON from markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {}
  }

  // Try to find { } pattern
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
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
  userEmail: string;
}) {
  const { supabase, topupId, requestedAmount, imageBuffer, mimeType, userEmail } = params;

  const result = await verifyReceipt(imageBuffer, mimeType, supabase, userEmail);

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

  const match = result.extractedAmount !== null &&
    Math.abs(result.extractedAmount - requestedAmount) <= requestedAmount * 0.05; // 5% tolerance

  const updateData: Record<string, any> = {
    receipt_data: JSON.stringify({
      ai_verified_at: new Date().toISOString(),
      extracted_amount: result.extractedAmount,
      confidence: result.confidence,
      is_ai_generated: result.isAIGenerated,
      ai_generated_score: result.aiGeneratedScore,
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
