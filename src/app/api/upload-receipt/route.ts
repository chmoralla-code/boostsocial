import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderApprovalNotification } from "@/lib/telegram";

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
      .select(`
        id,
        customer_email,
        payment_method,
        amount,
        quantity,
        target_url,
        services (
          title
        )
      `)
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

    const { data: publicUrlData } = supabase.storage
      .from("receipts")
      .getPublicUrl(fileName);

    if (orderData?.payment_method !== "Wallet") {
      const serviceTitle = Array.isArray((orderData as any)?.services)
        ? (orderData as any).services[0]?.title
        : (orderData as any)?.services?.title;

      sendOrderApprovalNotification({
        orderId,
        trackingId: `BS-${orderId.slice(0, 8).toUpperCase()}`,
        service: serviceTitle || "SMM Service",
        email,
        quantity: Number(orderData?.quantity || 0),
        amount: Number(orderData?.amount || 0),
        paymentMethod: orderData?.payment_method || "GCash",
        receiptUrl: publicUrlData.publicUrl,
        details: orderData?.target_url || undefined,
      }).catch((telegramErr) => {
        console.error("Telegram order approval notification failed (non-blocking):", telegramErr);
      });
    }

    return NextResponse.json({ success: true, data, email, receiptUrl: publicUrlData.publicUrl });
  } catch (err: any) {
    console.error("Upload endpoint failed:", err);
    return NextResponse.json({ error: err.message || err.toString() }, { status: 500 });
  }
}
