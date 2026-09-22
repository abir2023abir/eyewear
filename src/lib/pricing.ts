import "server-only";
import { z } from "zod";
import { db } from "./db";
import { getSettings } from "./settings";
import { bundleOffFor } from "./settings-shared";

export const rxSchema = z
  .object({
    odSph: z.string().max(8).default(""), odCyl: z.string().max(8).default(""), odAxis: z.string().max(4).default(""),
    osSph: z.string().max(8).default(""), osCyl: z.string().max(8).default(""), osAxis: z.string().max(4).default(""),
    add: z.string().max(8).default(""), pd: z.string().max(6).default(""), pdRight: z.string().max(6).default(""), pdLeft: z.string().max(6).default(""),
  })
  .partial();

export const cartItemSchema = z.object({
  variantId: z.string().min(1).max(40),
  qty: z.number().int().min(1).max(20),
  lensCode: z.string().max(20).default("none"),
  coatings: z.array(z.string().max(20)).max(5).default([]),
  rxMode: z.enum(["none", "form", "upload", "later"]).default("none"),
  rx: rxSchema.optional(),
  rxUploadId: z.string().max(40).optional(),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

export type PricedLine = {
  input: CartItemInput;
  productId: string;
  variantId: string;
  name: string;
  colorName: string;
  sku: string;
  slug: string;
  unitPrice: number;
  lensName: string;
  lensPrice: number; // per frame, incl. coatings
  coatingNames: string[];
  stock: number;
};

/** Authoritative server-side pricing. Never trust totals sent from the browser. */
export async function priceCart(items: CartItemInput[]) {
  const variants = await db.variant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include: { product: true },
  });
  const lenses = await db.lensOption.findMany({ where: { active: true } });
  const lines: PricedLine[] = [];
  for (const it of items) {
    const v = variants.find((x) => x.id === it.variantId);
    if (!v || !v.product.active) continue;
    const lens = lenses.find((l) => l.kind === "type" && l.code === it.lensCode) ?? lenses.find((l) => l.code === "none");
    const coats = lenses.filter((l) => l.kind === "coating" && it.coatings.includes(l.code));
    lines.push({
      input: it,
      productId: v.productId,
      variantId: v.id,
      name: `${v.product.name} ${v.product.modelCode}`,
      colorName: v.colorName,
      sku: v.sku,
      slug: v.product.slug,
      unitPrice: v.product.price,
      lensName: lens?.name ?? "Frame only",
      lensPrice: (lens?.price ?? 0) + coats.reduce((s, c) => s + c.price, 0),
      coatingNames: coats.map((c) => c.name),
      stock: v.stock,
    });
  }
  const frames = lines.reduce((s, l) => s + l.input.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.input.qty, 0);
  const { pricing } = await getSettings();
  const bundleDiscount = Math.round(subtotal * bundleOffFor(pricing.bundleTiers, frames));
  const lensTotal = lines.reduce((s, l) => s + l.lensPrice * l.input.qty, 0);
  return { lines, frames, subtotal, bundleDiscount, lensTotal, itemsTotal: subtotal - bundleDiscount + lensTotal };
}
