import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { sendVerifyEmail } from "@/lib/auth-tokens";
import { linkChatToUser } from "@/lib/chat-checkout";

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: z.string().trim().email("Enter a valid email").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export async function POST(req: Request) {
  if (!(await rateLimit("register", 5, 60 * 60_000))) return NextResponse.json({ error: "Too many sign-ups from this network. Try later." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid details" }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
  const user = await db.user.create({ data: { email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) } });
  await createSession(user);
  await linkChatToUser(user.id);
  await sendVerifyEmail(user);
  return NextResponse.json({ ok: true });
}
