import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("role"), role: z.enum(["customer", "admin"]) }),
  z.object({ action: z.literal("password"), password: z.string().min(10, "Password must be at least 10 characters").max(200) }),
  z.object({ action: z.literal("signout") }),
  z.object({ action: z.literal("rename"), name: z.string().trim().min(1).max(100) }),
  z.object({ action: z.literal("delete"), confirm: z.literal("DELETE") }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let me;
  try {
    me = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: p.error.issues[0]?.message || "Invalid" }, { status: 400 });
  const user = await db.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const a = p.data;
  const self = user.id === me.uid;
  const adminCount = await db.user.count({ where: { role: "admin" } });

  switch (a.action) {
    case "role":
      if (self && a.role !== "admin") return NextResponse.json({ error: "You can’t remove your own admin access." }, { status: 400 });
      if (user.role === "admin" && a.role !== "admin" && adminCount <= 1) return NextResponse.json({ error: "There must be at least one admin." }, { status: 400 });
      await db.user.update({ where: { id }, data: { role: a.role, tokenVersion: { increment: 1 } } });
      return NextResponse.json({ message: a.role === "admin" ? "Now an admin (they need to sign in again)." : "Admin access removed." });
    case "password":
      await db.user.update({ where: { id }, data: { passwordHash: await hashPassword(a.password), tokenVersion: { increment: 1 } } });
      return NextResponse.json({ message: self ? "Password changed — please sign in again." : "Password changed and signed out everywhere." });
    case "signout":
      await db.user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } });
      return NextResponse.json({ message: "Signed out on all devices." });
    case "rename":
      await db.user.update({ where: { id }, data: { name: a.name } });
      return NextResponse.json({ message: "Saved." });
    case "delete":
      if (self) return NextResponse.json({ error: "You can’t delete your own account." }, { status: 400 });
      if (user.role === "admin" && adminCount <= 1) return NextResponse.json({ error: "There must be at least one admin." }, { status: 400 });
      await db.order.updateMany({ where: { userId: id }, data: { userId: null } }); // keep order history
      await db.user.delete({ where: { id } });
      return NextResponse.json({ message: "Account deleted (orders kept).", deleted: true });
  }
}
