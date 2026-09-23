"use client";
import Link from "next/link";
import FrameArt from "./FrameArt";
import Icon from "./Icon";
import { Price, useSite, useStore } from "./Providers";
import { usd } from "@/lib/money";

export default function CartDrawer() {
  const { cart, cartOpen, setCartOpen, updateCart, removeFromCart, totals } = useStore();
  const { pricing } = useSite();
  if (!cartOpen) return null;
  const nextTier = [...pricing.bundleTiers].sort((a, b) => a.qty - b.qty).find((t) => t.qty > totals.frames);
  return (
    <>
      <div className="drawer-bg" onClick={() => setCartOpen(false)} />
      <aside className="drawer" role="dialog" aria-label="Shopping bag">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--line)]">
          <div className="font-display text-xl font-semibold text-[var(--navy)]">Your bag ({totals.frames})</div>
          <button className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Close"><Icon name="x" /></button>
        </div>
        {nextTier && totals.frames > 0 && (
          <div className="mx-6 mt-4 rounded-xl bg-[var(--sky)] px-4 py-3 text-sm">
            Add <b>{nextTier.qty - totals.frames}</b> more frame{nextTier.qty - totals.frames > 1 ? "s" : ""} to save <b>{Math.round(nextTier.off * 100)}%</b> on all frames.
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4 grid gap-4 content-start">
          {cart.length === 0 && (
            <div className="text-center py-16">
              <p className="muted mb-4">Your bag is empty.</p>
              <Link href="/shop" className="btn btn-primary" onClick={() => setCartOpen(false)}>Browse frames</Link>
            </div>
          )}
          {cart.map((c) => (
            <div key={c.key} className="flex gap-3 border-b border-[var(--line)] pb-4">
              <div className="w-24 h-16 rounded-xl bg-[var(--sky-2)] grid place-items-center shrink-0">
                <FrameArt photo={c.image} spec={{ ...c.spec, shape: c.shape }} color={c.colorHex} accent={c.accentHex} finish={c.finish} sun={c.sun} className="w-full" />
              </div>
              <div className="flex-1 min-w-0 text-sm">
                <Link href={`/product/${c.slug}`} className="font-bold hover:text-[var(--blue)]" onClick={() => setCartOpen(false)}>{c.name}</Link>
                <div className="muted">{c.colorName}</div>
                <div className="muted">{c.lensName}{c.coatingNames.length ? ` + ${c.coatingNames.join(", ")}` : ""}</div>
                {c.rxMode !== "none" && <div className="text-[var(--blue)] text-xs font-semibold mt-0.5">Rx: {c.rxMode === "form" ? "entered" : c.rxMode === "upload" ? "photo uploaded" : "send later"}</div>}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center border border-[var(--line)] rounded-full">
                    <button className="px-2.5 py-1" onClick={() => (c.qty > 1 ? updateCart(c.key, { qty: c.qty - 1 }) : removeFromCart(c.key))} aria-label="Decrease"><Icon name="minus" size={14} /></button>
                    <span className="w-6 text-center font-bold">{c.qty}</span>
                    <button className="px-2.5 py-1" onClick={() => updateCart(c.key, { qty: Math.min(20, c.qty + 1) })} aria-label="Increase"><Icon name="plus" size={14} /></button>
                  </div>
                  <span className="font-bold">{usd((c.unitPrice + c.lensPrice) * c.qty)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="border-t border-[var(--line)] px-6 py-5 grid gap-2 text-sm">
            <Row l="Frames" r={usd(totals.subtotal)} />
            {totals.bundleDiscount > 0 && <Row l={`Bundle saving (${Math.round(totals.off * 100)}%)`} r={"−" + usd(totals.bundleDiscount)} className="text-[var(--ok)] font-semibold" />}
            {totals.lensTotal > 0 && <Row l="Lenses" r={usd(totals.lensTotal)} />}
            <Row l="DHL Express shipping" r="At checkout" className="muted" />
            <div className="flex justify-between items-baseline mt-1 text-base">
              <b>Total</b>
              <Price cents={totals.total} className="text-lg" />
            </div>
            <Link href="/checkout" className="btn btn-primary btn-lg w-full mt-2" onClick={() => setCartOpen(false)}>
              Checkout <Icon name="arrow" size={16} />
            </Link>
            <Link href="/cart" className="btn btn-ghost w-full" onClick={() => setCartOpen(false)}>View bag</Link>
          </div>
        )}
      </aside>
    </>
  );
}

function Row({ l, r, className }: { l: string; r: string; className?: string }) {
  return (
    <div className={`flex justify-between ${className || ""}`}>
      <span>{l}</span>
      <span>{r}</span>
    </div>
  );
}
