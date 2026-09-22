import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import ProfileClient from "./ProfileClient";

export const dynamic = "force-dynamic";

export default async function AccountProfile() {
  const s = await getSession();
  if (!s) redirect("/login?next=/account/profile");
  const u = await db.user.findUnique({ where: { id: s.uid }, select: { name: true, email: true, emailVerified: true } });
  if (!u) redirect("/login");
  return <ProfileClient name={u.name} email={u.email} verified={!!u.emailVerified} />;
}
