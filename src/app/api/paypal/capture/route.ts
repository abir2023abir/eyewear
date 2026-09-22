import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { capturePaypalOrder } from "@/lib/paypal";
import { markOrderPaid } from "@/lib/orders";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!(await rateLimit("pp-capture", 30, 10 * 60_000))) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  const { number, token, paypalOrderId } = await req.json().catch(() => ({}));
  if (typeof number !== "string" || typeof token !== "string") return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const order = await db.order.findUnique({ where: { number } });
  if (!order || token !== order.accessToken) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentStatus === "paid") return NextResponse.json({ ok: true });
  // only capture the PayPal order we created for this store order
  if (!paypalOrderId || paypalOrderId !== order.paypalOrderId) return NextResponse.json({ error: "Payment mismatch" }, { status: 400 });
  try {
    const cap = await capturePaypalOrder(paypalOrderId);
    if (cap.declined) return NextResponse.json({ error: "Your card or PayPal funding source was declined. Please try another card or payment method.", restart: true }, { status: 402 });
    if (cap.status !== "COMPLETED") {
      // e.g. PENDING (eCheck / review) — the webhook will confirm it later
      await db.order.update({ where: { id: order.id }, data: { notes: `${order.notes}\nPayPal status ${cap.status} (capture ${cap.captureId || "-"})`.trim() } });
      return NextResponse.json({ error: `PayPal is still processing your payment (${cap.status.toLowerCase()}). We’ll email you as soon as it’s confirmed.` }, { status: 202 });
    }
    if (cap.currency !== "USD" || cap.amountCents < order.total) {
      console.error("[paypal] amount mismatch", order.number, cap);
      await db.order.update({ where: { id: order.id }, data: { notes: `${order.notes}\nPayPal amount mismatch: ${cap.amountCents} ${cap.currency}`.trim() } });
      return NextResponse.json({ error: "Payment amount mismatch — our team will contact you." }, { status: 400 });
    }
    await db.order.update({ where: { id: order.id }, data: { paymentMethod: "paypal" } });
    await markOrderPaid(order.id, { paypalCaptureId: cap.captureId });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[paypal capture]", e);
    return NextResponse.json({ error: "Payment could not be confirmed. If money was taken, don’t worry — we’ll match it and email you." }, { status: 502 });
  }
}
