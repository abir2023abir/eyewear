"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { COUNTRY_CURRENCY, FALLBACK_RATES, formatIn, usd } from "@/lib/money";
import { bundleOffFor, type PublicSettings } from "@/lib/settings-shared";

/* ---------------- storage helpers ---------------- */
function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

/* ---------------- types ---------------- */
export type Rx = {
  odSph?: string; odCyl?: string; odAxis?: string; osSph?: string; osCyl?: string; osAxis?: string;
  add?: string; pd?: string; pdRight?: string; pdLeft?: string;
};
export type CartItem = {
  key: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  colorName: string;
  colorHex: string;
  accentHex?: string | null;
  finish?: string;
  shape: string;
  spec: { lensWidth: number; lensHeight: number; bridge: number; templeLength: number; frameWidth: number; material: string };
  sun: boolean;
  unitPrice: number;
  qty: number;
  lensCode: string;
  lensName: string;
  lensPrice: number;
  coatings: string[];
  coatingNames: string[];
  rxMode: "none" | "form" | "upload" | "later";
  rx?: Rx;
  rxUploadId?: string;
  rxUploadName?: string;
};
export type Me = { id: string; name: string; email: string; role: string } | null;

type Ctx = {
  site: PublicSettings;
  me: Me;
  refreshMe: () => Promise<void>;
  cart: CartItem[];
  addToCart: (i: Omit<CartItem, "key">) => void;
  updateCart: (key: string, patch: Partial<CartItem>) => void;
  removeFromCart: (key: string) => void;
  clearCart: () => void;
  cartOpen: boolean;
  setCartOpen: (b: boolean) => void;
  totals: { frames: number; subtotal: number; bundleDiscount: number; lensTotal: number; total: number; off: number };
  wishlist: string[];
  toggleWish: (productId: string) => void;
  currency: string;
  rate: number;
  setCurrency: (c: string) => void;
  local: (cents: number) => string | null;
};

const StoreCtx = createContext<Ctx | null>(null);
export const useStore = () => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside provider");
  return c;
};

function detectCurrency(): string {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of langs) {
    const region = l.split("-")[1]?.toUpperCase();
    if (region && COUNTRY_CURRENCY[region]) return COUNTRY_CURRENCY[region];
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  if (tz.startsWith("Europe/")) return tz === "Europe/London" ? "GBP" : "EUR";
  if (tz === "Asia/Dhaka") return "BDT";
  if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") return "INR";
  if (tz === "Asia/Dubai") return "AED";
  if (tz.startsWith("Australia/")) return "AUD";
  return "USD";
}

export default function Providers({ children, settings }: { children: React.ReactNode; settings: PublicSettings }) {
  const [me, setMe] = useState<Me>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [currency, setCur] = useState("USD");
  const [rates, setRates] = useState<Record<string, number>>(FALLBACK_RATES);

  const refreshMe = useCallback(async () => {
    const r = await fetch("/api/auth/me").then((r) => r.json()).catch(() => ({ user: null }));
    setMe(r.user);
    if (r.user) {
      // merge guest wishlist into the account, then load the account wishlist
      const local = load<string[]>("wishlist", []);
      const w = await fetch("/api/wishlist", {
        method: local.length ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: local.length ? JSON.stringify({ merge: local }) : undefined,
      }).then((r) => r.json()).catch(() => ({ ids: local }));
      save("wishlist", []);
      setWishlist(w.ids || []);
    } else {
      setWishlist(load<string[]>("wishlist", []));
    }
  }, []);

  useEffect(() => {
    setCart(load("cart", []));
    setCur(load<string | null>("currency", null) || detectCurrency());
    refreshMe();
    fetch("/api/fx").then((r) => r.json()).then((j) => j.rates && setRates(j.rates)).catch(() => {});
  }, [refreshMe]);

  const persistCart = (next: CartItem[]) => {
    setCart(next);
    save("cart", next);
  };

  const addToCart = (i: Omit<CartItem, "key">) => {
    const key = `${i.variantId}|${i.lensCode}|${i.coatings.join(",")}|${i.rxMode}|${JSON.stringify(i.rx || {})}|${i.rxUploadId || ""}`;
    const cur = load<CartItem[]>("cart", cart);
    const found = cur.find((c) => c.key === key);
    persistCart(found ? cur.map((c) => (c.key === key ? { ...c, qty: Math.min(20, c.qty + i.qty) } : c)) : [...cur, { ...i, key }]);
    setCartOpen(true);
  };
  const updateCart = (key: string, patch: Partial<CartItem>) => persistCart(cart.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const removeFromCart = (key: string) => persistCart(cart.filter((c) => c.key !== key));
  const clearCart = () => persistCart([]);

  const totals = useMemo(() => {
    const frames = cart.reduce((s, c) => s + c.qty, 0);
    const subtotal = cart.reduce((s, c) => s + c.unitPrice * c.qty, 0);
    const off = bundleOffFor(settings.pricing.bundleTiers, frames);
    const bundleDiscount = Math.round(subtotal * off);
    const lensTotal = cart.reduce((s, c) => s + c.lensPrice * c.qty, 0);
    return { frames, subtotal, bundleDiscount, lensTotal, total: subtotal - bundleDiscount + lensTotal, off };
  }, [cart, settings.pricing.bundleTiers]);

  const toggleWish = (productId: string) => {
    const has = wishlist.includes(productId);
    const next = has ? wishlist.filter((x) => x !== productId) : [...wishlist, productId];
    setWishlist(next);
    if (me) {
      fetch("/api/wishlist", {
        method: has ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      }).catch(() => {});
    } else save("wishlist", next);
  };

  const setCurrency = (c: string) => {
    setCur(c);
    save("currency", c);
  };
  const rate = rates[currency] || 1;
  const local = useCallback((cents: number) => (currency === "USD" ? null : formatIn(cents, currency, rate)), [currency, rate]);

  return (
    <StoreCtx.Provider
      value={{
        site: settings,
        me, refreshMe, cart, addToCart, updateCart, removeFromCart, clearCart, cartOpen, setCartOpen, totals,
        wishlist, toggleWish, currency, rate, setCurrency, local,
      }}
    >
      {children}
    </StoreCtx.Provider>
  );
}

/** Public store settings (name, contact, bundles, homepage text) edited in Admin → Settings. */
export const useSite = () => useStore().site;

/** "US$29 ≈ €27" */
export function Price({ cents, className, strike }: { cents: number; className?: string; strike?: number | null }) {
  const { local } = useStore();
  const l = local(cents);
  return (
    <span className={className}>
      {strike ? <s className="price-strike">{usd(strike)}</s> : null}
      <span className="price-usd">{usd(cents)}</span>
      {l ? <span className="price-local"> ≈ {l}</span> : null}
    </span>
  );
}

/* --------- "product currently being viewed" (for the chat attach button) --------- */
export type ViewingProduct = { productId: string; variantId: string; slug: string; name: string; colorName: string; price: number; colorHex: string } | null;
let viewing: ViewingProduct = null;
const subs = new Set<() => void>();
export function setViewingProduct(p: ViewingProduct) {
  viewing = p;
  subs.forEach((f) => f());
}
export function useViewingProduct() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => viewing,
    () => null,
  );
}
