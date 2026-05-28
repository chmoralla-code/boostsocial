import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VALID_SENDERS = new Set(["customer", "admin", "system"]);
const VALID_READERS = new Set(["customer", "admin"]);

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Missing email parameter" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data: messages, error } = await supabase
      .from("customer_messages")
      .select("*")
      .eq("customer_email", email.trim().toLowerCase())
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
    const { email, message, sender } = await req.json();

    if (!email || !message || !sender) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const normalizedSender = String(sender).trim().toLowerCase();
    if (!VALID_SENDERS.has(normalizedSender)) {
      return NextResponse.json({ error: "Invalid message sender" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("customer_messages")
      .insert([
        {
          customer_email: normalizeEmail(email),
          message: String(message).trim(),
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
    const { email, reader } = await req.json();

    if (!email || !reader) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const normalizedReader = String(reader).trim().toLowerCase();
    if (!VALID_READERS.has(normalizedReader)) {
      return NextResponse.json({ error: "Invalid message reader" }, { status: 400 });
    }

    const senderToMark = normalizedReader === "customer" ? "admin" : "customer";
    const supabase = getSupabase();
    const { error } = await supabase
      .from("customer_messages")
      .update({ is_read: true })
      .eq("customer_email", normalizeEmail(email))
      .eq("sender", senderToMark)
      .eq("is_read", false);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("PATCH customer messages failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
