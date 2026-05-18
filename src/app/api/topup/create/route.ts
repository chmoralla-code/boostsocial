import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;
    const email = formData.get("email") as string | null;
    const amount = formData.get("amount") as string | null;

    if (!file || !userId || !email || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const priceNum = Number(amount);
    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json({ error: "Invalid top-up amount" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    // Initialize administrative client bypassing RLS policies
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. Create a topup record
    const { data: topup, error: topupError } = await supabase
      .from("topups")
      .insert([{
        user_id: userId,
        email: email.trim(),
        amount: priceNum,
        status: "pending"
      }])
      .select()
      .single();

    if (topupError) {
      throw topupError;
    }

    // 2. Upload file to 'receipts' storage
    const fileExt = file.name.split(".").pop() || "png";
    const fileName = `topup_${topup.id}_${email.trim()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, file, {
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // 3. Get the public URL of the receipt image
    const { data: publicUrlData } = supabase.storage
      .from("receipts")
      .getPublicUrl(fileName);

    // 4. Update the topup record with the receipt public URL
    const { error: updateError } = await supabase
      .from("topups")
      .update({ receipt_url: publicUrlData.publicUrl })
      .eq("id", topup.id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ success: true, topupId: topup.id });
  } catch (err: any) {
    console.error("Top-up creation API failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
