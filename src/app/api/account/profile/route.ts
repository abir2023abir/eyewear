import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkPassword, createSession, getSession, hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("name"), name: z.string().trim().min(1, "Enter your name").max(100) }),
  z.object({ action: z.literal("password"), current: z.string().min(1).max(200), next: z.string().min(8, "New password must be at least 8 characters").max(200) }),
  z.object({ action: z.literal("signout_all") }),
]);

/** Customer "Profile & security": change name, change password, sign out on all devices. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Invalid" }, { status: 400 });
  const a = p.data;
  const user = await db.user.findUnique({ where: { id: s.uid } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (a.action === "name") {
    const u = await db.user.update({ where: { id: user.id }, data: { name: a.name } });
    await createSession(u); // refresh the name stored in the session
    return NextResponse.json({ ok: true, message: "Name saved." });
  }
  if (a.action === "password") {
    if (!(await rateLimit("pw-customer", 10, 15 * 60_000))) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    if (!(await checkPassword(a.current, user.passwordHash))) return NextResponse.json({ error: "Your current password is wrong." }, { status: 400 });
    const u = await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(a.next), tokenVersion: { increment: 1 } } });
    await createSession(u); // stay signed in here; other devices are signed out
    return NextResponse.json({ ok: true, message: "Password changed. Other devices were signed out." });
  }
  const u = await db.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
  await createSession(u);
  return NextResponse.json({ ok: true, message: "Signed out on all other devices." });
}
