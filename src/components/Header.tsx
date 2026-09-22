"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "./Icon";
import { useSite, useStore } from "./Providers";
import { CURRENCIES } from "@/lib/money";

const COLLECTION = [
  { href: "/shop", label: "All frames" },
  { href: "/shop?gender=men", label: "Men" },
  { href: "/shop?gender=women", label: "Women" },
  { href: "/shop?gender=unisex", label: "Unisex" },
];
const NAV = [
  { href: "/#pricing", label: "Pricing" },
  { href: "/#lenses", label: "Lenses" },
  { href: "/#build", label: "Build your order" },
  { href: "/#faq", label: "FAQ" },
];

export default function Header() {
  const { cart, setCartOpen, wishlist, me, currency, setCurrency } = useStore();
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [coll, setColl] = useState(false);
  const router = useRouter();
  const { store, home, branding } = useSite();
  const count = cart.reduce((s, c) => s + c.qty, 0);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 10);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchOpen(false);
    router.push(`/shop?q=${encodeURIComponent(q)}`);
  };

  const tickerItems = home.ticker.filter(Boolean);

  return (
    <>
      <div className="ticker" aria-label="Offers">
        <div className="ticker-track">
          {[...tickerItems, ...tickerItems].map((t, i) => (
            <span key={i} aria-hidden={i >= tickerItems.length}>◆ <b>{t}</b></span>
          ))}
        </div>
      </div>
      <header className={`site-header ${scrolled ? "scrolled" : ""}`}>
        <div className="container-x flex items-center gap-4 h-[72px]">
          <button className="icon-btn lg:hidden" onClick={() => setMenu(!menu)} aria-label="Menu">
            <Icon name={menu ? "x" : "menu"} />
          </button>
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label={`${store.name} home`}>
            {branding.storeLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.storeLogo} alt={store.name} className="h-11 w-auto max-w-[200px] object-contain" />
            ) : (
            <>
            <span className="w-10 h-10 rounded-full grid place-items-center text-white shrink-0" style={{ background: "linear-gradient(135deg,var(--blue),var(--navy))" }}>
              <Icon name="glasses" size={22} />
            </span>
            <span className="leading-tight hidden sm:block">
              <span className="font-display text-[18px] font-semibold text-[var(--navy)] block whitespace-nowrap">{store.name}</span>
              <span className="text-[9.5px] tracking-[.2em] uppercase text-[var(--muted)] font-bold">{store.tagline}</span>
            </span>
            </>
            )}
          </Link>

          <nav className="hidden lg:flex items-center gap-1 mx-auto" aria-label="Main">
            <div className="relative" onMouseEnter={() => setColl(true)} onMouseLeave={() => setColl(false)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setColl(false); }}>
              <div className="flex items-center">
                <Link href="/#collection" className="nav-link !pr-1">Collection</Link>
                <button className="nav-link !px-1.5" aria-label="Show submenu for Collection" aria-expanded={coll} onClick={() => setColl(true)} onKeyDown={(e) => e.key === "Escape" && setColl(false)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${coll ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
                </button>
              </div>
              {(
                <div className={`absolute left-0 top-full pt-2 z-50 ${coll ? "" : "hidden"}`}>
                  <ul className="card p-2 min-w-[190px] grid gap-0.5 shadow-lg">
                    {COLLECTION.map((c) => (
                      <li key={c.href}><Link href={c.href} onClick={() => setColl(false)} className="block px-3 py-2 rounded-lg text-sm font-semibold hover:bg-[var(--sky-2)] hover:text-[var(--blue)]">{c.label}</Link></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="nav-link">{n.label}</Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 ml-auto lg:ml-0">
            <select
              aria-label="Display currency"
              className="hidden md:block text-[12.5px] font-bold border border-[var(--line)] rounded-full px-2.5 py-2 bg-white"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <button className="icon-btn" aria-label="Search" onClick={() => setSearchOpen(!searchOpen)}>
              <Icon name="search" />
            </button>
            <Link href="/wishlist" className="icon-btn hidden sm:grid" aria-label="Wishlist">
              <Icon name="heart" />
              {wishlist.length > 0 && <span className="icon-badge">{wishlist.length}</span>}
            </Link>
            <Link href={me ? (me.role === "admin" ? "/admin" : "/account") : "/login"} className="icon-btn" aria-label="Account">
              <Icon name="user" />
            </Link>
            <button className="icon-btn" aria-label="Cart" onClick={() => setCartOpen(true)}>
              <Icon name="cart" />
              {count > 0 && <span className="icon-badge">{count}</span>}
            </button>
            <Link href="/shop" className="btn btn-primary hidden md:inline-flex">Shop now</Link>
          </div>
        </div>
        {searchOpen && (
          <form onSubmit={submit} className="container-x pb-4">
            <div className="flex gap-2">
              <input autoFocus className="input" placeholder="Search frames, shapes, colours, model numbers…" value={q} onChange={(e) => setQ(e.target.value)} />
              <button className="btn btn-blue">Search</button>
            </div>
          </form>
        )}
        {menu && (
          <nav className="lg:hidden container-x pb-4 grid gap-1" aria-label="Main">
            <Link href="/#collection" className="nav-link" onClick={() => setMenu(false)}>Collection</Link>
            <div className="grid gap-0.5 pl-4 border-l-2 border-[var(--line)] ml-3">
              {COLLECTION.map((c) => (
                <Link key={c.href} href={c.href} className="nav-link !py-1.5 text-[14px]" onClick={() => setMenu(false)}>{c.label}</Link>
              ))}
            </div>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="nav-link" onClick={() => setMenu(false)}>{n.label}</Link>
            ))}
            <Link href="/try-on" className="nav-link" onClick={() => setMenu(false)}>3D Try-On</Link>
            <Link href="/wishlist" className="nav-link" onClick={() => setMenu(false)}>Wishlist</Link>
            <select className="select mt-2" value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Display currency">
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </nav>
        )}
      </header>
    </>
  );
}
