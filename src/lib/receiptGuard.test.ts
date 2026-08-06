import { describe, it, expect } from "vitest";
import { findActiveDuplicateReceiptRecord, hashReceiptFile, buildReceiptFileName } from "@/lib/receiptGuard";

function mockClient(orders: Array<{ id?: string; status?: string }>, topups: Array<{ id?: string; status?: string }>, vip: Array<{ id?: string; status?: string }>) {
  return {
    from: (table: string) => {
      const allRows = table === "orders" ? orders : table === "topups" ? topups : vip;
      const limit = (rows: Array<{ id?: string; status?: string }>) => async () => ({ data: rows, error: null });
      return {
        select: () => ({
          eq: () => ({
            limit: limit(allRows),
            neq: (_col: string, excludedId: string) => ({
              limit: limit(allRows.filter((r) => r.id !== excludedId)),
            }),
          }),
          neq: () => ({ limit: limit(allRows) }),
          limit: limit(allRows),
        }),
      };
    },
  } as unknown as Parameters<typeof findActiveDuplicateReceiptRecord>[0];
}

describe("findActiveDuplicateReceiptRecord", () => {
  it("returns id when an active order has the hash", async () => {
    const client = mockClient([{ id: "order-1", status: "Processing" }], [], []);
    expect(await findActiveDuplicateReceiptRecord(client, "abc")).toBe("order-1");
  });

  it("ignores rejected rows", async () => {
    const client = mockClient([{ id: "order-1", status: "Rejected" }], [], []);
    expect(await findActiveDuplicateReceiptRecord(client, "abc")).toBeNull();
  });

  it("returns topup id when active", async () => {
    const client = mockClient([], [{ id: "topup-1", status: "approved" }], []);
    expect(await findActiveDuplicateReceiptRecord(client, "abc")).toBe("topup-1");
  });

  it("returns vip id when active", async () => {
    const client = mockClient([], [], [{ id: "vip-1", status: "approved" }]);
    expect(await findActiveDuplicateReceiptRecord(client, "abc")).toBe("vip-1");
  });

  it("respects excludeOrderId", async () => {
    const client = mockClient([{ id: "order-1", status: "Processing" }], [], []);
    expect(await findActiveDuplicateReceiptRecord(client, "abc", "order-1")).toBeNull();
  });
});

describe("hashReceiptFile", () => {
  it("is deterministic", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" });
    const a = await hashReceiptFile(file);
    const b = await hashReceiptFile(file);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("buildReceiptFileName", () => {
  it("builds a safe file name", () => {
    const name = buildReceiptFileName("order-1", "abc123", "User@Example.com", "jpeg");
    expect(name).toContain("order-1_receipt-abc123_user@example.com.jpeg");
  });

  it("sanitizes email and extension", () => {
    const name = buildReceiptFileName("o", "h", "bad email!@x.com", "JPEG");
    expect(name).toMatch(/\.jpeg$/);
    expect(name).not.toContain("!");
  });
});
