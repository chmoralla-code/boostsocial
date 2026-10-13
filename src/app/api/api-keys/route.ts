import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/utils/env";
import { syncBackupAdminClients } from "@/utils/supabase/dual-db";
import { enforceRateLimit } from "@/utils/security/rate-limit";
import { generateApiKey } from "@/lib/apiKeys";
import { sendAdminAlert } from "@/lib/telegram";

/**
 * Reseller API keys — the signed-in user's own keys.
 *
 * GET    → list the caller's keys (never the key itself, only its prefix)
 * POST   → create one, returning the full key ONCE
 * DELETE → revoke one
 *
 * A key is always tied to the caller's own wallet, so creating one can never
 * grant access to anyone else's money.
 */

const MAX_KEYS_PER_USER = 5;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as Record<string, unknown>).message || error);
  }
  return String(error);
}

function adminClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false },
  });
}

async function requireUser() {
  const sessionClient = await createServerClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "api-keys-list",
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const supabase = adminClient();
    const { data, error } = await supabase
      .from("api_keys")
      .select(
        "id, label, key_prefix, is_active, daily_limit, monthly_limit, spent_day, spent_month, allowed_ips, last_used_at, created_at, revoked_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      if (/relation|does not exist|schema cache/i.test(error.message || "")) {
        return NextResponse.json({ keys: [], available: false });
      }
      throw error;
    }

    return NextResponse.json({ keys: data || [], available: true });
  } catch (error: unknown) {
    console.error("List API keys failed:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "api-keys-create",
      maxRequests: 5,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const label = String(body?.label || "").trim().slice(0, 60) || "Default key";
    const dailyLimit = body?.dailyLimit === null || body?.dailyLimit === undefined
      ? null
      : Number(body.dailyLimit);
    const monthlyLimit = body?.monthlyLimit === null || body?.monthlyLimit === undefined
      ? null
      : Number(body.monthlyLimit);

    if (dailyLimit !== null && (!Number.isFinite(dailyLimit) || dailyLimit <= 0)) {
      return NextResponse.json({ error: "Daily limit must be a positive number." }, { status: 400 });
    }
    if (monthlyLimit !== null && (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0)) {
      return NextResponse.json({ error: "Monthly limit must be a positive number." }, { status: 400 });
    }

    const supabase = adminClient();

    const { count, error: countError } = await supabase
      .from("api_keys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("revoked_at", null);

    if (countError) {
      if (/relation|does not exist|schema cache/i.test(countError.message || "")) {
        return NextResponse.json(
          { error: "The reseller API is not available yet." },
          { status: 503 }
        );
      }
      throw countError;
    }

    if ((count ?? 0) >= MAX_KEYS_PER_USER) {
      return NextResponse.json(
        { error: `You can have at most ${MAX_KEYS_PER_USER} active keys. Revoke one first.` },
        { status: 409 }
      );
    }

    const generated = generateApiKey();

    const { data: inserted, error: insertError } = await supabase
      .from("api_keys")
      .insert({
        user_id: user.id,
        label,
        key_prefix: generated.keyPrefix,
        key_hash: generated.keyHash,
        daily_limit: dailyLimit,
        monthly_limit: monthlyLimit,
      })
      .select("id, label, key_prefix, daily_limit, monthly_limit, created_at")
      .single();

    if (insertError) throw insertError;

    // Mirror to the backups so a failover keeps the key working.
    await syncBackupAdminClients(async (backupClient) => {
      await backupClient.from("api_keys").upsert(
        {
          id: inserted.id,
          user_id: user.id,
          label,
          key_prefix: generated.keyPrefix,
          key_hash: generated.keyHash,
          daily_limit: dailyLimit,
          monthly_limit: monthlyLimit,
        },
        { onConflict: "id" }
      );
    }, "api key create sync");

    // Tell the admin a key exists. No secret goes in the alert.
    sendAdminAlert({
      title: "🔑 New reseller API key",
      message: [
        `Label: ${label}`,
        `Prefix: ${generated.keyPrefix}…`,
        `User: ${user.email || user.id}`,
        `Daily limit: ${dailyLimit ? `₱${dailyLimit}` : "none"}`,
        `Monthly limit: ${monthlyLimit ? `₱${monthlyLimit}` : "none"}`,
      ].join("\n"),
    }).catch((alertError) => {
      console.error("API key alert failed:", alertError);
    });

    // The ONLY time the full key is ever returned.
    return NextResponse.json({
      key: generated.key,
      id: inserted.id,
      label: inserted.label,
      keyPrefix: inserted.key_prefix,
      warning: "Copy this key now — it is shown only once and cannot be recovered.",
    });
  } catch (error: unknown) {
    console.error("Create API key failed:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "api-keys-revoke",
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const user = await requireUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const keyId = String(body?.id || "").trim();
    if (!keyId) {
      return NextResponse.json({ error: "Missing key id." }, { status: 400 });
    }

    const supabase = adminClient();
    const revokedAt = new Date().toISOString();

    // Scoped to user_id, so nobody can revoke a key that is not theirs.
    const { data: revoked, error } = await supabase
      .from("api_keys")
      .update({ is_active: false, revoked_at: revokedAt })
      .eq("id", keyId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!revoked) {
      return NextResponse.json({ error: "Key not found." }, { status: 404 });
    }

    await syncBackupAdminClients(async (backupClient) => {
      await backupClient
        .from("api_keys")
        .update({ is_active: false, revoked_at: revokedAt })
        .eq("id", keyId);
    }, "api key revoke sync");

    return NextResponse.json({ success: true, id: revoked.id });
  } catch (error: unknown) {
    console.error("Revoke API key failed:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
