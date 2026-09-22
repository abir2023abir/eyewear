import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { markOrderPaid, orderTotal } from "@/lib/orders";
import { onShipped } from "@/lib/chat-checkout";
import { emailOrderPlaced, emailPaymentReceipt, emailPaymentRequest, emailShipped, orderLink } from "@/lib/emails";
import { sendMail, layout, esc } from "@/lib/mail";
import { capturePaypalOrder, getPaypalOrder } from "@/lib/paypal";
import { COUNTRIES } from "@/lib/countries";

const STATUSES = ["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"] as const;
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("mark_paid"), method: z.enum(["paypal", "xtransfer", "cash", "other"]).optional() }),
  z.object({ action: z.literal("reject_proof") }),
  z.object({ action: z.literal("refunded") }),
  z.object({ action: z.literal("status"), status: z.enum(STATUSES) }),
  z.object({ action: z.literal("tracking"), tracking: z.string().trim().min(4).max(40) }),
  z.object({ action: z.literal("note"), note: z.string().trim().min(1).max(1000) }),
  z.object({ action: z.literal("paypal_check") }),
  z.object({ action: z.literal("resend"), email: z.enum(["confirmation", "payment_link", "receipt", "shipped"]) }),
  z.object({ action: z.literal("delete"), confirm: z.literal("DELETE") }),
  z.object({
    action: z.literal("edit"),
    email: z.string().trim().email().max(200),
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(3).max(30),
    line1: z.string().trim().min(1).max(120),
    line2: z.string().trim().max(120),
    city: z.string().trim().min(1).max(80),
    state: z.string().trim().max(80),
    postcode: z.string().trim().max(20),
    country: z.string().length(2).refine((c) => COUNTRIES.some(([k]) => k === c)),
    shipping: z.number().int().min(0).max(1_000_000),
    adjustment: z.number().int().min(-1_000_000).max(1_000_000),
  }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Invalid action" }, { status: 400 });
  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = p.data;
  const stamp = `[${new Date().toISOString().slice(0, 16).replace("T", " ")} ${admin.email}]`;
  const note = (t: string) => `${order.notes}\n${stamp} ${t}`.trim();

  try {
    switch (a.action) {
      case "mark_paid":
        if (a.method) await db.order.update({ where: { id }, data: { paymentMethod: a.method } });
        await markOrderPaid(order.id);
        await db.order.update({ where: { id }, data: { notes: note(`Payment confirmed manually${a.method ? ` (${a.method})` : ""}`) } });
        return NextResponse.json({ message: "Payment confirmed — receipt emailed to the customer." });
      case "reject_proof":
        await db.order.update({ where: { id }, data: { paymentStatus: "unpaid", notes: note("Transfer receipt rejected") } });
        await sendMail(order.email, `Payment for order ${order.number} — action needed`, await layout("We couldn’t confirm your transfer", `<p>We couldn’t match your bank transfer receipt for order <b>${esc(order.number)}</b>. Please check the amount and reference, then upload a new receipt or pay by PayPal.</p><p><a href="${esc(orderLink(order))}">Open your order</a></p>`));
        return NextResponse.json({ message: "Receipt rejected — customer notified." });
      case "refunded":
        await db.order.update({ where: { id }, data: { paymentStatus: "refunded", status: "cancelled", notes: note("Marked refunded") } });
        return NextResponse.json({ message: "Marked refunded." });
      case "status":
        await db.order.update({ where: { id }, data: { status: a.status, notes: note(`Status → ${a.status}`) } });
        return NextResponse.json({ message: "Status updated." });
      case "note":
        await db.order.update({ where: { id }, data: { notes: note(a.note) } });
        return NextResponse.json({ message: "Note added." });
      case "tracking": {
        const updated = await db.order.update({ where: { id }, data: { trackingNumber: a.tracking, status: "shipped", notes: note(`Tracking ${a.tracking}`) }, include: { items: true } });
        const sent = await emailShipped(updated);
        await onShipped(updated).catch(() => {});
        return NextResponse.json({ message: sent ? "Tracking saved — customer notified by email and chat." : "Tracking saved and posted in the customer’s chat (email not sent — check SMTP settings)." });
      }
      case "paypal_check": {
        if (!order.paypalOrderId) return NextResponse.json({ error: "The customer hasn’t started a PayPal payment for this order yet." }, { status: 400 });
        let info = await getPaypalOrder(order.paypalOrderId);
        if (info.orderStatus === "APPROVED") info = { ...(await capturePaypalOrder(order.paypalOrderId)), orderStatus: "COMPLETED" };
        if (info.status === "COMPLETED" && info.currency === "USD" && info.amountCents >= order.total) {
          await db.order.update({ where: { id }, data: { paymentMethod: "paypal", notes: note(`PayPal capture ${info.captureId} verified`) } });
          await markOrderPaid(order.id, { paypalCaptureId: info.captureId });
          return NextResponse.json({ message: `PayPal payment confirmed (${info.captureId}).` });
        }
        return NextResponse.json({ message: `PayPal status: ${info.orderStatus || info.status}${info.amountCents ? ` · ${(info.amountCents / 100).toFixed(2)} ${info.currency}` : ""}. Not paid yet.` });
      }
      case "resend": {
        const sent =
          a.email === "confirmation" ? await emailOrderPlaced(order)
          : a.email === "payment_link" ? await emailPaymentRequest(order)
          : a.email === "receipt" ? await emailPaymentReceipt(order)
          : await emailShipped(order);
        await db.order.update({ where: { id }, data: { notes: note(`Emailed ${a.email.replace("_", " ")}`) } });
        return NextResponse.json({ message: sent ? `Email sent to ${order.email}.` : "Email not sent — set up SMTP in Store settings → Email." });
      }
      case "edit": {
        const amountsChanged = a.shipping !== order.shipping || a.adjustment !== order.adjustment;
        if (amountsChanged && order.paymentStatus === "paid") return NextResponse.json({ error: "This order is already paid — amounts can’t be changed. Refund or create a new order instead." }, { status: 400 });
        const total = orderTotal({ ...order, shipping: a.shipping, adjustment: a.adjustment });
        if (total < 0) return NextResponse.json({ error: "The discount is larger than the order total." }, { status: 400 });
        const { action: _a, ...fields } = a;
        await db.order.update({ where: { id }, data: { ...fields, total, notes: note(amountsChanged ? `Edited — shipping ${a.shipping / 100}, adjustment ${a.adjustment / 100}, new total ${total / 100}` : "Customer details edited") } });
        return NextResponse.json({ message: amountsChanged ? "Saved — new total calculated. Use “Send payment link” to email the customer." : "Saved." });
      }
      case "delete": {
        if (order.paymentStatus === "paid") return NextResponse.json({ error: "Paid orders can’t be deleted — mark them refunded/cancelled instead." }, { status: 400 });
        await db.order.delete({ where: { id } });
        return NextResponse.json({ message: "Order deleted.", deleted: true });
      }
    }
  } catch (e: any) {
    console.error("[admin order]", a.action, e);
    return NextResponse.json({ error: e?.message || "Something went wrong" }, { status: 500 });
  }
}
