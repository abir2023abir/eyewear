import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendPasswordReset } from "@/lib/auth-tokens";
import { rateLimit } from "@/lib/ratelimit";

/** Always answers the same way, so it can't be used to find out which emails have accounts. */
export async function POST(req: Request) {
  if (!(await rateLimit("forgot", 5, 60 * 60_000))) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  const p = z.object({ email: z.string().trim().email().max(200) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  const user = await db.user.findUnique({ where: { email: p.data.email.toLowerCase() } });
  if (user) await sendPasswordReset(user);
  return NextResponse.json({ ok: true });
}
