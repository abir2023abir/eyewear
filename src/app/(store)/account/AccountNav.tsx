"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "@/components/Icon";
import { useStore } from "@/components/Providers";

const LINKS: [string, string, string][] = [
  ["/account", "Overview", "grid"],
  ["/account/orders", "My orders", "box"],
  ["/account/addresses", "Addresses & prescriptions", "truck"],
  ["/account/wishlist", "Wishlist", "heart"],
  ["/account/messages", "Messages", "chat"],
  ["/account/profile", "Profile & security", "lock"],
];

export default function AccountNav({ pending, isAdmin }: { pending: number; isAdmin: boolean }) {
  const path = usePathname();
  const router = useRouter();
  const { refreshMe, wishlist } = useStore();
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    await refreshMe();
    router.push("/");
    router.refresh();
  };
  return (
    <nav className="card p-2 flex lg:grid gap-0.5 overflow-x-auto lg:overflow-visible lg:sticky lg:top-24" aria-label="Account">
      {LINKS.map(([href, label, icon]) => {
        const on = href === "/account" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 ${on ? "bg-[var(--sky)] text-[var(--blue)]" : "hover:bg-[var(--sky-2)]"}`}>
            <Icon name={icon} size={17} />
            <span className="flex-1">{label}</span>
            {href === "/account/orders" && pending > 0 && <span className="tag tag-warn !text-[10px]">{pending} to pay</span>}
            {href === "/account/wishlist" && wishlist.length > 0 && <span className="tag tag-light !text-[10px]">{wishlist.length}</span>}
          </Link>
        );
      })}
      {isAdmin && <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 text-[var(--blue)] hover:bg-[var(--sky-2)]"><Icon name="store" size={17} /> Admin panel</Link>}
      <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 text-[var(--bad)] hover:bg-[#fde8e8] text-left"><Icon name="logout" size={17} /> Sign out</button>
    </nav>
  );
}

export function VerifyBanner({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "sent" | "err">("idle");
  return (
    <div className="rounded-2xl bg-[#fff8e6] border border-[#f5dfa6] px-5 py-4 mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span><b>Please confirm your email.</b> We sent a link to {email}. Confirming also adds orders you placed earlier with this email.</span>
      {state === "sent" ? (
        <span className="font-semibold text-[var(--ok)]">New link sent ✓</span>
      ) : (
        <button
          className="btn btn-outline btn-sm"
          onClick={async () => {
            const r = await fetch("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resend: true }) });
            setState(r.ok ? "sent" : "err");
          }}
        >
          {state === "err" ? "Try again" : "Resend link"}
        </button>
      )}
    </div>
  );
}
