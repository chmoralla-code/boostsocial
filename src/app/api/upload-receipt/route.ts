import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orderId = formData.get("orderId") as string | null;

    if (!file || !orderId) {
      return NextResponse.json({ error: "Missing file or orderId" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase environment variables missing on server!");
      return NextResponse.json({ error: "Server configuration missing" }, { status: 500 });
    }

    // Initialize administrative client bypassing RLS policies
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    // 1. Fetch the customer email associated with this order to personalize the receipt file
    const { data: orderData, error: fetchError } = await supabase
      .from("orders")
      .select("customer_email")
      .eq("id", orderId)
      .single();

    if (fetchError) {
      console.error("Failed to fetch order customer email:", fetchError);
    }

    const email = orderData?.customer_email ? orderData.customer_email.trim() : "unknown";
    const fileExt = file.name.split('.').pop() || 'png';
    
    // 2. Name the file [orderId]_[email].[ext] to instantly identify who is paying in the storage bucket
    const fileName = `${orderId}_${email}.${fileExt}`;

    // 3. Upload to bucket 'receipts' bypassing client-side constraints
    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(fileName, file, {
        upsert: true
      });

    if (error) {
      throw error;
    }

    // 4. Automatically advance order status to 'Processing' in the database
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "Processing" })
      .eq("id", orderId);

    if (updateError) {
      console.error("Failed to automatically update order status:", updateError);
    }

    return NextResponse.json({ success: true, data, email });
  } catch (err: any) {
    console.error("Upload endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
