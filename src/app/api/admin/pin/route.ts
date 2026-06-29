import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  PIN_REGEX,
  isPinSet,
  setPin,
  getPinConfig,
  verifyPin,
  createUnlockToken,
  UNLOCK_COOKIE,
  UNLOCK_COOKIE_OPTIONS,
  getLockStatus,
  recordFailedAttempt,
  resetAttempts,
} from "@/lib/adminPin";

async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email || !user.email.endsWith("@boostsocial.com")) return null;
  return user.email;
}

function buildUnlockResponse(email: string, payload: Record<string, unknown>) {
  const res = NextResponse.json(payload);
  res.cookies.set(UNLOCK_COOKIE, createUnlockToken(email), UNLOCK_COOKIE_OPTIONS);
  return res;
}

export async function GET() {
  const email = await requireAdmin();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [set, lock] = await Promise.all([isPinSet(), getLockStatus()]);
  return NextResponse.json({
    set,
    locked: lock.locked,
    remainingMs: lock.remainingMs,
    attemptsRemaining: lock.attemptsRemaining,
  });
}

export async function POST(req: NextRequest) {
  const email = await requireAdmin();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { action?: string; pin?: string; currentPin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = body.action;
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";
  const currentPin = typeof body.currentPin === "string" ? body.currentPin.trim() : "";

  if (action === "status") {
    const [set, lock] = await Promise.all([isPinSet(), getLockStatus()]);
    return NextResponse.json({
      set,
      locked: lock.locked,
      remainingMs: lock.remainingMs,
      attemptsRemaining: lock.attemptsRemaining,
    });
  }

  if (action === "setup") {
    if (!PIN_REGEX.test(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
    }
    if (await isPinSet()) {
      return NextResponse.json(
        { error: "A PIN is already set. Use change instead." },
        { status: 409 }
      );
    }
    try {
      await setPin(pin);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to set PIN.";
      // Surface a 503 + schemaMissing flag when the admin_secrets table is
      // missing so the frontend can render the actionable SQL instead of a
      // generic 500 error.
      const schemaMissing = /admin_secrets table does not exist/i.test(message);
      return NextResponse.json(
        { error: message, schemaMissing },
        { status: schemaMissing ? 503 : 500 }
      );
    }
    await resetAttempts();
    return buildUnlockResponse(email, { success: true });
  }

  if (action === "unlock") {
    const lock = await getLockStatus();
    if (lock.locked) {
      return NextResponse.json(
        {
          error: "Too many attempts. Please wait and try again.",
          locked: true,
          remainingMs: lock.remainingMs,
        },
        { status: 429 }
      );
    }
    if (!PIN_REGEX.test(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 4 digits." }, { status: 400 });
    }
    const config = await getPinConfig();
    if (!config) {
      return NextResponse.json({ error: "No PIN is configured yet." }, { status: 400 });
    }
    const ok = await verifyPin(pin, config);
    if (!ok) {
      const r = await recordFailedAttempt();
      if (r.locked) {
        return NextResponse.json(
          {
            error: "Too many incorrect attempts. Locked for 5 minutes.",
            locked: true,
            remainingMs: r.remainingMs,
          },
          { status: 429 }
        );
      }
      const status = await getLockStatus();
      return NextResponse.json(
        { error: "Incorrect PIN.", attemptsRemaining: status.attemptsRemaining },
        { status: 401 }
      );
    }
    await resetAttempts();
    return buildUnlockResponse(email, { success: true });
  }

  if (action === "change") {
    if (!PIN_REGEX.test(pin)) {
      return NextResponse.json(
        { error: "New PIN must be exactly 4 digits." },
        { status: 400 }
      );
    }
    if (!PIN_REGEX.test(currentPin)) {
      return NextResponse.json(
        { error: "Current PIN is required." },
        { status: 400 }
      );
    }
    const config = await getPinConfig();
    if (!config) {
      return NextResponse.json({ error: "No PIN is configured yet." }, { status: 400 });
    }
    const lock = await getLockStatus();
    if (lock.locked) {
      return NextResponse.json(
        { error: "Locked. Please wait and try again.", locked: true },
        { status: 429 }
      );
    }
    const ok = await verifyPin(currentPin, config);
    if (!ok) {
      const r = await recordFailedAttempt();
      if (r.locked) {
        return NextResponse.json(
          { error: "Too many incorrect attempts. Locked for 5 minutes.", locked: true },
          { status: 429 }
        );
      }
      const status = await getLockStatus();
      return NextResponse.json(
        { error: "Current PIN is incorrect.", attemptsRemaining: status.attemptsRemaining },
        { status: 401 }
      );
    }
    try {
      await setPin(pin);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update PIN.";
      const schemaMissing = /admin_secrets table does not exist/i.test(message);
      return NextResponse.json(
        { error: message, schemaMissing },
        { status: schemaMissing ? 503 : 500 }
      );
    }
    await resetAttempts();
    return buildUnlockResponse(email, { success: true });
  }

  if (action === "lock") {
    const res = NextResponse.json({ success: true });
    res.cookies.delete(UNLOCK_COOKIE);
    return res;
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
