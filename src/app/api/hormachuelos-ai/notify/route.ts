import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseServiceRoleKey } from "@/utils/env";

const SETTING_KEY = "hormachuelos_ai_notify_list";

type NotifyEntry = { email: string; createdAt: string };

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export async function POST(req: NextRequest) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  try {
    const db = createServiceClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { persistSession: false },
    });

    const { data } = await db
      .from("settings")
      .select("value")
      .eq("key", SETTING_KEY)
      .single();

    const existing = Array.isArray(data?.value) ? (data.value as NotifyEntry[]) : [];
    const alreadySubscribed = existing.some(
      (entry) => typeof entry?.email === "string" && entry.email === email
    );

    if (!alreadySubscribed) {
      const updated = [...existing, { email, createdAt: new Date().toISOString() }];
      await db
        .from("settings")
        .upsert(
          { key: SETTING_KEY, value: updated, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );
    }

    return NextResponse.json({ success: true, alreadySubscribed });
  } catch (err) {
    console.error("Hormachuelos notify subscribe error:", err);
    return NextResponse.json(
      { error: "Could not save your email right now. Please try again later." },
      { status: 500 }
    );
  }
}
