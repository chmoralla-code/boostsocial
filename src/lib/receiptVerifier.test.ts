import { beforeEach, describe, expect, it, vi } from "vitest";

const requestNeuralwattChat = vi.fn();
vi.mock("@/lib/neuralwatt", () => ({
  NEURALWATT_VISION_MODEL: "test-vision-model",
  requestNeuralwattChat: (...args: unknown[]) => requestNeuralwattChat(...args),
}));

import { amountMatches, autoVerifyAndApproveTopup } from "@/lib/receiptVerifier";

type Row = { id: string; status: string; gcash_reference?: string | null; receipt_data?: string | null };

/** Minimal Supabase stand-in: topups/orders tables, update(), or() lookups and the approval RPC. */
function fakeSupabase(initialTopups: Row[] = []) {
  const topups = [...initialTopups];
  const rpc = vi.fn(async () => ({ error: null }));
  const client = {
    rpc,
    topups,
    from(table: string) {
      const rows = table === "topups" ? topups : [];
      return {
        select: () => ({
          or: (filter: string) => ({
            limit: async () => {
              const values = [...filter.matchAll(/gcash_reference\.eq\.([A-Z0-9]+)/g)].map((m) => m[1]);
              return { data: rows.filter((r) => r.gcash_reference && values.includes(r.gcash_reference)), error: null };
            },
          }),
        }),
        update: (patch: Partial<Row>) => ({
          eq: async (_col: string, id: string) => {
            const row = rows.find((r) => r.id === id);
            if (row) Object.assign(row, patch);
            return { error: null };
          },
        }),
      };
    },
  };
  return client;
}

function aiSays(overrides: Record<string, unknown> = {}) {
  const analysis = {
    is_payment_receipt: true,
    amount: 500,
    currency: "PHP",
    reference_number: "1012 345 678901",
    sender: "Juan D.",
    recipient: "HE•••Y S.",
    recipient_account: "+63 950 ••• 9963",
    recipient_institution: "GCash",
    payment_rail: "gcash",
    date: "Sep 24, 2026 10:00 AM",
    is_ai_generated: false,
    ai_generated_score: 2,
    tampering_score: 3,
    confidence: 0.95,
    reason: null,
    receipt_description: "GCash Express Send receipt",
    ...overrides,
  };
  requestNeuralwattChat.mockResolvedValueOnce({
    message: { content: JSON.stringify(analysis) },
    model: "test-vision-model",
  });
}

async function runTopup(supabase: ReturnType<typeof fakeSupabase>, requestedAmount = 500) {
  return autoVerifyAndApproveTopup({
    supabase: supabase as never,
    topupId: "topup-new",
    requestedAmount,
    imageBuffer: Buffer.from("fake-image"),
    mimeType: "image/jpeg",
  });
}

describe("amountMatches", () => {
  it("accepts the exact amount and a small overpayment (transfer fee)", () => {
    expect(amountMatches(500, 500)).toBe(true);
    expect(amountMatches(515, 500)).toBe(true);
  });

  it("never accepts an underpayment", () => {
    expect(amountMatches(499, 500)).toBe(false);
    expect(amountMatches(950, 1000)).toBe(false);
  });

  it("rejects big overpayments and unreadable amounts for manual review", () => {
    expect(amountMatches(600, 500)).toBe(false);
    expect(amountMatches(null, 500)).toBe(false);
  });
});

describe("autoVerifyAndApproveTopup", () => {
  beforeEach(() => requestNeuralwattChat.mockReset());

  it("auto-approves a valid receipt and asks the vision model", async () => {
    const supabase = fakeSupabase([{ id: "topup-new", status: "pending" }]);
    aiSays();
    const result = await runTopup(supabase);

    expect(result.autoApproved).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith("approve_topup_atomic", {
      p_topup_id: "topup-new",
      p_amount: 500,
      p_reviewed_by: "ai-verifier",
    });
    expect(requestNeuralwattChat.mock.calls[0][0]).toMatchObject({ task: "vision", model: "test-vision-model" });
  });

  it("holds an underpaid receipt for manual review", async () => {
    const supabase = fakeSupabase([{ id: "topup-new", status: "pending" }]);
    aiSays({ amount: 475 });
    const result = await runTopup(supabase);

    expect(result.autoApproved).toBe(false);
    expect(result.reason).toMatch(/Amount too low/);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("holds a receipt sent to the wrong GCash account", async () => {
    const supabase = fakeSupabase([{ id: "topup-new", status: "pending" }]);
    aiSays({ recipient: "Maria C.", recipient_account: "0917 ••• 1234" });
    const result = await runTopup(supabase);

    expect(result.autoApproved).toBe(false);
    expect(result.reason).toMatch(/destination mismatch/);
  });

  it("rejects a reference already used on another active top-up", async () => {
    const supabase = fakeSupabase([
      { id: "topup-old", status: "approved", gcash_reference: "1012345678901" },
      { id: "topup-new", status: "pending" },
    ]);
    aiSays();
    const result = await runTopup(supabase);

    expect(result).toMatchObject({ autoApproved: false, rejectedAsDuplicate: true });
    expect(supabase.topups.find((r) => r.id === "topup-new")?.status).toBe("rejected");
  });

  it("does not credit twice when the same payment is uploaded concurrently", async () => {
    const supabase = fakeSupabase([{ id: "topup-new", status: "pending" }]);
    aiSays();
    // Simulate a parallel upload that saves the same reference while the AI
    // call for this one is still running.
    const originalRpc = supabase.rpc;
    const originalFrom = supabase.from.bind(supabase);
    let lookups = 0;
    supabase.from = (table: string) => {
      const api = originalFrom(table);
      if (table !== "topups") return api;
      return {
        ...api,
        select: () => ({
          or: () => ({
            limit: async () => {
              lookups += 1;
              return lookups > 1
                ? { data: [{ id: "topup-parallel", status: "pending", gcash_reference: "1012345678901" }], error: null }
                : { data: [], error: null };
            },
          }),
        }),
      };
    };
    const result = await runTopup(supabase);

    expect(result.autoApproved).toBe(false);
    expect(result.reason).toMatch(/Held for manual review/);
    expect(originalRpc).not.toHaveBeenCalled();
  });

  it("falls back to manual review when the AI provider errors", async () => {
    const supabase = fakeSupabase([{ id: "topup-new", status: "pending" }]);
    requestNeuralwattChat.mockRejectedValueOnce(new Error("No AI provider is configured."));
    const result = await runTopup(supabase);

    expect(result.autoApproved).toBe(false);
    expect(result.reason).toMatch(/No AI provider is configured/);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
