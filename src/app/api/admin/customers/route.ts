import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";

const create = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(200),
  password: z.string().min(10, "Password must be at least 10 characters").max(200),
  role: z.enum(["customer", "admin"]),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const p = create.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Invalid details" }, { status: 400 });
  const email = p.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  const u = await db.user.create({ data: { name: p.data.name, email, role: p.data.role, passwordHash: await hashPassword(p.data.password) } });
  return NextResponse.json({ id: u.id });
}
