import { NextResponse } from "next/server";
import { authSecretProblem } from "@/lib/auth-secret";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkPassword, createSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import { linkChatToUser } from "@/lib/chat-checkout";

const schema = z.object({ email: z.string().email().max(200), password: z.string().min(1).max(200) });
// bcrypt hash of a random string, used so response time doesn't reveal whether an email exists
const DUMMY_HASH = "$2a$11$C6UzMDM.H6dfI/f/IKcEeO5x3u9hJ8KxI9t3ZrZ0p1r7d4oYqg7xS";

export async function POST(req: Request) {
  const secretProblem = authSecretProblem();
  if (secretProblem) return NextResponse.json({ error: "Sign-in is switched off until the store owner sets AUTH_SECRET on the server." }, { status: 503 });
  if (!(await rateLimit("login", 10, 15 * 60_000))) return NextResponse.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  const user = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  const ok = await checkPassword(parsed.data.password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  await createSession(user);
  await linkChatToUser(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
