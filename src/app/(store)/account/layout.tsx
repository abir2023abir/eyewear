import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import AccountNav, { VerifyBanner } from "./AccountNav";

export const metadata: Metadata = { title: "My account", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s) redirect("/login?next=/account");
  const [user, pending] = await Promise.all([
    db.user.findUnique({ where: { id: s.uid }, select: { name: true, email: true, emailVerified: true, createdAt: true } }),
    db.order.count({ where: { userId: s.uid, paymentStatus: "unpaid", status: { not: "cancelled" } } }),
  ]);
  if (!user) redirect("/login?next=/account");
  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="eyebrow">My account</div>
          <h1 className="h-section mt-1">Hi, {user.name.split(" ")[0]}</h1>
          <p className="muted text-sm">{user.email} · member since {user.createdAt.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        </div>
      </div>
      {!user.emailVerified && <VerifyBanner email={user.email} />}
      <div className="grid lg:grid-cols-[240px_1fr] gap-8 items-start">
        <AccountNav pending={pending} isAdmin={s.role === "admin"} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
