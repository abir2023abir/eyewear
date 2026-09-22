import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkPassword, createSession, hashPassword, requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({ current: z.string().min(1).max(200), next: z.string().min(10, "New password must be at least 10 characters").max(200) });

export async function POST(req: Request) {
  let s;
  try {
    s = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await rateLimit("pw-change", 10, 15 * 60_000))) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message }, { status: 400 });
  const user = await db.user.findUnique({ where: { id: s.uid } });
  if (!user || !(await checkPassword(p.data.current, user.passwordHash))) return NextResponse.json({ error: "Current password is wrong." }, { status: 400 });
  const updated = await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(p.data.next), tokenVersion: { increment: 1 } } });
  await createSession(updated); // keep this device signed in; all others are signed out
  return NextResponse.json({ ok: true });
}
