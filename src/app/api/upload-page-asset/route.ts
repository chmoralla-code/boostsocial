import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orderId = formData.get("orderId") as string | null;
    const assetType = formData.get("assetType") as string | null; // "profile" or "cover"

    if (!file || !orderId || !assetType) {
      return NextResponse.json({ error: "Missing file, orderId, or assetType" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase environment variables missing on server!");
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `${orderId}_${assetType}.${fileExt}`;

    // Upload to 'receipts' bucket which is already pre-configured to allow uploads
    const { error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file, {
        upsert: true
      });

    if (error) {
      throw error;
    }

    // Generate public URL
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/receipts/${fileName}`;

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Asset upload failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
