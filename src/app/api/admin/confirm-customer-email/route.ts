import { NextRequest, NextResponse } from "next/server";
import { findAuthUserByEmail } from "@/utils/auth/find-user";
import { getBackupAdminClients, getPrimaryAdminClient } from "@/utils/supabase/dual-db";

const CLEARED_OTP = {
  otp_code: null,
  otp_code_hash: null,
  otp_salt: null,
  otp_expires_at: null,
  otp_sent_at: null,
  otp_attempts: 0,
};

/**
 * Manually mark a customer's email as verified. Support escape hatch for when
 * the verification code email can't reach the customer (Resend quota, spam
 * filtering, typo'd inbox), so a paying customer is never locked out.
 * Admin-only: /api/admin/* is gated by src/proxy.ts.
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!cleanEmail) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const primary = getPrimaryAdminClient();
    const user = await findAuthUserByEmail(primary, cleanEmail);
    if (!user) {
      return NextResponse.json(
        { error: "No login account exists for this email. Ask the customer to sign up again — their old orders stay linked by email." },
        { status: 404 }
      );
    }

    if (user.email_confirmed_at) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    const { error } = await primary.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), ...CLEARED_OTP },
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const backup of getBackupAdminClients()) {
      try {
        const backupUser = await findAuthUserByEmail(backup.client, cleanEmail);
        if (backupUser && !backupUser.email_confirmed_at) {
          await backup.client.auth.admin.updateUserById(backupUser.id, { email_confirm: true });
        }
      } catch (e) {
        console.warn(`Failed confirming email on ${backup.displayName}:`, e);
      }
    }

    return NextResponse.json({ success: true, alreadyVerified: false });
  } catch (err) {
    console.error("Admin confirm-customer-email failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to verify customer email." },
      { status: 500 }
    );
  }
}
