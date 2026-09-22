import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { needsCustomsId } from "@/lib/shipping";
import { choosePayment, confirmShipping } from "@/lib/chat-checkout";
import { rateLimit } from "@/lib/ratelimit";
import { bankReady, paypalReady } from "@/lib/settings-shared";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("shipping"),
    number: z.string().max(40),
    token: z.string().max(80),
    phone: z.string().trim().min(5, "Enter a phone number with country code").max(30),
    postcode: z.string().trim().max(20),
    customsId: z.string().trim().max(40).default(""),
  }),
  z.object({ action: z.literal("pay_method"), number: z.string().max(40), token: z.string().max(80), method: z.enum(["paypal", "xtransfer"]) }),
]);

/** Actions from the order cards in the chat: confirm DHL delivery details, choose a payment method. */
export async function POST(req: Request) {
  if (!(await rateLimit("chat-checkout", 60, 10 * 60_000))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Invalid" }, { status: 400 });
  const a = p.data;
  const order = await db.order.findUnique({ where: { number: a.number }, include: { items: true } });
  if (!order || order.accessToken !== a.token) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentStatus === "paid") return NextResponse.json({ error: "This order is already paid." }, { status: 400 });
  const settings = await getSettings();

  if (a.action === "shipping") {
    if (needsCustomsId(settings.shipping, order.country) && a.customsId.length < 4) {
      return NextResponse.json({ error: `${settings.shipping.customsIdLabel} is required by customs in this country.` }, { status: 400 });
    }
    if (!a.postcode && order.country !== settings.shipping.fromCountry) return NextResponse.json({ error: "DHL needs your postcode." }, { status: 400 });
    const updated = await db.order.update({ where: { id: order.id }, data: { phone: a.phone, postcode: a.postcode, customsId: a.customsId }, include: { items: true } });
    await confirmShipping(updated, { phone: a.phone, postcode: a.postcode, customsId: a.customsId });
    return NextResponse.json({ ok: true });
  }

  const enabled = a.method === "paypal" ? paypalReady(settings.payments) : bankReady(settings.payments);
  if (!enabled) return NextResponse.json({ error: "That payment method isn’t available right now." }, { status: 400 });
  const updated = await db.order.update({ where: { id: order.id }, data: { paymentMethod: a.method }, include: { items: true } });
  await choosePayment(updated, a.method);
  return NextResponse.json({ ok: true });
}
