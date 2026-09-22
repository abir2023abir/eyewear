import "server-only";
import { randomBytes, randomInt } from "crypto";
import { db } from "./db";
import { emailPaymentReceipt } from "./emails";
import { alertSeller } from "./notify";
import { usd } from "./money";
import { onPaid } from "./chat-checkout";

export function newOrderNumber() {
  const d = new Date();
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  return `WK${ymd}-${randomInt(100000, 999999)}`;
}
export const newToken = () => randomBytes(24).toString("hex");

/** Single source of truth for an order total (cents). */
export const orderTotal = (o: { subtotal: number; bundleDiscount: number; lensTotal: number; shipping: number; adjustment: number }) =>
  o.subtotal - o.bundleDiscount + o.lensTotal + o.shipping + o.adjustment;

/** Marks an order paid exactly once: decrements stock, closes a quote, sends the receipt. */
export async function markOrderPaid(orderId: string, patch: { paypalCaptureId?: string } = {}) {
  const updated = await db.order.updateMany({
    where: { id: orderId, paymentStatus: { not: "paid" } },
    data: { paymentStatus: "paid", status: "paid", paidAt: new Date(), ...patch },
  });
  if (updated.count === 0) return; // already paid — idempotent
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  for (const it of order.items) {
    await db.variant.updateMany({ where: { id: it.variantId }, data: { stock: { decrement: it.qty } } });
  }
  await db.variant.updateMany({ where: { stock: { lt: 0 } }, data: { stock: 0 } });
  if (order.quoteId) {
    const q = await db.quote.update({ where: { id: order.quoteId }, data: { status: "paid" } }).catch(() => null);
    if (q) {
      await db.message.create({ data: { conversationId: q.conversationId, sender: "system", body: `Quote paid — order ${order.number}` } });
      // flip the quote card to "Paid" in the chat history
      const msgs = await db.message.findMany({ where: { conversationId: q.conversationId, kind: "quote" } });
      for (const m of msgs) {
        if (m.payload.includes(q.token)) {
          const p = JSON.parse(m.payload);
          p.status = "paid";
          await db.message.update({ where: { id: m.id }, data: { payload: JSON.stringify(p) } });
        }
      }
    }
  }
  await onPaid(order).catch((e) => console.error("[chat] thank-you message failed", e));
  await emailPaymentReceipt(order);
  await alertSeller(`Paid order ${order.number} — ${usd(order.total)}`, `${order.name} (${order.country}) paid by ${order.paymentMethod}.`, `/admin/orders/${order.id}`);
}
