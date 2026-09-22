import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!(await rateLimit("newsletter", 5, 60 * 60_000))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const p = z.object({ email: z.string().trim().email().max(200) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  const email = p.data.email.toLowerCase();
  await db.subscriber.upsert({ where: { email }, update: {}, create: { email } });
  return NextResponse.json({ ok: true });
}
