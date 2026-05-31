import { SupabaseClient } from "@supabase/supabase-js";
import {
  ReferralTier,
  formatReferralRate,
  getNextReferralTier,
  getReferralTier,
} from "@/utils/referral-program";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";

export type ReferralSummary = {
  inviteCount: number;
  totalEarned: number;
  totalReferralSpend: number;
  tier: ReferralTier;
  nextTier: ReferralTier | null;
};

type CommissionSource = "order" | "topup";

type CreditReferralCommissionInput = {
  primaryClient: SupabaseClient;
  customerId?: string | null;
  customerEmail?: string | null;
  source: CommissionSource;
  amount: number;
  referenceId: string;
};

type ProfileLite = {
  id: string;
  email: string | null;
  referred_by?: string | null;
  balance?: number | string | null;
};

function numericSum(rows: Array<{ amount?: number | string | null }> | null | undefined) {
  return (rows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

export function isCommissionTransaction(row: { description?: string | null }) {
  return String(row.description || "").toLowerCase().includes("commission");
}

async function getReferredProfiles(client: SupabaseClient, referrerId: string) {
  const { data, error } = await client
    .from("profiles")
    .select("id, email")
    .eq("referred_by", referrerId);

  if (error) throw error;
  return (data || []) as ProfileLite[];
}

export async function getReferralSummary(client: SupabaseClient, referrerId: string): Promise<ReferralSummary> {
  const referredProfiles = await getReferredProfiles(client, referrerId);
  const referredIds = referredProfiles.map((profile) => profile.id);
  const referredEmails = referredProfiles
    .map((profile) => profile.email?.trim().toLowerCase())
    .filter(Boolean) as string[];

  let orderSpend = 0;
  let topupSpend = 0;

  if (referredEmails.length > 0) {
    const { data: orders, error: ordersError } = await client
      .from("orders")
      .select("amount")
      .in("customer_email", referredEmails)
      .in("status", ["Processing", "Completed"]);

    if (ordersError) throw ordersError;
    orderSpend = numericSum(orders);
  }

  if (referredIds.length > 0) {
    const { data: topups, error: topupsError } = await client
      .from("topups")
      .select("amount")
      .in("user_id", referredIds)
      .eq("status", "approved");

    if (topupsError) throw topupsError;
    topupSpend = numericSum(topups);
  }

  const { data: transactions, error: transactionsError } = await client
    .from("referral_transactions")
    .select("amount, description")
    .eq("referrer_id", referrerId);

  if (transactionsError) throw transactionsError;

  const totalReferralSpend = orderSpend + topupSpend;
  return {
    inviteCount: referredProfiles.length,
    totalEarned: numericSum((transactions || []).filter(isCommissionTransaction)),
    totalReferralSpend,
    tier: getReferralTier(totalReferralSpend),
    nextTier: getNextReferralTier(totalReferralSpend),
  };
}

async function getCustomerProfile(client: SupabaseClient, customerId?: string | null, customerEmail?: string | null) {
  let query = client
    .from("profiles")
    .select("id, email, referred_by");

  if (customerId) {
    query = query.eq("id", customerId);
  } else if (customerEmail) {
    query = query.eq("email", customerEmail.trim().toLowerCase());
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data as ProfileLite | null;
}

async function hasCommissionRecord(
  client: SupabaseClient,
  referrerId: string,
  source: CommissionSource,
  referenceId: string
) {
  const marker = `[ref:${source}:${referenceId}]`;
  const { data, error } = await client
    .from("referral_transactions")
    .select("id")
    .eq("referrer_id", referrerId)
    .ilike("description", `%${marker}%`)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function creditOnClient(
  client: SupabaseClient,
  input: Omit<CreditReferralCommissionInput, "primaryClient">,
  fixedTier?: ReferralTier
) {
  const amount = Number(input.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { credited: false, reason: "invalid_amount" };
  }

  const customer = await getCustomerProfile(client, input.customerId, input.customerEmail);
  if (!customer?.referred_by || customer.referred_by === customer.id) {
    return { credited: false, reason: "not_referred" };
  }

  if (await hasCommissionRecord(client, customer.referred_by, input.source, input.referenceId)) {
    return { credited: false, reason: "already_credited" };
  }

  const tier = fixedTier || (await getReferralSummary(client, customer.referred_by)).tier;
  const rate = input.source === "order" ? tier.orderRate : tier.topupRate;
  const commission = Number((amount * rate).toFixed(2));

  const { data: referrer, error: referrerError } = await client
    .from("profiles")
    .select("balance")
    .eq("id", customer.referred_by)
    .single();

  if (referrerError || !referrer) {
    throw referrerError || new Error("Referrer profile not found");
  }

  const newBalance = Number((Number(referrer.balance || 0) + commission).toFixed(2));
  const { error: balanceError } = await client
    .from("profiles")
    .update({ balance: newBalance })
    .eq("id", customer.referred_by);

  if (balanceError) throw balanceError;

  const sourceLabel = input.source === "order" ? "order" : "GCash top-up";
  const marker = `[ref:${input.source}:${input.referenceId}]`;
  const { error: transactionError } = await client
    .from("referral_transactions")
    .insert([{
      referrer_id: customer.referred_by,
      referee_id: customer.id,
      amount: commission,
      description: `${tier.name} ${formatReferralRate(rate)} commission from ${sourceLabel} PHP ${amount.toFixed(2)} ${marker}`,
    }]);

  if (transactionError) throw transactionError;

  return {
    credited: true,
    commission,
    tier,
    referrerId: customer.referred_by,
    customerId: customer.id,
  };
}

export async function creditReferralCommission(input: CreditReferralCommissionInput) {
  const primaryResult = await creditOnClient(input.primaryClient, input);

  if (!primaryResult.credited) {
    return primaryResult;
  }

  await syncBackupAdminClients(async (backupClient) => {
    await creditOnClient(backupClient, input, primaryResult.tier);
  }, "referral commission sync");

  return primaryResult;
}
