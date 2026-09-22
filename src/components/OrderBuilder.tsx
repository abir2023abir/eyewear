"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import FrameArt from "./FrameArt";
import Icon from "./Icon";
import { Price, useSite, useStore } from "./Providers";
import { bundleOffFor, waLink } from "@/lib/settings-shared";
import { swatchBg } from "@/lib/finish";
import { usd } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";

type Lens = { code: string; kind: string; name: string; description: string; price: number };
type Slot = { productId: string; variantId: string };

const STEPS = [
  ["Bundle", "Size"],
  ["Frames", "Models"],
  ["Lenses", "Upgrades"],
  ["Review", "Checkout"],
] as const;

/** Homepage "Build your order": pick how many frames, which models/colours and lens upgrades, then go to checkout. */
export default function OrderBuilder({ products, lenses }: { products: ProductDTO[]; lenses: Lens[] }) {
  const router = useRouter();
  const { pricing, store } = useSite();
  const { addToCart, setCartOpen } = useStore();
  const tiers = useMemo(() => [...pricing.bundleTiers].sort((a, b) => a.qty - b.qty), [pricing.bundleTiers]);
  const sizes = tiers.length ? tiers.map((t) => t.qty) : [1, 2, 3];
  const [step, setStep] = useState(0);
  const [count, setCount] = useState(sizes[0] || 1);
  const first = products[0];
  const [slots, setSlots] = useState<Slot[]>(() => (first ? [{ productId: first.id, variantId: first.variants[0]?.id }] : []));
  const types = lenses.filter((l) => l.kind === "type" && l.code !== "none");
  const coats = lenses.filter((l) => l.kind === "coating");
  const [lensCode, setLensCode] = useState("none");
  const [coatings, setCoatings] = useState<string[]>([]);
  const [open, setOpen] = useState(0);

  if (!first) return null;

  const byId = (id: string) => products.find((p) => p.id === id) || first;
  const pick = (n: number) => {
    setCount(n);
    setSlots((s) => Array.from({ length: n }, (_, i) => s[i] || s[s.length - 1] || { productId: first.id, variantId: first.variants[0].id }));
  };
  const setSlot = (i: number, patch: Partial<Slot>) => setSlots((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const lensOpt = types.find((l) => l.code === lensCode);
  const coatOpts = coats.filter((c) => coatings.includes(c.code));
  const lensEach = (lensOpt?.price || 0) + coatOpts.reduce((s, c) => s + c.price, 0);
  const lines = slots.slice(0, count).map((s) => {
    const p = byId(s.productId);
    const v = p.variants.find((x) => x.id === s.variantId) || p.variants[0];
    return { p, v };
  });
  const subtotal = lines.reduce((s, l) => s + l.p.price, 0);
  const off = bundleOffFor(pricing.bundleTiers, count);
  const saving = Math.round(subtotal * off);
  const lensTotal = lensEach * count;
  const total = subtotal - saving + lensTotal;
  const outOfStock = lines.some((l) => l.v.stock <= 0);

  const checkout = () => {
    for (const { p, v } of lines) {
      addToCart({
        variantId: v.id, productId: p.id, slug: p.slug, name: `${p.name} ${p.modelCode}`, colorName: v.colorName,
        colorHex: v.colorHex, accentHex: v.accentHex, finish: v.finish, shape: p.shape,
        spec: { lensWidth: p.lensWidth, lensHeight: p.lensHeight, bridge: p.bridge, templeLength: p.templeLength, frameWidth: p.frameWidth, material: p.material },
        sun: p.category === "sunglasses", unitPrice: p.price, qty: 1,
        lensCode, lensName: lensOpt?.name || "Frame only", lensPrice: lensEach, coatings, coatingNames: coatOpts.map((c) => c.name),
        // prescription is collected after ordering (in the chat) when lenses/upgrades are chosen
        rxMode: lensCode !== "none" || coatings.length ? "later" : "none",
      });
    }
    setCartOpen(false);
    router.push("/checkout");
  };

  const waText = `Hello ${store.name}! I'd like to order ${count} frame${count > 1 ? "s" : ""}:\n${lines.map((l, i) => `${i + 1}. ${l.p.name} ${l.p.modelCode} — ${l.v.colorName}`).join("\n")}${lensOpt || coatOpts.length ? `\nLens/upgrades: ${[lensOpt?.name, ...coatOpts.map((c) => c.name)].filter(Boolean).join(", ")}` : ""}\nEstimated total: ${usd(total)} + delivery`;

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
      <div className="card p-5 sm:p-7">
        <ol className="grid grid-cols-4 gap-2 mb-7">
          {STEPS.map(([t, s], i) => (
            <li key={t}>
              <button onClick={() => setStep(i)} className="w-full text-left">
                <div className={`h-1.5 rounded-full ${i <= step ? "bg-[var(--blue)]" : "bg-[var(--line)]"}`} />
                <div className={`mt-2 text-[13px] font-bold ${i === step ? "text-[var(--navy)]" : "muted"}`}>{i + 1}. {t}</div>
                <div className="text-[10px] uppercase tracking-wider muted hidden sm:block">{s}</div>
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div>
            <h3 className="font-display text-2xl font-semibold text-[var(--navy)]">How many frames?</h3>
            <p className="muted text-sm mt-1">Bundle pricing applies automatically — mix any models and colours.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {sizes.map((n) => {
                const o = bundleOffFor(pricing.bundleTiers, n);
                return (
                  <button key={n} onClick={() => pick(n)} className={`rounded-2xl border-2 p-4 text-left transition-colors ${count === n ? "border-[var(--blue)] bg-[var(--sky-2)]" : "border-[var(--line)] hover:border-[var(--blue)]"}`}>
                    <div className="font-display text-3xl font-semibold text-[var(--navy)]">{n}</div>
                    <div className="text-xs font-bold muted uppercase tracking-wider">frame{n > 1 ? "s" : ""}</div>
                    <div className={`text-sm font-bold mt-2 ${o ? "text-[var(--ok)]" : "muted"}`}>{o ? `Save ${Math.round(o * 100)}%` : "Base price"}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="font-display text-2xl font-semibold text-[var(--navy)]">Choose your frames</h3>
            <p className="muted text-sm mt-1">Pick a model and colour for each frame.</p>
            <div className="grid gap-3 mt-5">
              {lines.map(({ p, v }, i) => (
                <div key={i} className={`rounded-2xl border ${open === i ? "border-[var(--blue)]" : "border-[var(--line)]"}`}>
                  <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setOpen(open === i ? -1 : i)}>
                    <span className="w-8 h-8 rounded-full bg-[var(--sky)] text-[var(--blue)] grid place-items-center text-sm font-bold shrink-0">{i + 1}</span>
                    <span className="w-20 shrink-0">
                      {v.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.images[0]} alt="" className="w-full h-auto" />
                      ) : (
                        <FrameArt spec={p} color={v.colorHex} accent={v.accentHex} finish={v.finish} sun={p.category === "sunglasses"} className="w-full" />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="font-bold block truncate">{p.name} {p.modelCode}</span>
                      <span className="text-xs muted">{v.colorName} · {usd(p.price)}{v.stock <= 0 && <b className="text-[var(--bad)]"> · out of stock</b>}</span>
                    </span>
                    <Icon name={open === i ? "minus" : "plus"} size={16} />
                  </button>
                  {open === i && (
                    <div className="px-3 pb-4 grid gap-3">
                      <select className="select" value={p.id} onChange={(e) => { const np = byId(e.target.value); setSlot(i, { productId: np.id, variantId: (np.variants.find((x) => x.stock > 0) || np.variants[0]).id }); }}>
                        {products.map((x) => <option key={x.id} value={x.id}>{x.name} {x.modelCode} — {x.shape} · {x.material} · {usd(x.price)}</option>)}
                      </select>
                      <div className="flex flex-wrap gap-2 items-center">
                        {p.variants.map((x) => (
                          <button key={x.id} title={x.colorName} aria-label={x.colorName} onClick={() => setSlot(i, { variantId: x.id })} className={`swatch ${x.id === v.id ? "on" : ""} ${x.stock <= 0 ? "opacity-40" : ""}`} style={{ background: swatchBg(x) }} />
                        ))}
                        <span className="text-xs muted ml-1">{v.colorName}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="font-display text-2xl font-semibold text-[var(--navy)]">{types.length ? "Add lenses" : "Optional upgrades"}</h3>
            <p className="muted text-sm mt-1">Applied to every frame in this order. You’ll send your prescription in the chat after ordering.</p>
            {types.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                {[{ code: "none", name: "Frame only", description: "No lenses.", price: 0 }, ...types].map((l) => (
                  <button key={l.code} onClick={() => setLensCode(l.code)} className={`rounded-2xl border-2 p-4 text-left ${lensCode === l.code ? "border-[var(--blue)] bg-[var(--sky-2)]" : "border-[var(--line)]"}`}>
                    <div className="flex justify-between gap-2"><b>{l.name}</b><span className="font-bold">{l.price ? `+${usd(l.price)}` : "—"}</span></div>
                    <p className="text-xs muted mt-1">{l.description}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              {coats.map((c) => {
                const on = coatings.includes(c.code);
                return (
                  <label key={c.code} className={`rounded-2xl border-2 p-4 flex gap-3 cursor-pointer ${on ? "border-[var(--blue)] bg-[var(--sky-2)]" : "border-[var(--line)]"}`}>
                    <input type="checkbox" className="mt-1" checked={on} onChange={(e) => setCoatings((x) => (e.target.checked ? [...x, c.code] : x.filter((y) => y !== c.code)))} />
                    <span className="flex-1">
                      <span className="flex justify-between gap-2"><b>{c.name}</b><span className="font-bold whitespace-nowrap">+{usd(c.price)}</span></span>
                      <span className="text-xs muted block mt-1">{c.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs muted mt-3">No upgrades? Just continue — frames can be ordered on their own.</p>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="font-display text-2xl font-semibold text-[var(--navy)]">Review your order</h3>
            <ul className="grid gap-2 mt-4 text-sm">
              {lines.map(({ p, v }, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full border border-black/10 shrink-0" style={{ background: swatchBg(v) }} />
                  <span className="flex-1">{p.name} {p.modelCode} · {v.colorName}</span>
                  <span className="font-semibold">{usd(p.price)}</span>
                </li>
              ))}
            </ul>
            {(lensOpt || coatOpts.length > 0) && <p className="text-sm mt-3">Lenses / upgrades on each frame: <b>{[lensOpt?.name, ...coatOpts.map((c) => c.name)].filter(Boolean).join(", ")}</b></p>}
            <div className="rounded-2xl bg-[var(--sky-2)] p-4 mt-5 text-sm grid gap-1.5">
              <div className="flex gap-2"><Icon name="check" size={16} /> Next: enter your address at checkout.</div>
              <div className="flex gap-2"><Icon name="check" size={16} /> Our order assistant confirms delivery price and date in the chat.</div>
              <div className="flex gap-2"><Icon name="check" size={16} /> Pay securely by PayPal or XTransfer bank transfer.</div>
            </div>
            {outOfStock && <p className="err mt-3">One of the colours is out of stock — please pick another colour in step 2.</p>}
          </div>
        )}

        <div className="flex justify-between items-center gap-3 mt-8">
          <button className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>← Back</button>
          <span className="text-xs muted">Step {step + 1} of {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => { setStep(step + 1); if (step === 0) setOpen(0); }}>Continue →</button>
          ) : (
            <button className="btn btn-primary" onClick={checkout} disabled={outOfStock}>Go to checkout →</button>
          )}
        </div>
      </div>

      <aside className="card p-5 lg:sticky lg:top-24">
        <div className="font-display text-xl font-semibold text-[var(--navy)]">Your estimate</div>
        <div className="grid gap-2 text-sm mt-4">
          {lines.map(({ p, v }, i) => (
            <div key={i} className="flex justify-between gap-3"><span className="muted truncate">Frame {i + 1} · {p.name} {p.modelCode} · {v.colorName}</span><span>{usd(p.price)}</span></div>
          ))}
          <div className="flex justify-between border-t border-[var(--line)] pt-2"><span>Frames</span><span>{usd(subtotal)}</span></div>
          <div className="flex justify-between text-[var(--ok)]"><span>Bundle saving{off ? ` (${Math.round(off * 100)}%)` : ""}</span><span>−{usd(saving)}</span></div>
          {lensTotal > 0 && <div className="flex justify-between"><span>Lenses & upgrades ({count})</span><span>{usd(lensTotal)}</span></div>}
          <div className="flex justify-between muted"><span>Delivery</span><span>at checkout</span></div>
          <div className="flex justify-between items-end border-t border-[var(--line)] pt-3 mt-1">
            <b className="text-xs uppercase tracking-wider">Estimated total</b>
            <Price cents={total} className="text-xl font-bold" />
          </div>
        </div>
        <a href={waLink(store.whatsapp, waText)} target="_blank" rel="noopener" className="btn btn-outline w-full mt-5"><Icon name="phone" size={15} /> Order on WhatsApp instead</a>
        <Link href="/shop" className="block text-center text-xs font-bold text-[var(--blue)] mt-3">Browse all frames →</Link>
      </aside>
    </div>
  );
}
