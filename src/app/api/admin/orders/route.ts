import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { priceCart, rxSchema } from "@/lib/pricing";
import { quoteShipping } from "@/lib/shipping";
import { COUNTRIES } from "@/lib/countries";
import { getSettings } from "@/lib/settings";
import { bundleOffFor } from "@/lib/settings-shared";
import { markOrderPaid, newOrderNumber, newToken, orderTotal } from "@/lib/orders";
import { emailPaymentRequest } from "@/lib/emails";

const schema = z.object({
  preview: z.boolean().optional(),
  customer: z.object({
    email: z.string().trim().email().max(200),
    name: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(3).max(30),
    line1: z.string().trim().min(1).max(120),
    line2: z.string().trim().max(120).default(""),
    city: z.string().trim().min(1).max(80),
    state: z.string().trim().max(80).default(""),
    postcode: z.string().trim().max(20).default(""),
    country: z.string().length(2).refine((c) => COUNTRIES.some(([k]) => k === c), "Choose a country"),
  }),
  items: z
    .array(
      z.object({
        variantId: z.string().max(40),
        qty: z.number().int().min(1).max(500),
        lensCode: z.string().max(20).default("none"),
        unitPrice: z.number().int().min(0).max(10_000_000).nullable().optional(), // override (cents)
        rx: rxSchema.optional(),
      }),
    )
    .min(1, "Add at least one frame")
    .max(50),
  applyBundle: z.boolean().default(true),
  shipping: z.number().int().min(0).max(10_000_000).nullable(), // null = live DHL / manual rates
  adjustment: z.number().int().min(-10_000_000).max(10_000_000).default(0),
  paymentMethod: z.enum(["paypal", "xtransfer", "cash", "other"]),
  markPaid: z.boolean().default(false),
  sendPaymentLink: z.boolean().default(false),
  note: z.string().max(1000).default(""),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: `${p.error.issues[0]?.path.join(" › ")}: ${p.error.issues[0]?.message}` }, { status: 400 });
  const d = p.data;

  const priced = await priceCart(d.items.map((i) => ({ variantId: i.variantId, qty: i.qty, lensCode: i.lensCode, coatings: [], rxMode: i.rx ? "form" : "none", rx: i.rx })));
  if (priced.lines.length !== d.items.length) return NextResponse.json({ error: "A selected frame is unavailable or archived." }, { status: 400 });
  const lines = priced.lines.map((l, i) => ({ ...l, unitPrice: d.items[i].unitPrice ?? l.unitPrice }));
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.input.qty, 0);
  const { pricing } = await getSettings();
  const bundleDiscount = d.applyBundle ? Math.round(subtotal * bundleOffFor(pricing.bundleTiers, priced.frames)) : 0;
  const lensTotal = priced.lensTotal;

  const q = await quoteShipping(d.customer.country, priced.frames, subtotal - bundleDiscount + lensTotal, lensTotal > 0);
  const shipping = d.shipping ?? q.price;
  const shippingName = q.name;
  const total = orderTotal({ subtotal, bundleDiscount, lensTotal, shipping, adjustment: d.adjustment });
  if (total < 0) return NextResponse.json({ error: "The discount is larger than the order total." }, { status: 400 });
  const stockIssues = lines.filter((l) => l.stock < l.input.qty).map((l) => `${l.name} ${l.colorName} (stock ${l.stock})`);

  if (d.preview) return NextResponse.json({ subtotal, bundleDiscount, lensTotal, shipping, adjustment: d.adjustment, total, stockIssues });

  let number = newOrderNumber();
  while (await db.order.findUnique({ where: { number } })) number = newOrderNumber();
  const user = await db.user.findUnique({ where: { email: d.customer.email.toLowerCase() }, select: { id: true } });
  const order = await db.order.create({
    data: {
      number,
      accessToken: newToken(),
      userId: user?.id ?? null,
      ...d.customer,
      email: d.customer.email.toLowerCase(),
      subtotal,
      bundleDiscount,
      lensTotal,
      shipping,
      adjustment: d.adjustment,
      total,
      paymentMethod: d.paymentMethod,
      dhlServiceName: shippingName,
      deliveryDaysMin: q.daysMin,
      deliveryDaysMax: q.daysMax,
      source: "manual",
      notes: `[${new Date().toISOString().slice(0, 16).replace("T", " ")} ${admin.email}] Manual order created${d.note ? `: ${d.note}` : ""}`,
      items: {
        create: lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          name: l.name,
          colorName: l.colorName,
          sku: l.sku,
          qty: l.input.qty,
          unitPrice: Math.round(l.unitPrice * (1 - (subtotal ? bundleDiscount / subtotal : 0))),
          lensName: l.lensName,
          lensPrice: l.lensPrice,
          prescription: l.lensName === "Frame only" ? "" : JSON.stringify({ mode: l.input.rx ? "form" : "later", ...(l.input.rx || {}) }),
        })),
      },
    },
    include: { items: true },
  });
  if (d.markPaid) await markOrderPaid(order.id);
  else if (d.sendPaymentLink) await emailPaymentRequest(order);
  return NextResponse.json({ id: order.id, number: order.number });
}
