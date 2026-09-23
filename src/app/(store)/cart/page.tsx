"use client";
import Link from "next/link";
import FrameArt from "@/components/FrameArt";
import Icon from "@/components/Icon";
import { Price, useSite, useStore } from "@/components/Providers";
import { usd } from "@/lib/money";

export default function CartPage() {
  const { cart, updateCart, removeFromCart, totals } = useStore();
  const { pricing } = useSite();
  const nextTier = [...pricing.bundleTiers].sort((a, b) => a.qty - b.qty).find((t) => t.qty > totals.frames);
  return (
    <div className="container-x py-12">
      <h1 className="h-section mb-8">Your bag</h1>
      {cart.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="lead">Your bag is empty.</p>
          <Link href="/shop" className="btn btn-primary mt-5">Browse frames</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
          <div className="grid gap-4">
            {nextTier && (
              <div className="rounded-2xl bg-[var(--sky)] px-5 py-4 text-sm">
                <b>Bundle tip:</b> add {nextTier.qty - totals.frames} more frame{nextTier.qty - totals.frames > 1 ? "s" : ""} and every frame in your bag gets {Math.round(nextTier.off * 100)}% off.
              </div>
            )}
            {cart.map((c) => (
              <div key={c.key} className="card-flat p-4 flex gap-4 items-center">
                <div className="w-32 h-24 rounded-xl bg-[var(--sky-2)] grid place-items-center shrink-0">
                  <FrameArt photo={c.image} spec={{ ...c.spec, shape: c.shape }} color={c.colorHex} accent={c.accentHex} finish={c.finish} sun={c.sun} className="w-[90%]" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/product/${c.slug}`} className="font-display text-xl font-semibold text-[var(--navy)]">{c.name}</Link>
                  <div className="text-sm muted">{c.colorName} · {c.lensName}{c.coatingNames.length ? ` + ${c.coatingNames.join(", ")}` : ""}</div>
                  <div className="text-xs mt-1 text-[var(--blue)] font-semibold">
                    {c.rxMode === "form" && `Rx: R ${c.rx?.odSph}/${c.rx?.odCyl} · L ${c.rx?.osSph}/${c.rx?.osCyl} · PD ${c.rx?.pd || `${c.rx?.pdRight}/${c.rx?.pdLeft}`}`}
                    {c.rxMode === "upload" && `Rx photo: ${c.rxUploadName || "uploaded"}`}
                    {c.rxMode === "later" && "Prescription to follow"}
                  </div>
                </div>
                <div className="flex items-center border border-[var(--line)] rounded-full">
                  <button className="px-3 py-2" onClick={() => (c.qty > 1 ? updateCart(c.key, { qty: c.qty - 1 }) : removeFromCart(c.key))} aria-label="Decrease"><Icon name="minus" size={14} /></button>
                  <span className="w-6 text-center font-bold">{c.qty}</span>
                  <button className="px-3 py-2" onClick={() => updateCart(c.key, { qty: Math.min(20, c.qty + 1) })} aria-label="Increase"><Icon name="plus" size={14} /></button>
                </div>
                <div className="w-24 text-right font-bold">{usd((c.unitPrice + c.lensPrice) * c.qty)}</div>
                <button className="icon-btn" onClick={() => removeFromCart(c.key)} aria-label="Remove"><Icon name="x" size={16} /></button>
              </div>
            ))}
          </div>
          <div className="card p-6 grid gap-2 text-sm lg:sticky lg:top-24">
            <div className="font-display text-xl font-semibold mb-2 text-[var(--navy)]">Summary</div>
            <div className="flex justify-between"><span>Frames ({totals.frames})</span><span>{usd(totals.subtotal)}</span></div>
            {totals.bundleDiscount > 0 && <div className="flex justify-between text-[var(--ok)] font-semibold"><span>Bundle saving ({Math.round(totals.off * 100)}%)</span><span>−{usd(totals.bundleDiscount)}</span></div>}
            <div className="flex justify-between"><span>Lenses</span><span>{usd(totals.lensTotal)}</span></div>
            <div className="flex justify-between muted"><span>DHL Express</span><span>Calculated at checkout</span></div>
            <div className="flex justify-between items-baseline border-t border-[var(--line)] pt-3 mt-2 text-base"><b>Total</b><Price cents={totals.total} className="text-lg" /></div>
            <Link href="/checkout" className="btn btn-primary btn-lg mt-3">Secure checkout <Icon name="lock" size={16} /></Link>
            <p className="text-xs muted text-center mt-2">Charged in USD. Local currency shown as an estimate.</p>
          </div>
        </div>
      )}
    </div>
  );
}
