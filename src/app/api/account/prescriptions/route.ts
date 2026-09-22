import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { rxSchema } from "@/lib/pricing";

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ items: [] });
  const items = await db.prescription.findMany({ where: { userId: s.uid }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    items: items.map(({ userId: _u, createdAt: _c, ...rest }) => rest),
  });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const p = rxSchema.extend({ id: z.string().max(40).optional(), label: z.string().trim().min(1).max(60), uploadId: z.string().max(40).nullable().optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid prescription" }, { status: 400 });
  const { id, uploadId, ...data } = p.data;
  if (uploadId) {
    const up = await db.upload.findFirst({ where: { id: uploadId, kind: "prescription", OR: [{ userId: s.uid }, { userId: null }] } });
    if (!up) return NextResponse.json({ error: "Upload not found" }, { status: 400 });
    if (!up.userId) await db.upload.update({ where: { id: up.id }, data: { userId: s.uid } });
  }
  const clean = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ""])) as Record<string, string>;
  if (id) {
    const own = await db.prescription.findFirst({ where: { id, userId: s.uid } });
    if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.prescription.update({ where: { id }, data: { ...clean, uploadId: uploadId ?? own.uploadId } });
  } else {
    await db.prescription.create({ data: { ...clean, label: data.label, uploadId: uploadId ?? null, userId: s.uid } });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  await db.prescription.deleteMany({ where: { id: String(id), userId: s.uid } });
  return NextResponse.json({ ok: true });
}
