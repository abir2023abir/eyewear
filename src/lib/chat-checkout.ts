import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import type { Order, OrderItem } from "@prisma/client";
import { db } from "./db";
import { getSettings } from "./settings";
import { countryName } from "./countries";
import { formatEta, needsCustomsId, quoteFor } from "./shipping";
import { bankReady, paypalReady } from "./settings-shared";

export const CHAT_COOKIE = "chat_vt";

/** Finds the visitor's chat thread (cookie) or starts a new one. */
export async function getOrCreateConversation(who: { name?: string; email?: string; userId?: string | null }) {
  const jar = await cookies();
  const token = jar.get(CHAT_COOKIE)?.value;
  let conv = token ? await db.conversation.findUnique({ where: { visitorToken: token } }) : null;
  if (!conv) {
    const t = randomBytes(24).toString("hex");
    conv = await db.conversation.create({ data: { visitorToken: t, name: who.name || "", email: who.email || "", userId: who.userId ?? null } });
    jar.set(CHAT_COOKIE, t, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !/^http:\/\/localhost/.test(process.env.NEXT_PUBLIC_SITE_URL || ""), path: "/", maxAge: 60 * 60 * 24 * 365 });
  } else if ((who.name && !conv.name) || (who.email && !conv.email) || (who.userId && !conv.userId)) {
    conv = await db.conversation.update({ where: { id: conv.id }, data: { name: conv.name || who.name || "", email: conv.email || who.email || "", userId: conv.userId || who.userId || null } });
  }
  return conv;
}

/** After sign-in, the visitor's current chat thread (cookie) belongs to their account. */
export async function linkChatToUser(userId: string) {
  const jar = await cookies();
  const token = jar.get(CHAT_COOKIE)?.value;
  if (token) {
    await db.conversation.updateMany({ where: { visitorToken: token, userId: null }, data: { userId } }).catch(() => {});
    return;
  }
  // new device: continue the customer's latest conversation instead of starting a blank one
  const latest = await db.conversation.findFirst({ where: { userId }, orderBy: { lastMessageAt: "desc" } });
  if (latest) jar.set(CHAT_COOKIE, latest.visitorToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !/^http:\/\/localhost/.test(process.env.NEXT_PUBLIC_SITE_URL || ""), path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function post(conversationId: string, sender: "assistant" | "customer" | "seller" | "system", kind: string, body: string, payload?: unknown) {
  const m = await db.message.create({ data: { conversationId, sender, kind, body, payload: payload ? JSON.stringify(payload) : "" } });
  await db.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), ...(sender === "customer" ? { unreadForSeller: { increment: 1 } } : { unreadForCustomer: { increment: 1 } }) },
  });
  return m;
}

async function patchCard(conversationId: string, kind: string, orderNumber: string, patch: Record<string, unknown>) {
  const msgs = await db.message.findMany({ where: { conversationId, kind } });
  for (const m of msgs) {
    try {
      const p = JSON.parse(m.payload || "{}");
      if (p.number !== orderNumber) continue;
      await db.message.update({ where: { id: m.id }, data: { payload: JSON.stringify({ ...p, ...patch }) } });
    } catch {}
  }
}

const fill = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");

type O = Order & { items: OrderItem[] };

export function orderCard(o: O) {
  return {
    number: o.number,
    token: o.accessToken,
    items: o.items.map((i) => ({ name: i.name, colorName: i.colorName, qty: i.qty, lens: i.lensName === "Frame only" && !i.coatings ? "" : [i.lensName !== "Frame only" ? i.lensName : "", i.coatings].filter(Boolean).join(" + "), total: (i.unitPrice + i.lensPrice) * i.qty })),
    ship: { name: o.name, phone: o.phone, email: o.email, lines: [o.line1, o.line2, [o.city, o.state, o.postcode].filter(Boolean).join(" "), countryName(o.country)].filter(Boolean) },
    subtotal: o.subtotal,
    bundleDiscount: o.bundleDiscount,
    lensTotal: o.lensTotal,
    shipping: o.shipping,
    adjustment: o.adjustment,
    total: o.total,
  };
}

