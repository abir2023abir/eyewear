import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { serializeMessage, touchSeller } from "@/lib/chat";
import { cartItemSchema, priceCart } from "@/lib/pricing";
import { quoteShipping } from "@/lib/shipping";
import { COUNTRIES, countryName } from "@/lib/countries";
import { sendMail, layout, esc } from "@/lib/mail";
import { site } from "@/lib/site";
import { getSettings } from "@/lib/settings";

async function guard() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  if (url.searchParams.get("summary")) {
    const agg = await db.conversation.aggregate({ _sum: { unreadForSeller: true } });
    return NextResponse.json({ unread: agg._sum.unreadForSeller || 0 });
  }
  await touchSeller();
  const c = url.searchParams.get("c");
  const conversations = await db.conversation.findMany({
    orderBy: { lastMessageAt: "desc" },
    take: 100,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  let messages: ReturnType<typeof serializeMessage>[] = [];
  if (c) {
    const after = url.searchParams.get("after");
    const afterDate = after ? new Date(after) : null;
    const rows = await db.message.findMany({
      where: { conversationId: c, ...(afterDate && !isNaN(+afterDate) ? { createdAt: { gt: afterDate } } : {}) },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    messages = rows.map(serializeMessage);
    await db.conversation.updateMany({ where: { id: c, unreadForSeller: { gt: 0 } }, data: { unreadForSeller: 0 } });
  }
  return NextResponse.json({
    conversations: conversations.map((cv) => ({
      id: cv.id, name: cv.name, email: cv.email, unread: cv.unreadForSeller, status: cv.status, lastMessageAt: cv.lastMessageAt.toISOString(),
      last: cv.messages[0] ? (cv.messages[0].kind === "text" || cv.messages[0].kind === "system" ? cv.messages[0].body : `[${cv.messages[0].kind}]`) : "",
    })),
    messages,
  });
}

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("presence") }),
  z.object({ action: z.literal("send"), conversationId: z.string().max(40), body: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal("close"), conversationId: z.string().max(40) }),
  z.object({ action: z.literal("delete"), conversationId: z.string().max(40) }),
  z.object({
    action: z.literal("quote"),
    conversationId: z.string().max(40),
    items: z.array(cartItemSchema.pick({ variantId: true, qty: true, lensCode: true })).min(1).max(20),
    country: z.string().length(2).refine((c) => COUNTRIES.some(([k]) => k === c)),
    city: z.string().trim().min(1).max(80),
    shippingOverride: z.number().int().min(0).max(100000).nullable().optional(),
    note: z.string().max(500).default(""),
    preview: z.boolean().optional(),
  }),
]);

export async function POST(req: Request) {
  const admin = await guard();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Invalid" }, { status: 400 });
  const a = p.data;
  await touchSeller();
  if (a.action === "presence") return NextResponse.json({ ok: true });

  const conv = await db.conversation.findUnique({ where: { id: a.conversationId } });
  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  if (a.action === "delete") {
    await db.quote.deleteMany({ where: { conversationId: conv.id, status: "open" } });
    await db.conversation.delete({ where: { id: conv.id } });
    return NextResponse.json({ ok: true });
  }

  if (a.action === "close") {
    await db.conversation.update({ where: { id: conv.id }, data: { status: conv.status === "closed" ? "open" : "closed" } });
    return NextResponse.json({ ok: true });
  }

  if (a.action === "send") {
    const m = await db.message.create({ data: { conversationId: conv.id, sender: "seller", body: a.body } });
    await db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date(), unreadForCustomer: { increment: 1 } } });
    await maybeEmailCustomer(conv, a.body);
    return NextResponse.json({ message: serializeMessage(m) });
  }

  // ----- quote card: products + DHL shipping + total, with a Pay Now link -----
  const items = a.items.map((i) => ({ ...i, coatings: [], rxMode: "later" as const }));
  const priced = await priceCart(items);
  if (priced.lines.length !== items.length) return NextResponse.json({ error: "A product in the quote is unavailable." }, { status: 400 });
  const shipQuote = await quoteShipping(a.country, priced.frames, priced.itemsTotal, priced.lensTotal > 0);
  const shipping: number = a.shippingOverride ?? shipQuote.price;
  const estimate = false;
  const total = priced.itemsTotal + shipping;
  const lines = priced.lines.map((l) => ({ name: l.name, colorName: l.colorName, lensName: l.lensName, qty: l.input.qty, total: (l.unitPrice + l.lensPrice) * l.input.qty }));
  if (a.preview) return NextResponse.json({ lines, bundleDiscount: priced.bundleDiscount, shipping, estimate, total });

  const token = randomBytes(18).toString("hex");
  const quote = await db.quote.create({
    data: { token, conversationId: conv.id, items: JSON.stringify(items), country: a.country, shipping, subtotal: priced.itemsTotal, total },
  });
  const payload = { token: quote.token, lines, bundleDiscount: priced.bundleDiscount, shipping, total, country: a.country, countryName: countryName(a.country), status: "open" };
  const m = await db.message.create({ data: { conversationId: conv.id, sender: "seller", kind: "quote", body: a.note, payload: JSON.stringify(payload) } });
  await db.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date(), unreadForCustomer: { increment: 1 } } });
  await maybeEmailCustomer(conv, `We’ve prepared a quote for you: US$${(total / 100).toFixed(2)} including DHL Express to ${countryName(a.country)}.\nPay securely here: ${site.url}/checkout?quote=${quote.token}`, true);
  return NextResponse.json({ message: serializeMessage(m) });
}

/** Reply by email too (offline customers), throttled to one email per 5 minutes per conversation. */
async function maybeEmailCustomer(conv: { id: string; email: string; name: string }, text: string, force = false) {
  if (!conv.email) return;
  const key = `replyMail:${conv.id}`;
  const last = await db.setting.findUnique({ where: { key } });
  if (!force && last && Date.now() - Number(last.value) < 5 * 60_000) return;
  await db.setting.upsert({ where: { key }, update: { value: String(Date.now()) }, create: { key, value: String(Date.now()) } });
  const { store } = await getSettings();
  await sendMail(
    conv.email,
    `New reply from ${store.name}`,
    await layout(`Hi ${conv.name || "there"}, you have a reply`, `<p style="white-space:pre-wrap;background:#eef4ff;padding:14px;border-radius:10px">${esc(text)}</p><p>Continue the conversation on <a href="${esc(site.url)}">${esc(store.name)}</a> — open the chat bubble at the bottom of any page.</p>`),
  );
}
