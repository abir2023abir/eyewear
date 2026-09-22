import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { consumeToken, linkGuestOrders, sendVerifyEmail } from "@/lib/auth-tokens";
import { rateLimit } from "@/lib/ratelimit";

/** POST {token}: confirm email. POST {resend:true}: send a new link to the signed-in customer. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body?.resend) {
    if (!(await rateLimit("verify-resend", 5, 60 * 60_000))) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
    const s = await getSession();
    if (!s) return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    const user = await db.user.findUnique({ where: { id: s.uid } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.emailVerified) return NextResponse.json({ ok: true, already: true });
    const sent = await sendVerifyEmail(user);
    return NextResponse.json({ ok: true, sent });
  }
  const user = typeof body?.token === "string" ? await consumeToken(body.token, "verify") : null;
  if (!user) return NextResponse.json({ error: "This link has expired or was already used." }, { status: 400 });
  await db.user.update({ where: { id: user.id }, data: { emailVerified: user.emailVerified ?? new Date() } });
  const linked = await linkGuestOrders(user);
  return NextResponse.json({ ok: true, linked });
}
