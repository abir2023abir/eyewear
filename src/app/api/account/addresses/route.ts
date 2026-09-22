import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { COUNTRIES } from "@/lib/countries";

const schema = z.object({
  id: z.string().max(40).optional(),
  label: z.string().trim().max(40).default("Home"),
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(30),
  line1: z.string().trim().min(1).max(120),
  line2: z.string().trim().max(120).default(""),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().max(80).default(""),
  postcode: z.string().trim().max(20).default(""),
  country: z.string().length(2).refine((c) => COUNTRIES.some(([k]) => k === c)),
  isDefault: z.boolean().default(false),
});

export async function GET() {
  const s = await getSession();
  if (!s) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: await db.address.findMany({ where: { userId: s.uid }, orderBy: { isDefault: "desc" } }) });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Please complete the address." }, { status: 400 });
  const { id, ...data } = p.data;
  if (data.isDefault) await db.address.updateMany({ where: { userId: s.uid }, data: { isDefault: false } });
  if (id) {
    const own = await db.address.findFirst({ where: { id, userId: s.uid } });
    if (!own) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await db.address.update({ where: { id }, data });
  } else {
    await db.address.create({ data: { ...data, userId: s.uid } });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  await db.address.deleteMany({ where: { id: String(id), userId: s.uid } });
  return NextResponse.json({ ok: true });
}
