import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CHAT_COOKIE } from "@/lib/chat-checkout";

/** Signed-in customers can continue any of their own conversations on this device. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const p = z.object({ conversationId: z.string().min(1).max(60) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const conv = await db.conversation.findUnique({ where: { id: p.data.conversationId } });
  if (!conv || conv.userId !== s.uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  (await cookies()).set(CHAT_COOKIE, conv.visitorToken, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production" && !/^http:\/\/localhost/.test(process.env.NEXT_PUBLIC_SITE_URL || ""),
  });
  return NextResponse.json({ ok: true });
}
