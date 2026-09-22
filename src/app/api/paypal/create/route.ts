import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createPaypalOrder, paypalConfigured } from "@/lib/paypal";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!(await rateLimit("pp-create", 30, 10 * 60_000))) return NextResponse.json({ error: "Too many attempts, please wait a moment." }, { status: 429 });
  if (!(await paypalConfigured())) return NextResponse.json({ error: "PayPal is not available right now — please use bank transfer or contact us." }, { status: 503 });
  const { number, token } = await req.json().catch(() => ({}));
  if (typeof number !== "string" || typeof token !== "string") return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const order = await db.order.findUnique({ where: { number } });
  if (!order || token !== order.accessToken) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentStatus === "paid") return NextResponse.json({ error: "This order is already paid." }, { status: 400 });
  if (order.status === "cancelled") return NextResponse.json({ error: "This order was cancelled." }, { status: 400 });
  if (order.total <= 0) return NextResponse.json({ error: "Nothing to pay on this order." }, { status: 400 });
  try {
    const id = await createPaypalOrder({ id: order.id, number: order.number, total: order.total });
    await db.order.update({ where: { id: order.id }, data: { paypalOrderId: id } });
    return NextResponse.json({ id });
  } catch (e: any) {
    console.error("[paypal create]", e);
    return NextResponse.json({ error: "Could not start PayPal. Please try again, or use bank transfer." }, { status: 502 });
  }
}
