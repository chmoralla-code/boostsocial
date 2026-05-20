import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
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
  } catch (err: any) {
    console.error("GET customer messages failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, message, sender } = await req.json();

    if (!email || !message || !sender) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("customer_messages")
      .insert([
        {
          customer_email: email.trim().toLowerCase(),
          message: message.trim(),
          sender: sender,
          is_read: false
        }
      ])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, message: data });
  } catch (err: any) {
    console.error("POST customer message failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
