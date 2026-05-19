import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const serviceId = formData.get("serviceId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Missing icon file" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server credentials missing" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const fileExt = file.name.split('.').pop() || 'png';
    const timestamp = Date.now();
    const cleanId = serviceId ? serviceId : "new";
    const fileName = `service_icon_${cleanId}_${timestamp}.${fileExt}`;

    // Upload to 'receipts' bucket under a designated service icons namespace prefix
    const { error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file, {
        upsert: true
      });

    if (error) throw error;

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/receipts/${fileName}`;

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (err: any) {
    console.error("Service icon upload failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
