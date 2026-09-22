import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const schema = z.object({
  id: z.string().max(40).optional(),
  slug: z.string().max(100).default(""),
  title: z.string().trim().min(1).max(160),
  excerpt: z.string().trim().max(300).default(""),
  body: z.string().max(50000).default(""),
  published: z.boolean().default(true),
});

async function guard() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  const { id, ...d } = p.data;
  const slug = (d.slug || d.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const clash = await db.post.findFirst({ where: { slug, NOT: id ? { id } : undefined } });
  if (clash) return NextResponse.json({ error: "Another post uses this slug" }, { status: 409 });
  if (id) await db.post.update({ where: { id }, data: { ...d, slug } });
  else await db.post.create({ data: { ...d, slug } });
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  await db.post.deleteMany({ where: { id: String(id) } });
  revalidatePath("/blog");
  return NextResponse.json({ ok: true });
}