async function paymentCard(o: O) {
  const { payments, chat } = await getSettings();
  const methods = [paypalReady(payments) && "paypal", bankReady(payments) && "xtransfer"].filter(Boolean) as string[];
  return post(o.conversationId!, "assistant", "payment", chat.paymentIntro, {
    number: o.number,
    token: o.accessToken,
    total: o.total,
    methods,
    chosen: methods.length === 1 ? methods[0] : o.paymentMethod === "paypal" || o.paymentMethod === "xtransfer" ? o.paymentMethod : "",
    status: "open",
    bank: bankReady(payments)
      ? { beneficiary: payments.xtransferBeneficiary, bank: payments.xtransferBank, account: payments.xtransferAccount, swift: payments.xtransferSwift, note: payments.xtransferNote }
      : null,
  });
}

/** Runs right after the customer presses "Confirm order": posts the order and the next step into their chat. */
export async function startChatCheckout(o: O) {
  if (!o.conversationId) return;
  const { chat, shipping } = await getSettings();
  const q = quoteFor(shipping, o.country, o.items.reduce((s, i) => s + i.qty, 0), 0, o.lensTotal > 0, o.createdAt);
  await post(o.conversationId, "customer", "order", "", orderCard(o));
  await post(o.conversationId, "assistant", "text", fill(chat.greeting, { name: o.name.split(" ")[0], number: o.number }));
  if (q.kind === "intl") {
    await post(o.conversationId, "assistant", "shipping", chat.shippingIntro, {
      number: o.number,
      token: o.accessToken,
      kind: "intl",
      courier: q.name,
      price: o.shipping,
      eta: formatEta(q.etaFrom, q.etaTo),
      days: [q.daysMin, q.daysMax],
      country: countryName(o.country),
      requiresId: needsCustomsId(shipping, o.country),
      idLabel: shipping.customsIdLabel,
      fields: { name: o.name, phone: o.phone, postcode: o.postcode, line1: o.line1, city: o.city, customsId: o.customsId },
      confirmed: false,
    });
  } else {
    await post(o.conversationId, "assistant", "shipping", chat.domesticIntro, {
      number: o.number, token: o.accessToken, kind: "domestic", courier: q.name, price: o.shipping,
      eta: formatEta(q.etaFrom, q.etaTo), days: [q.daysMin, q.daysMax], country: countryName(o.country), requiresId: false, idLabel: "", fields: {}, confirmed: true,
    });
    await paymentCard(o);
  }
}

/** Customer confirmed the DHL details in chat. */
export async function confirmShipping(o: O, fields: { phone: string; postcode: string; customsId: string }) {
  if (!o.conversationId) return;
  await patchCard(o.conversationId, "shipping", o.number, { confirmed: true, fields: { name: o.name, line1: o.line1, city: o.city, ...fields } });
  const already = await db.message.findFirst({ where: { conversationId: o.conversationId, kind: "payment", payload: { contains: `"number":"${o.number}"` } } });
  if (!already) await paymentCard(o);
}

export async function choosePayment(o: O, method: string) {
  if (!o.conversationId) return;
  await patchCard(o.conversationId, "payment", o.number, { chosen: method });
}

export async function onReceiptUploaded(o: Order) {
  if (!o.conversationId) return;
  const { chat } = await getSettings();
  await patchCard(o.conversationId, "payment", o.number, { status: "awaiting", chosen: "xtransfer" });
  await post(o.conversationId, "assistant", "text", fill(chat.thanksTransfer, { number: o.number }));
}

export async function onPaid(o: Order) {
  if (!o.conversationId) return;
  const { chat } = await getSettings();
  const eta = o.deliveryDaysMax
    ? formatEta(addDays(o.paidAt || new Date(), o.deliveryDaysMin), addDays(o.paidAt || new Date(), o.deliveryDaysMax))
    : "";
  await patchCard(o.conversationId, "payment", o.number, { status: "paid", chosen: o.paymentMethod });
  await post(o.conversationId, "assistant", "thanks", fill(chat.thanksPaid, { number: o.number, eta: eta || "we’ll confirm shortly" }), { number: o.number, token: o.accessToken, total: o.total, method: o.paymentMethod, eta });
}

export async function onShipped(o: Order) {
  if (!o.conversationId || !o.trackingNumber) return;
  await post(o.conversationId, "assistant", "text", `Good news — order ${o.number} has shipped! Tracking number: ${o.trackingNumber}. Track it anytime on dhl.com or from your order page.`);
}

function addDays(d: Date, businessDays: number) {
  const x = new Date(d);
  let left = businessDays;
  while (left > 0) {
    x.setDate(x.getDate() + 1);
    if (x.getDay() !== 0 && x.getDay() !== 6) left--;
  }
  return x.toISOString();
}
