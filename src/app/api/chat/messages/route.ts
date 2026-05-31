import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { isAdminEmail } from "@/utils/security/admin";
import { enforceRateLimit } from "@/utils/security/rate-limit";

const VALID_SENDERS = new Set(["customer", "admin", "system"]);
const VALID_READERS = new Set(["customer", "admin"]);
const MAX_MESSAGE_LENGTH = 2000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase credentials missing in env");
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  });
}

async function getRequestActor() {
  const sessionClient = await createServerClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user?.email) {
    return null;
  }

  const email = normalizeEmail(user.email);
  return {
    email,
    isAdmin: isAdminEmail(email),
  };
}

export async function GET(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "chat-messages-get",
      maxRequests: 80,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const actor = await getRequestActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Missing email parameter" }, { status: 400 });
    }

    const normalizedRequestedEmail = normalizeEmail(email);
    if (!actor.isAdmin && actor.email !== normalizedRequestedEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getSupabase();
    const { data: messages, error } = await supabase
      .from("customer_messages")
      .select("*")
      .eq("customer_email", normalizedRequestedEmail)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ messages: messages || [] });
  } catch (err: unknown) {
    console.error("GET customer messages failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "chat-messages-post",
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const actor = await getRequestActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, message, sender } = await req.json();

    if (!email || !message || !sender) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const normalizedSender = String(sender).trim().toLowerCase();
    if (!VALID_SENDERS.has(normalizedSender)) {
      return NextResponse.json({ error: "Invalid message sender" }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    if (actor.isAdmin) {
      if (normalizedSender !== "admin" && normalizedSender !== "system") {
        return NextResponse.json({ error: "Admin sender type is invalid." }, { status: 403 });
      }
    } else {
      if (actor.email !== normalizedEmail || normalizedSender !== "customer") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const trimmedMessage = String(message).trim();
    if (!trimmedMessage || trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "Message must be between 1 and 2000 characters." }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("customer_messages")
      .insert([
        {
          customer_email: normalizedEmail,
          message: trimmedMessage,
          sender: normalizedSender,
          is_read: normalizedSender === "system"
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: data });
  } catch (err: unknown) {
    console.error("POST customer message failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const rateLimitResponse = enforceRateLimit(req, {
      key: "chat-messages-patch",
      maxRequests: 40,
      windowMs: 60_000,
    });
    if (rateLimitResponse) return rateLimitResponse;

    const actor = await getRequestActor();
    if (!actor) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, reader } = await req.json();

    if (!email || !reader) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const normalizedReader = String(reader).trim().toLowerCase();
    if (!VALID_READERS.has(normalizedReader)) {
      return NextResponse.json({ error: "Invalid message reader" }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    if (actor.isAdmin) {
      if (normalizedReader !== "admin") {
        return NextResponse.json({ error: "Invalid admin reader context." }, { status: 403 });
      }
    } else {
      if (normalizedReader !== "customer" || actor.email !== normalizedEmail) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const senderToMark = normalizedReader === "customer" ? "admin" : "customer";
    const supabase = getSupabase();
    const { error } = await supabase
      .from("customer_messages")
      .update({ is_read: true })
      .eq("customer_email", normalizedEmail)
      .eq("sender", senderToMark)
      .eq("is_read", false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("PATCH customer messages failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
