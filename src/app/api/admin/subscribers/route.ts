import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

async function guard() {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  if (!(await guard())) return new Response("Unauthorized", { status: 401 });
  const subs = await db.subscriber.findMany({ orderBy: { createdAt: "desc" } });
  // prefix cells that could be read as spreadsheet formulas
  const cell = (s: string) => `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;
  const csv = ["email,subscribed_at", ...subs.map((s) => `${cell(s.email)},${s.createdAt.toISOString()}`)].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="subscribers.csv"' } });
}

const schema = z.union([z.object({ add: z.string().trim().email().max(200) }), z.object({ remove: z.string().max(40) })]);

export async function POST(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  if ("add" in p.data) {
    const email = p.data.add.toLowerCase();
    await db.subscriber.upsert({ where: { email }, update: {}, create: { email } });
  } else {
    await db.subscriber.deleteMany({ where: { id: p.data.remove } });
  }
  return NextResponse.json({ ok: true });
}
