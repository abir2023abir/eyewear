import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { consumeToken, linkGuestOrders } from "@/lib/auth-tokens";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({ token: z.string().max(100), password: z.string().min(8, "Password must be at least 8 characters").max(200) });

export async function POST(req: Request) {
  if (!(await rateLimit("reset", 10, 60 * 60_000))) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Invalid" }, { status: 400 });
  const user = await consumeToken(p.data.token, "reset");
  if (!user) return NextResponse.json({ error: "This link has expired or was already used. Request a new one." }, { status: 400 });
  const updated = await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(p.data.password), tokenVersion: { increment: 1 }, emailVerified: user.emailVerified ?? new Date() },
  });
  await linkGuestOrders(updated); // the reset email proved they own this address
  await createSession(updated);
  return NextResponse.json({ ok: true, role: updated.role });
}
