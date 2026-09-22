import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const item = z.object({ id: z.string().max(40), name: z.string().trim().min(1).max(80), description: z.string().max(400), price: z.number().int().min(0).max(100000), active: z.boolean(), sortOrder: z.number().int().min(0).max(999).optional() });
const schema = z.union([
  z.object({ items: z.array(item).max(50) }),
  z.object({ create: z.object({ kind: z.enum(["type", "coating"]), name: z.string().trim().min(1).max(80), description: z.string().max(400).default(""), price: z.number().int().min(0).max(100000) }) }),
  z.object({ remove: z.string().max(40) }),
]);

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Invalid data" }, { status: 400 });
  const d = p.data;
  if ("items" in d) {
    for (const it of d.items) {
      const cur = await db.lensOption.findUnique({ where: { id: it.id } });
      if (!cur) continue;
      // "Frame only" must always exist and stay free
      await db.lensOption.update({
        where: { id: it.id },
        data: { name: it.name, description: it.description, price: cur.code === "none" ? 0 : it.price, active: cur.code === "none" ? true : it.active, ...(it.sortOrder !== undefined ? { sortOrder: it.sortOrder } : {}) },
      });
    }
  } else if ("create" in d) {
    const max = await db.lensOption.aggregate({ _max: { sortOrder: true } });
    await db.lensOption.create({ data: { ...d.create, code: `c${randomBytes(4).toString("hex")}`, sortOrder: (max._max.sortOrder || 0) + 1 } });
  } else {
    const cur = await db.lensOption.findUnique({ where: { id: d.remove } });
    if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (cur.code === "none") return NextResponse.json({ error: "“Frame only” can’t be deleted." }, { status: 400 });
    await db.lensOption.delete({ where: { id: d.remove } });
  }
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
