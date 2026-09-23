import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { capturePaypalOrder, verifyWebhook } from "@/lib/paypal";
import { markOrderPaid } from "@/lib/orders";
import { alertSeller } from "@/lib/notify";

/**
 * PayPal webhook — confirms payments even if the customer closed the browser before returning.
 * In PayPal Developer → your app → Webhooks, add: https://YOUR-DOMAIN/api/paypal/webhook
 * with events CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED, PAYMENT.CAPTURE.REFUNDED,
 * then paste the Webhook ID into Admin → Settings → Payments.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!(await verifyWebhook(req.headers, event).catch(() => false))) {
    return NextResponse.json({ error: "signature verification failed" }, { status: 401 });
  }

  const type: string = event.event_type || "";
  const res = event.resource || {};
  try {
    if (type === "CHECKOUT.ORDER.APPROVED") {
      const order = res.id ? await db.order.findFirst({ where: { paypalOrderId: String(res.id) } }) : null;
      if (order && order.paymentStatus !== "paid") {
        const cap = await capturePaypalOrder(res.id);
        if (cap.status === "COMPLETED" && cap.currency === "USD" && cap.amountCents >= order.total) {
          await markOrderPaid(order.id, { paypalCaptureId: cap.captureId });
        }
      }
    } else if (type === "PAYMENT.CAPTURE.COMPLETED") {
      const paypalOrderId = res.supplementary_data?.related_ids?.order_id;
      const order =
        (paypalOrderId && (await db.order.findFirst({ where: { paypalOrderId } }))) ||
        (res.custom_id && (await db.order.findUnique({ where: { id: String(res.custom_id) } }))) ||
        (res.invoice_id && (await db.order.findUnique({ where: { number: String(res.invoice_id) } })));
      const cents = Math.round(parseFloat(res.amount?.value || "0") * 100);
      if (order && order.paymentStatus !== "paid" && res.amount?.currency_code === "USD" && cents >= order.total) {
        await db.order.update({ where: { id: order.id }, data: { paymentMethod: "paypal" } });
        await markOrderPaid(order.id, { paypalCaptureId: res.id });
      }
    } else if (type === "PAYMENT.CAPTURE.DENIED" || type === "PAYMENT.CAPTURE.REFUNDED" || type === "PAYMENT.CAPTURE.REVERSED") {
      const paypalOrderId = res.supplementary_data?.related_ids?.order_id;
      const order = (paypalOrderId && (await db.order.findFirst({ where: { paypalOrderId } }))) || (res.id ? await db.order.findFirst({ where: { paypalCaptureId: String(res.id) } }) : null);
      if (order) {
        await db.order.update({ where: { id: order.id }, data: { paymentStatus: type.endsWith("DENIED") ? "unpaid" : "refunded", notes: `${order.notes}\nPayPal: ${type}`.trim() } });
        await alertSeller(`PayPal ${type.split(".").pop()?.toLowerCase()} — ${order.number}`, `PayPal reported ${type} for order ${order.number}.`, `/admin/orders/${order.id}`);
      }
    }
  } catch (e) {
    console.error("[paypal webhook]", type, e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 }); // PayPal retries
  }
  return NextResponse.json({ ok: true });
}
