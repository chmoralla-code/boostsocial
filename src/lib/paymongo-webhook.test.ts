import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { sendAdminAlert } from "@/lib/telegram";
import { POST } from "@/app/api/paymongo/webhook/route";

// Everything the webhook touches is replaced with a stand-in, so the route runs
// end to end without reaching the database, the backup mirror or Telegram.
const stub = vi.hoisted(() => {
  const backupWrites: Array<{ table: string; values: Record<string, unknown>; column: string; value: unknown }> = [];
  const backupClient = {
    from: (table: string) => ({
      update: (values: Record<string, unknown>) => ({
        eq: async (column: string, value: unknown) => {
          backupWrites.push({ table, values, column, value });
          return { data: null, error: null };
        },
      }),
    }),
  };
  return {
    topupRow: null as null | { checkout_session_id: string },
    statusRow: null as null | { status: string; amount_centavos: number; email: string },
    confirm: null as null | Array<Record<string, unknown>>,
    rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
    backupWrites,
    backupClient,
    afterCallbacks: [] as Array<() => Promise<unknown>>,
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: (table: string) => {
      let columns = "";
      const query = {
        select(cols: string) {
          columns = cols;
          return query;
        },
        eq() {
          return query;
        },
        in() {
          return query;
        },
        update() {
          return query;
        },
        async maybeSingle() {
          if (table !== "paymongo_topups") return { data: null, error: null };
          return { data: columns === "checkout_session_id" ? stub.topupRow : stub.statusRow, error: null };
        },
      };
      return query;
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      stub.rpcCalls.push({ name, args });
      return { data: stub.confirm, error: null };
    },
  }),
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    // Queue the side effects instead of dropping them, so the tests can run them.
    after: (callback: () => Promise<unknown>) => {
      stub.afterCallbacks.push(callback);
    },
  };
});

vi.mock("@/lib/paymongo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paymongo")>()),
  isPaymongoConfigured: () => true,
  isPaymongoTestMode: () => false,
  verifyPaymongoSignature: () => true,
}));

vi.mock("@/lib/telegram", () => ({ sendAdminAlert: vi.fn(async () => undefined) }));
vi.mock("@/lib/customerNotifications", () => ({ notifyCustomer: vi.fn(async () => undefined) }));
vi.mock("@/utils/referrals", () => ({ creditReferralCommission: vi.fn(async () => undefined) }));
vi.mock("@/lib/approvalEmails", () => ({ sendTopupApprovedEmail: vi.fn(async () => undefined) }));
vi.mock("@/utils/supabase/dual-db", () => ({
  syncBackupAdminClients: vi.fn(async (write: (client: unknown) => Promise<unknown>) => write(stub.backupClient)),
}));

const TOPUP_ID = "5b1f0c8e-2d3a-4f6b-9c7d-8e9f0a1b2c3d";
const CONFIRMED = [{ confirmed: true, topup_id: TOPUP_ID, user_id: "user-1", amount: 500, new_balance: 1000 }];

// A payment.paid event: the payment itself, with no checkout session id.
function paymentPaid(metadata?: Record<string, string>) {
  return {
    data: {
      id: "evt_payment_paid_1",
      attributes: {
        type: "payment.paid",
        data: {
          id: "pay_1",
          attributes: {
            amount: 50000,
            source: { type: "gcash" },
            ...(metadata ? { metadata } : {}),
          },
        },
      },
    },
  };
}

// A checkout_session.payment.paid event: the session id and our marker.
function sessionPaid(sessionId: string) {
  return {
    data: {
      id: "evt_session_paid_1",
      attributes: {
        type: "checkout_session.payment.paid",
        data: {
          id: sessionId,
          attributes: {
            metadata: { topup_id: TOPUP_ID },
            payments: [{ id: "pay_2", attributes: { status: "paid", amount: 50000, source: { type: "gcash" } } }],
          },
        },
      },
    },
  };
}

async function deliver(event: unknown) {
  const req = new NextRequest("http://localhost/api/paymongo/webhook", {
    method: "POST",
    body: JSON.stringify(event),
    headers: { "paymongo-signature": "t=1,te=test" },
  });
  const res = await POST(req);
  for (const callback of stub.afterCallbacks.splice(0)) await callback();
  return res;
}

const alertTitles = () => vi.mocked(sendAdminAlert).mock.calls.map(([alert]) => alert.title);

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  stub.topupRow = null;
  stub.statusRow = null;
  stub.confirm = null;
  stub.rpcCalls.length = 0;
  stub.backupWrites.length = 0;
  stub.afterCallbacks.length = 0;
  vi.mocked(sendAdminAlert).mockClear();
});

describe("PayMongo webhook: payment.paid events", () => {
  it("credits through its top-up marker, mirrors the session it resolved, and stays quiet", async () => {
    stub.topupRow = { checkout_session_id: "cs_1" };
    stub.confirm = CONFIRMED;

    const res = await deliver(paymentPaid({ topup_id: TOPUP_ID }));

    expect(res.status).toBe(200);
    expect(stub.rpcCalls).toHaveLength(1);
    expect(stub.rpcCalls[0].args.p_checkout_session_id).toBe("cs_1");
    expect(alertTitles().filter((title) => /no session id|unknown top-up/.test(title))).toEqual([]);
    expect(stub.backupWrites).toContainEqual(
      expect.objectContaining({ table: "paymongo_topups", column: "checkout_session_id", value: "cs_1" }),
    );
  });

  it("stays silent when its session already credited the top-up", async () => {
    stub.topupRow = { checkout_session_id: "cs_1" };
    stub.confirm = [{ confirmed: false }];
    stub.statusRow = { status: "paid", amount_centavos: 50000, email: "buyer@example.com" };

    const res = await deliver(paymentPaid({ topup_id: TOPUP_ID }));

    expect(res.status).toBe(200);
    expect(stub.rpcCalls).toHaveLength(1);
    expect(alertTitles()).toEqual([]);
    expect(stub.backupWrites).toEqual([]);
  });

  it("acknowledges a payment with no marker quietly (another business's sale)", async () => {
    const res = await deliver(paymentPaid());

    expect(res.status).toBe(200);
    expect(stub.rpcCalls).toEqual([]);
    expect(alertTitles()).toEqual([]);
  });

  it("ignores a marker that is not a top-up id", async () => {
    const res = await deliver(paymentPaid({ topup_id: "not-a-uuid" }));

    expect(res.status).toBe(200);
    expect(stub.rpcCalls).toEqual([]);
    expect(alertTitles()).toEqual([]);
  });

  it("raises the unknown top-up alert when our marker matches no row", async () => {
    stub.topupRow = null;

    const res = await deliver(paymentPaid({ topup_id: TOPUP_ID }));

    expect(res.status).toBe(200);
    expect(stub.rpcCalls).toEqual([]);
    expect(alertTitles()).toEqual(["⚠️ PayMongo webhook: unknown top-up"]);
  });
});

describe("PayMongo webhook: checkout session events", () => {
  it("still credits by the session id the event carries", async () => {
    stub.confirm = CONFIRMED;

    const res = await deliver(sessionPaid("cs_9"));

    expect(res.status).toBe(200);
    expect(stub.rpcCalls[0].args.p_checkout_session_id).toBe("cs_9");
    expect(stub.backupWrites).toContainEqual(
      expect.objectContaining({ table: "paymongo_topups", column: "checkout_session_id", value: "cs_9" }),
    );
  });
});
