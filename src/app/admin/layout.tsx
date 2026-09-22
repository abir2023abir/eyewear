import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import AdminNav, { SignOut } from "./AdminNav";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // getSession() re-checks the account in the database (role + session version) on every request
  const s = await getSession();
  if (!s || s.role !== "admin") redirect("/login?next=/admin");
  const { store } = await getSettings();
  return (
    <div className="admin-shell">
      <aside className="admin-nav flex flex-col">
        <Link href="/admin" className="!px-3 !pb-5 block font-display text-lg text-white font-semibold leading-tight">
          {store.name}
          <span className="block text-[11px] font-sans font-bold tracking-widest text-[#8fb4ff] uppercase mt-1">Super admin</span>
        </Link>
        <AdminNav />
        <div className="mt-auto pt-6 px-3 text-xs text-[#8fb4ff]">
          Signed in as<br /><b className="text-white break-all">{s.email}</b>
          <SignOut />
        </div>
      </aside>
      <div className="p-6 lg:p-8 min-w-0">{children}</div>
    </div>
  );
}
