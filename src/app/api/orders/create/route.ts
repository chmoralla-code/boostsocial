import { NextRequest, NextResponse } from "next/server";
import { dualWrite } from "@/utils/supabase/dual-db";

const MAX_TARGET_LENGTH = 7000;

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const serviceId = clean(body.serviceId);
    const email = clean(body.email).toLowerCase();
    const targetUrl = clean(body.targetUrl);
    const paymentMethod = clean(body.paymentMethod) || "GCash";
    const quantity = Number(body.quantity);
    const amount = Number(body.amount);
    const smmServiceId = body.smmServiceId === undefined || body.smmServiceId === null
      ? null
      : clean(body.smmServiceId);

    if (!serviceId || !email || !targetUrl) {
      return NextResponse.json({ error: "Missing service, email, or target details." }, { status: 400 });
    }

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
      return NextResponse.json({ error: "Invalid order quantity." }, { status: 400 });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid order amount." }, { status: 400 });
    }

    if (targetUrl.length > MAX_TARGET_LENGTH) {
      return NextResponse.json({ error: "Order details are too long." }, { status: 400 });
    }

    const orderId = crypto.randomUUID();
    const payload = {
      id: orderId,
      service_id: serviceId,
      customer_email: email,
      target_url: targetUrl,
      amount,
      status: "Pending",
      payment_method: paymentMethod,
      quantity,
      smm_service_id: smmServiceId || null,
    };

    const { error, databaseUsed } = await dualWrite(async (dbClient) => {
      return dbClient
        .from("orders")
        .insert([payload])
        .select("id")
        .single();
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      orderId,
      data: { id: orderId },
      databaseUsed,
    });
  } catch (err: unknown) {
    console.error("Create order endpoint failed:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
