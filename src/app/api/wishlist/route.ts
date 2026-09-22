import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function ids(userId: string) {
  return (await db.wishlistItem.findMany({ where: { userId }, select: { productId: true } })).map((w) => w.productId);
}

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ ids: [] });
  return NextResponse.json({ ids: await ids(s.uid) });
}

/** Merge a guest (localStorage) wishlist into the account. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const body = z.object({ merge: z.array(z.string().max(40)).max(200) }).safeParse(await req.json().catch(() => null));
  if (body.success) {
    const existing = await db.product.findMany({ where: { id: { in: body.data.merge } }, select: { id: true } });
    for (const p of existing)
      await db.wishlistItem.upsert({ where: { userId_productId: { userId: s.uid, productId: p.id } }, update: {}, create: { userId: s.uid, productId: p.id } });
  }
  return NextResponse.json({ ids: await ids(s.uid) });
}

export async function PUT(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { productId } = await req.json().catch(() => ({}));
  if (typeof productId !== "string" || !(await db.product.findUnique({ where: { id: productId } })))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  await db.wishlistItem.upsert({ where: { userId_productId: { userId: s.uid, productId } }, update: {}, create: { userId: s.uid, productId } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { productId } = await req.json().catch(() => ({}));
  if (typeof productId === "string") await db.wishlistItem.deleteMany({ where: { userId: s.uid, productId } });
  return NextResponse.json({ ok: true });
}
