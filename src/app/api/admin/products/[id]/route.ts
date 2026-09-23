import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("stock"), variantId: z.string().max(40), stock: z.number().int().min(0).max(100000) }),
  z.object({ action: z.literal("duplicate") }),
  z.object({ action: z.literal("delete"), confirm: z.literal("DELETE") }),
  // studio photos created in the admin for a colour that has no photos yet
  z.object({ action: z.literal("images"), variantId: z.string().max(40), images: z.array(z.string().regex(/^\/api\/files\/[a-z0-9]+$/)).min(1).max(12) }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Invalid" }, { status: 400 });
  const product = await db.product.findUnique({ where: { id }, include: { variants: { orderBy: { sortOrder: "asc" } } } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = p.data;

  if (a.action === "images") {
    const v = product.variants.find((x) => x.id === a.variantId);
    if (!v) return NextResponse.json({ error: "Colour not found" }, { status: 404 });
    await db.variant.update({ where: { id: v.id }, data: { images: JSON.stringify(a.images) } });
    revalidatePath("/");
    revalidatePath("/shop");
    revalidatePath(`/product/${product.slug}`);
    return NextResponse.json({ ok: true });
  }

  if (a.action === "stock") {
    const v = product.variants.find((x) => x.id === a.variantId);
    if (!v) return NextResponse.json({ error: "Colour not found" }, { status: 404 });
    await db.variant.update({ where: { id: v.id }, data: { stock: a.stock } });
    revalidatePath(`/product/${product.slug}`);
    return NextResponse.json({ ok: true });
  }

  if (a.action === "duplicate") {
    let n = 2;
    while (await db.product.findUnique({ where: { slug: `${product.slug}-copy${n > 2 ? n : ""}` } })) n++;
    const suffix = n > 2 ? n : "";
    const { id: _i, createdAt: _c, updatedAt: _u, variants, ...rest } = product;
    const copy = await db.product.create({
      data: {
        ...rest,
        slug: `${product.slug}-copy${suffix}`,
        name: `${product.name} (copy)`,
        active: false,
        isFeatured: false,
        variants: {
          create: variants.map(({ id: _v, productId: _p, sku, ...v }) => ({ ...v, sku: `${sku}-C${suffix || 1}-${Date.now().toString(36).slice(-4).toUpperCase()}`, stock: 0 })),
        },
      },
    });
    return NextResponse.json({ id: copy.id, message: "Copy created (hidden until you publish it)." });
  }

  // delete — order history keeps names/SKUs, so it’s safe to remove the product itself
  await db.product.delete({ where: { id } });
  revalidatePath("/");
  return NextResponse.json({ deleted: true });
}
