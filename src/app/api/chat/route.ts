import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sellerOnline, serializeMessage } from "@/lib/chat";
import { CHAT_COOKIE, getOrCreateConversation, post } from "@/lib/chat-checkout";
import { getSettings } from "@/lib/settings";
import { formatEta, quoteFor } from "@/lib/shipping";
import { countryName } from "@/lib/countries";
import { alertSeller } from "@/lib/notify";
import { rateLimit } from "@/lib/ratelimit";
import { usd } from "@/lib/money";
import { bankReady, paypalReady } from "@/lib/settings-shared";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const after = url.searchParams.get("after");
  const since = url.searchParams.get("since");
  const open = url.searchParams.get("open") === "1";
  const now = new Date().toISOString();
  const [online, settings] = await Promise.all([sellerOnline(), getSettings()]);
  const base = { online, assistantName: settings.chat.assistantName, now };
  const token = (await cookies()).get(CHAT_COOKIE)?.value;
  if (!token) return NextResponse.json({ ...base, messages: [], updates: [], unread: 0 });
  const conv = await db.conversation.findUnique({ where: { visitorToken: token } });
  if (!conv) return NextResponse.json({ ...base, messages: [], updates: [], unread: 0 });
  const afterDate = after ? new Date(after) : null;
  const sinceDate = since ? new Date(since) : null;
  const messages = await db.message.findMany({
    where: { conversationId: conv.id, ...(afterDate && !isNaN(+afterDate) ? { createdAt: { gt: afterDate } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  // cards (quote / delivery / payment) change after they were delivered — send the changed ones again
  const updates =
    afterDate && sinceDate && !isNaN(+sinceDate)
      ? await db.message.findMany({ where: { conversationId: conv.id, createdAt: { lte: afterDate }, updatedAt: { gt: new Date(+sinceDate - 2000) } } })
      : [];
  if (open && conv.unreadForCustomer) await db.conversation.update({ where: { id: conv.id }, data: { unreadForCustomer: 0 } });
  return NextResponse.json({
    ...base,
    unread: open ? 0 : conv.unreadForCustomer,
    profile: { email: conv.email ? "set" : "" },
    messages: messages.map(serializeMessage),
    updates: updates.map(serializeMessage),
  });
}

const schema = z.object({
  body: z.string().max(2000).default(""),
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().max(200).optional(),
  product: z.object({ variantId: z.string().max(40) }).passthrough().optional(),
  quick: z.enum(["delivery", "customs", "payment", "human"]).optional(),
});

const QUICK_LABEL = { delivery: "How long is delivery?", customs: "Customs & import duty", payment: "Payment methods", human: "Talk to a person" } as const;

export async function POST(req: Request) {
  if (!(await rateLimit("chat", 30, 10 * 60_000))) return NextResponse.json({ error: "You’re sending messages too fast." }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  const { body, name, email, product, quick } = p.data;
  if (!body.trim() && !product && !quick) return NextResponse.json({ error: "Empty message" }, { status: 400 });
  const validEmail = email && z.string().email().safeParse(email).success ? email.toLowerCase() : "";
  const session = await getSession();
  const conv = await getOrCreateConversation({ name: name || session?.name, email: validEmail || session?.email, userId: session?.uid });
  const settings = await getSettings();

  // ----- quick-reply buttons: answered instantly by the order assistant -----
  if (quick) {
    await post(conv.id, "customer", "text", QUICK_LABEL[quick]);
    const s = settings.shipping;
    let answer = "";
    if (quick === "delivery") {
      const order = await db.order.findFirst({ where: { conversationId: conv.id }, orderBy: { createdAt: "desc" }, include: { items: true } });
      if (order) {
        const q = quoteFor(s, order.country, order.items.reduce((n, i) => n + i.qty, 0), 0, order.lensTotal > 0, order.paidAt || new Date());
        answer = `For order ${order.number} to ${countryName(order.country)}: ${q.daysMin}–${q.daysMax} business days${order.paidAt ? "" : " after payment"} — estimated arrival ${formatEta(q.etaFrom, q.etaTo)} by ${q.name}. You’ll get the tracking number as soon as it ships.`;
      } else {
        answer = `We prepare orders in ${s.processingDaysMin}–${s.processingDaysMax} business days${s.lensExtraDays ? ` (+${s.lensExtraDays} with lens upgrades)` : ""}, then ${s.courierName} delivers door-to-door in about ${s.intlDaysMin}–${s.intlDaysMax} business days worldwide (${s.domesticDaysMin}–${s.domesticDaysMax} days within China). At checkout you’ll see the exact estimate for your address.`;
      }
    } else if (quick === "customs") {
      const ids = s.customsIdCountries.split(/[\s,]+/).filter(Boolean).map(countryName);
      answer = `Orders ship DAP from Wenzhou, China. Your country’s customs may charge import duty or tax, collected by DHL on delivery — it isn’t included in our prices.${ids.length ? ` DHL also needs the receiver’s ${s.customsIdLabel.toLowerCase()} for ${ids.join(", ")} — I’ll ask for it at checkout.` : ""}`;
    } else if (quick === "payment") {
      const m = [paypalReady(settings.payments) && "PayPal (balance or any debit/credit card — confirmed instantly)", bankReady(settings.payments) && "international bank transfer via XTransfer (upload your receipt, confirmed within 1 business day)"].filter(Boolean);
      answer = m.length ? `You can pay by ${m.join(" or ")}. Payment happens right here in the chat after you confirm your order.` : "Please message us and our team will help you complete payment.";
    } else {
      answer = (await sellerOnline())
        ? "Of course — a member of our team is online and will reply here in a moment."
        : `Our team is offline right now but has been notified. You’ll get a reply here and by email${conv.email ? ` (${conv.email})` : ""}, usually within a few hours (Beijing time).`;
      if (!(await sellerOnline())) await alertSeller(`Chat: ${conv.name || conv.email || "A visitor"} wants to talk to a person`, `Open the chat inbox to reply.`, `/admin/chat?c=${conv.id}`);
    }
    await post(conv.id, "assistant", "text", answer);
    return NextResponse.json({ ok: true });
  }

  // ----- normal message (optionally with the product being viewed) -----
  let created;
  if (product) {
    // rebuild the product card from the database — never trust client-sent names/prices
    const v = await db.variant.findUnique({ where: { id: product.variantId }, include: { product: true } });
    if (!v) return NextResponse.json({ error: "Product not found" }, { status: 400 });
    const payload = { productId: v.productId, variantId: v.id, slug: v.product.slug, name: `${v.product.name} ${v.product.modelCode}`, colorName: v.colorName, colorHex: v.colorHex, price: v.product.price };
    created = await post(conv.id, "customer", "product", body.trim(), payload);
  } else {
    created = await post(conv.id, "customer", "text", body.trim());
  }
  await db.conversation.update({ where: { id: conv.id }, data: { status: "open" } });

  // offline mode: alert the seller by email + WhatsApp, at most every 10 minutes per conversation
  if (!(await sellerOnline())) {
    const recently = conv.offlineAlertAt && Date.now() - conv.offlineAlertAt.getTime() < 10 * 60_000;
    if (!recently) {
      await db.conversation.update({ where: { id: conv.id }, data: { offlineAlertAt: new Date() } });
      const pl = created.payload ? JSON.parse(created.payload) : null;
      alertSeller(`New chat message from ${conv.name || conv.email || "a visitor"}`, `${body.slice(0, 300)}${pl ? ` (about ${pl.name}, ${usd(pl.price)})` : ""}\nReply-to: ${conv.email || "—"}`, `/admin/chat?c=${conv.id}`);
      await db.message.create({ data: { conversationId: conv.id, sender: "system", body: "Our team is offline right now — we’ve been notified and will reply here and by email shortly." } });
    }
  }
  return NextResponse.json({ message: serializeMessage(created) });
}
