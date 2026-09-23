import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { FACE_SHAPES, SHAPES } from "@/lib/frame-geometry";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const fileUrl = z.string().regex(/^\/api\/files\/[a-z0-9]+$/);

const schema = z.object({
  id: z.string().max(40).optional(),
  slug: z.string().max(80).default(""),
  name: z.string().trim().min(1).max(80),
  modelCode: z.string().trim().min(1).max(30),
  category: z.enum(["optical", "sunglasses"]),
  shape: z.enum(SHAPES as [string, ...string[]]),
  material: z.enum(["TR90", "Acetate", "Metal", "Titanium"]),
  gender: z.enum(["unisex", "men", "women", "kids"]),
  faceShapes: z.array(z.enum(FACE_SHAPES)).max(6),
  price: z.number().int().min(0).max(1_000_000),
  compareAt: z.number().int().min(0).max(1_000_000).nullable(),
  description: z.string().max(4000).default(""),
  lensWidth: z.number().int().min(30).max(80),
  lensHeight: z.number().int().min(20).max(70),
  bridge: z.number().int().min(10).max(30),
  templeLength: z.number().int().min(100).max(170),
  frameWidth: z.number().int().min(90).max(170),
  weightGrams: z.number().int().min(1).max(200),
  modelUrl: fileUrl.nullable().default(null),
  modelTint: z.boolean().default(true),
  isNew: z.boolean(),
  isBestseller: z.boolean(),
  isFeatured: z.boolean(),
  active: z.boolean(),
  variants: z
    .array(
      z.object({
        id: z.string().max(40).optional(),
        colorName: z.string().trim().min(1).max(40),
        colorHex: hex,
        accentHex: hex.nullable(),
        finish: z.enum(["solid", "twotone", "gradient"]).default("solid"),
        sku: z.string().trim().max(40).default(""),
        stock: z.number().int().min(0).max(100000),
        images: z.array(fileUrl).max(12),
        modelUrl: fileUrl.nullable(),
        tryOnImage: fileUrl.nullable().default(null),
      }),
    )
    .min(1)
    .max(30),
});

const FIELD: Record<string, string> = {
  name: "Frame name", modelCode: "Model code", price: "Price", compareAt: "Old price", lensWidth: "Lens width", lensHeight: "Lens height",
  bridge: "Bridge", templeLength: "Temple length", frameWidth: "Total width", weightGrams: "Weight", colorName: "Colour name", stock: "Stock", slug: "URL slug",
};
const RANGE: Record<string, string> = { lensWidth: "30–80", lensHeight: "20–70", bridge: "10–30", templeLength: "100–170", frameWidth: "90–170", weightGrams: "1–200" };
function friendly(i?: z.ZodIssue) {
  if (!i) return "Please check the form.";
  const key = String(i.path[i.path.length - 1] ?? "");
  const colour = i.path[0] === "variants" && typeof i.path[1] === "number" ? `Colour ${i.path[1] + 1}: ` : "";
  const label = FIELD[key] || key;
  if (RANGE[key]) return `${colour}${label} must be between ${RANGE[key]} mm.`;
  if (i.code === "too_small") return `${colour}${label} is required.`;
  return `${colour}${label}: ${i.message}`;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: friendly(p.error.issues[0]) }, { status: 400 });
  const { id, variants, faceShapes, ...d } = p.data;
  const slug = slugify(d.slug || `${d.name}-${d.modelCode}`);
  const clash = await db.product.findFirst({ where: { slug, NOT: id ? { id } : undefined } });
  if (clash) return NextResponse.json({ error: "Another frame already uses this URL slug." }, { status: 409 });

  const data = { ...d, slug, faceShapes: faceShapes.join(",") };

  // work out every SKU and check them all BEFORE changing anything, so a clash can never
  // leave a frame half-saved (for example with its old colours deleted and no new ones)
  const skus = variants.map((v) => (v.sku || `${d.modelCode}-${v.colorName}`).toUpperCase().replace(/[^A-Z0-9-]+/g, ""));
  const dup = skus.find((x, i) => skus.indexOf(x) !== i);
  if (dup) return NextResponse.json({ error: `Two colours would share the SKU ${dup}. Give each colour a different name or SKU.` }, { status: 409 });
  if (skus.some((x) => !x)) return NextResponse.json({ error: "Each colour needs a name or SKU." }, { status: 400 });
  const clashSku = await db.variant.findFirst({ where: { sku: { in: skus }, ...(id ? { NOT: { productId: id } } : {}) }, select: { sku: true } });
  if (clashSku) return NextResponse.json({ error: `SKU ${clashSku.sku} is already used by another frame.` }, { status: 409 });

  // the frame and all its colours are saved together: either everything is saved, or nothing is
  const { product, variantIds } = await db.$transaction(async (tx) => {
    const product = id ? await tx.product.update({ where: { id }, data }) : await tx.product.create({ data });
    const existing = await tx.variant.findMany({ where: { productId: product.id }, select: { id: true } });
    const keep = new Set(variants.map((v) => v.id).filter(Boolean));
    const removed = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
    if (removed.length) await tx.variant.deleteMany({ where: { id: { in: removed } } });
    const variantIds: string[] = [];
    for (const [i, v] of variants.entries()) {
      const vd = { colorName: v.colorName, colorHex: v.colorHex, accentHex: v.accentHex, finish: v.accentHex ? v.finish : "solid", sku: skus[i], stock: v.stock, images: JSON.stringify(v.images), modelUrl: v.modelUrl, tryOnImage: v.tryOnImage, sortOrder: i };
      if (v.id && existing.some((e) => e.id === v.id)) variantIds.push((await tx.variant.update({ where: { id: v.id }, data: vd })).id);
      else variantIds.push((await tx.variant.create({ data: { ...vd, productId: product.id } })).id);
    }
    return { product, variantIds };
  }, { timeout: 20_000 });
  revalidatePath("/");
  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/shop");
  return NextResponse.json({ id: product.id, slug: product.slug, variantIds });
}
