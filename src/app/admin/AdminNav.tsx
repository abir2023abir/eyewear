"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS: [string, string][] = [
  ["/admin", "Sales overview"],
  ["/admin/orders", "Orders & payments"],
  ["/admin/orders/new", "+ Create manual order"],
  ["/admin/chat", "Chat inbox"],
  ["/admin/products", "Frames & stock"],
  ["/admin/products/new", "+ Add a frame"],
  ["/admin/lenses", "Lens pricing"],
  ["/admin/customers", "Customers & admins"],
  ["/admin/blog", "Blog"],
  ["/admin/subscribers", "Newsletter"],
  ["/admin/settings", "Store settings"],
  ["/", "← View store"],
];

export default function AdminNav() {
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const tick = () => fetch("/api/admin/chat?summary=1").then((r) => r.json()).then((j) => setUnread(j.unread || 0)).catch(() => {});
    tick();
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, []);
  const isOn = (href: string) => (href === "/admin" ? path === href : href !== "/" && (path === href || (path.startsWith(href + "/") && !LINKS.some(([h]) => h !== href && h.startsWith(href + "/") && path.startsWith(h)))));
  return (
    <nav className="grid gap-0.5">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} className={isOn(href) ? "on" : ""}>
          {label}
          {href === "/admin/chat" && unread > 0 && <span className="ml-2 inline-grid place-items-center min-w-5 h-5 px-1 rounded-full bg-[#e11d48] text-white text-[11px]">{unread}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function SignOut() {
  const router = useRouter();
  return (
    <button
      className="block mt-3 text-[13px] font-bold text-white/90 hover:text-white underline underline-offset-4"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
