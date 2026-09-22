import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, getSession, hashPassword } from "@/lib/auth";
import { sendVerifyEmail } from "@/lib/auth-tokens";
import { cartItemSchema, priceCart, CartItemInput } from "@/lib/pricing";
import { quoteShipping } from "@/lib/shipping";
import { COUNTRIES } from "@/lib/countries";
import { emailOrderPlaced } from "@/lib/emails";
import { alertSeller } from "@/lib/notify";
import { newOrderNumber, newToken, orderTotal } from "@/lib/orders";
import { getOrCreateConversation, startChatCheckout } from "@/lib/chat-checkout";
import { rateLimit } from "@/lib/ratelimit";
import { getRates } from "@/lib/fx";
import { usd } from "@/lib/money";
import { safeJson } from "@/lib/types";

const addr = z.object({
  name: z.string().trim().min(1, "Enter your full name").max(100),
  phone: z.string().trim().min(5, "Enter a phone number DHL can call").max(30),
  line1: z.string().trim().min(1, "Enter your street address").max(120),
  line2: z.string().trim().max(120).default(""),
  city: z.string().trim().min(1, "Enter your city").max(80),
  state: z.string().trim().max(80).default(""),
  postcode: z.string().trim().max(20).default(""),
  country: z.string().length(2).refine((c) => c === "CN" || COUNTRIES.some(([k]) => k === c), "Choose your country"),
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(200),
  address: addr,
  items: z.array(cartItemSchema).max(50),
  quoteToken: z.string().max(80).optional(),
  saveAddress: z.boolean().optional(),
  displayCurrency: z.string().max(3).optional(),
  createAccount: z.object({ password: z.string().min(8, "Account password must be at least 8 characters").max(200) }).optional(),
});

/** Step 1 of checkout: reserve the order. Delivery details and payment are completed in the chat. */
export async function POST(req: Request) {
  if (!(await rateLimit("order", 15, 60 * 60_000))) return NextResponse.json({ error: "Too many orders from this network. Please contact us." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Please check your details." }, { status: 400 });
  const d = parsed.data;
  let session = await getSession();
  let newUser: Awaited<ReturnType<typeof db.user.create>> | null = null;
  if (!session && d.createAccount) {
    const email = d.email.toLowerCase();
    if (await db.user.findUnique({ where: { email } })) return NextResponse.json({ error: "An account with this email already exists — please sign in first, or untick “Create an account”." }, { status: 409 });
    newUser = await db.user.create({ data: { email, name: d.address.name, passwordHash: await hashPassword(d.createAccount.password) } });
    await createSession(newUser);
    session = { uid: newUser.id, role: newUser.role, name: newUser.name, email: newUser.email };
  }

  // ----- items: from a seller quote, or from the cart -----
  let items: CartItemInput[] = d.items;
  let quote: Awaited<ReturnType<typeof db.quote.findUnique>> = null;
  if (d.quoteToken) {
    quote = await db.quote.findUnique({ where: { token: d.quoteToken } });
    if (!quote || quote.status !== "open") return NextResponse.json({ error: "This quote has expired or was already paid." }, { status: 400 });
    if (quote.country !== d.address.country) return NextResponse.json({ error: "This quote is for a different country. Ask the seller for a new quote." }, { status: 400 });
    items = safeJson<CartItemInput[]>(quote.items, []).map((i) => cartItemSchema.parse(i));
  }
  if (!items.length) return NextResponse.json({ error: "Your bag is empty." }, { status: 400 });

  const priced = await priceCart(items);
  if (priced.lines.length !== items.length) return NextResponse.json({ error: "Some items are no longer available. Please review your bag." }, { status: 400 });
  for (const l of priced.lines) {
    const needed = priced.lines.filter((x) => x.variantId === l.variantId).reduce((s, x) => s + x.input.qty, 0);
    if (l.stock < needed) return NextResponse.json({ error: `${l.name} (${l.colorName}) has only ${l.stock} left in stock.` }, { status: 400 });
  }
  const uploadIds = items.map((i) => i.rxUploadId).filter(Boolean) as string[];
  if (uploadIds.length) {
    const ups = await db.upload.findMany({ where: { id: { in: uploadIds }, kind: "prescription" }, select: { id: true } });
    if (ups.length !== new Set(uploadIds).size) return NextResponse.json({ error: "Please re-upload your prescription photo." }, { status: 400 });
  }

  // ----- shipping: price + delivery days set by the store owner -----
  const ship = await quoteShipping(d.address.country, priced.frames, priced.itemsTotal, priced.lensTotal > 0);
  const shipping = quote ? quote.shipping : ship.price;
  const total = orderTotal({ subtotal: priced.subtotal, bundleDiscount: priced.bundleDiscount, lensTotal: priced.lensTotal, shipping, adjustment: 0 });
  const fx = await getRates();
  const cur = d.displayCurrency && fx[d.displayCurrency] ? d.displayCurrency : "USD";

  const conv = await getOrCreateConversation({ name: d.address.name, email: d.email.toLowerCase(), userId: session?.uid });

  let number = newOrderNumber();
  while (await db.order.findUnique({ where: { number } })) number = newOrderNumber();

  const order = await db.order.create({
    data: {
      number,
      accessToken: newToken(),
      userId: session?.uid ?? null,
      email: d.email.toLowerCase(),
      ...d.address,
      subtotal: priced.subtotal,
      bundleDiscount: priced.bundleDiscount,
      lensTotal: priced.lensTotal,
      shipping,
      total,
      displayCurrency: cur,
      fxRate: fx[cur] || 1,
      paymentMethod: "pending",
      dhlServiceName: ship.name,
      deliveryDaysMin: ship.daysMin,
      deliveryDaysMax: ship.daysMax,
      quoteId: quote?.id ?? null,
      source: quote ? "quote" : "web",
      conversationId: conv.id,
      items: {
        create: priced.lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          name: l.name,
          colorName: l.colorName,
          sku: l.sku,
          qty: l.input.qty,
          unitPrice: Math.round(l.unitPrice * (1 - (priced.subtotal ? priced.bundleDiscount / priced.subtotal : 0))),
          lensName: l.lensName,
          lensPrice: l.lensPrice,
          coatings: l.coatingNames.join(", "),
          prescription: l.lensName === "Frame only" && !l.coatingNames.length ? "" : JSON.stringify({ mode: l.input.rxMode, ...(l.input.rxMode === "form" ? l.input.rx : {}) }),
          prescriptionFileId: l.input.rxMode === "upload" ? l.input.rxUploadId : null,
        })),
      },
    },
    include: { items: true },
  });

  if (session && d.saveAddress) {
    const exists = await db.address.findFirst({ where: { userId: session.uid, line1: d.address.line1, city: d.address.city, country: d.address.country } });
    if (!exists) {
      const count = await db.address.count({ where: { userId: session.uid } });
      await db.address.create({ data: { userId: session.uid, label: count ? `Address ${count + 1}` : "Home", isDefault: count === 0, ...d.address } });
    }
  }

  if (newUser) {
    await db.address.create({ data: { userId: newUser.id, label: "Home", isDefault: true, ...d.address } });
    await sendVerifyEmail(newUser);
  }
  await startChatCheckout(order);
  await emailOrderPlaced(order);
  await alertSeller(`New order ${order.number} — ${usd(order.total)}`, `${order.name} (${order.country}) · ${priced.frames} frame(s) · completing payment in chat`, `/admin/orders/${order.id}`);
  return NextResponse.json({ number: order.number, token: order.accessToken });
}
