"use client";
import dynamic from "next/dynamic";
import { swatchBg } from "@/lib/finish";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FrameArt from "./FrameArt";
import Icon from "./Icon";
import RxForm, { RxUpload, validateRx } from "./RxForm";
import { Price, Rx, setViewingProduct, useSite, useStore } from "./Providers";
import { cap, ProductDTO } from "@/lib/types";
import { usd } from "@/lib/money";
import type { LensKind } from "@/lib/frame3d";

const Viewer360 = dynamic(() => import("./Viewer360"), { ssr: false, loading: () => <div className="w-full h-full grid place-items-center muted">Loading 3D…</div> });

export type LensOpt = { code: string; kind: string; name: string; description: string; price: number };

const PHOTO_LABELS = ["Folded", "Open"];

export default function ProductView({ p, lenses, initialVariant }: { p: ProductDTO; lenses: LensOpt[]; initialVariant?: string }) {
  const { addToCart, wishlist, toggleWish } = useStore();
  const { pricing } = useSite();
  const [vi, setVi] = useState(Math.max(0, p.variants.findIndex((v) => v.id === initialVariant)));
  const [tab, setTab] = useState<"3d" | "front" | "side" | number>(() => ((p.variants.find((x) => x.id === initialVariant) ?? p.variants[0])?.images?.length ? 0 : "3d"));
  const types = lenses.filter((l) => l.kind === "type");
  const hasLensTypes = types.some((l) => l.code !== "none");
  const coats = lenses.filter((l) => l.kind === "coating");
  const sun = p.category === "sunglasses";
  const [lens, setLens] = useState(!sun && types.some((l) => l.code === "bluecut") ? "bluecut" : "none");
  const [coatings, setCoatings] = useState<string[]>([]);
  const [rxMode, setRxMode] = useState<"none" | "form" | "upload" | "later">("form");
  const [rx, setRx] = useState<Rx>({});
  const [upload, setUpload] = useState<{ id: string; name: string } | null>(null);
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState("");
  const [estPd, setEstPd] = useState<number | null>(null);
  const v = p.variants[vi];
  const lensOpt = types.find((l) => l.code === lens);
  const coatOpts = coats.filter((c) => coatings.includes(c.code));
  const lensPrice = (lensOpt?.price || 0) + coatOpts.reduce((s, c) => s + c.price, 0);
  // prescription is asked for when the customer orders lenses or a lens upgrade
  const needsRx = lens !== "none" || coatings.length > 0;
  const on = wishlist.includes(p.id);

  useEffect(() => {
    setViewingProduct({ productId: p.id, variantId: v.id, slug: p.slug, name: `${p.name} ${p.modelCode}`, colorName: v.colorName, price: p.price, colorHex: v.colorHex });
    return () => setViewingProduct(null);
  }, [p, v]);

  useEffect(() => {
    try {
      const pd = parseFloat(sessionStorage.getItem("tryon-pd") || "");
      if (pd > 45 && pd < 80) setEstPd(pd);
    } catch {}
  }, []);

  const preview: LensKind = sun && lens === "none" ? "sun" : (["clear", "ar", "bluecut", "photosun"].includes(lens) ? lens : "clear") as LensKind;
  const photos = v.images || [];
  // real photos go first (photo 1 = folded, photo 2 = open); a photo tab from another colour falls back
  useEffect(() => {
    setTab((t) => (typeof t === "number" ? (photos.length ? Math.min(t, photos.length - 1) : "3d") : t));
  }, [v.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = () => {
    setErr("");
    if (v.stock <= 0) return setErr("This colour is out of stock — pick another colour or ask us about restock.");
    const mode = needsRx ? rxMode : "none";
    if (mode === "form") {
      const e = validateRx(rx);
      if (e) return setErr(e);
    }
    if (mode === "upload" && !upload) return setErr("Please upload your prescription photo, or choose another option.");
    addToCart({
      variantId: v.id, productId: p.id, slug: p.slug, name: `${p.name} ${p.modelCode}`, colorName: v.colorName,
      colorHex: v.colorHex, accentHex: v.accentHex, finish: v.finish, shape: p.shape,
      spec: { lensWidth: p.lensWidth, lensHeight: p.lensHeight, bridge: p.bridge, templeLength: p.templeLength, frameWidth: p.frameWidth, material: p.material },
      sun, unitPrice: p.price, qty, lensCode: lens, lensName: lensOpt?.name || "Frame only", lensPrice,
      coatings, coatingNames: coatOpts.map((c) => c.name),
      rxMode: mode, rx: mode === "form" ? rx : undefined, rxUploadId: mode === "upload" ? upload?.id : undefined, rxUploadName: upload?.name,
    });
    (window as any).gtag?.("event", "add_to_cart", { currency: "USD", value: ((p.price + lensPrice) * qty) / 100, items: [{ item_id: v.sku, item_name: p.name, price: p.price / 100, quantity: qty }] });
  };

  const spec = useMemo(() => ({ ...p }), [p]);

  return (
    <div className="grid lg:grid-cols-[1.25fr_1fr] gap-10">
      {/* ---------- media ---------- */}
      <div className="lg:sticky lg:top-24 self-start">
        <div className="hero-card aspect-[4/3] overflow-hidden relative">
          <span className="p-sku z-10">{v.sku}</span>
          {tab === "3d" ? (
            <Viewer360 spec={spec} color={v.colorHex} accent={v.accentHex} finish={v.finish} modelUrl={v.modelUrl} lens={preview} />
          ) : typeof tab === "number" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[tab]} alt={`${p.name} ${v.colorName} photo ${tab + 1}`} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full grid place-items-center p-10">
              <FrameArt spec={p} color={v.colorHex} accent={v.accentHex} finish={v.finish} view={tab} sun={sun} className="w-[90%] drop-shadow-[0_30px_30px_rgba(10,36,99,.22)]" title={`${p.name} ${v.colorName}`} />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {photos.map((_, i) => (
            <button key={i} onClick={() => setTab(i)} className={`chip ${tab === i ? "!bg-[var(--navy)] !text-white !border-[var(--navy)]" : ""}`}>{PHOTO_LABELS[i] || `Photo ${i + 1}`}</button>
          ))}
          {(photos.length ? ([["3d", "360° 3D"]] as const) : ([["3d", "360° 3D"], ["front", "Front"], ["side", "Angle"]] as const)).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`chip ${tab === k ? "!bg-[var(--navy)] !text-white !border-[var(--navy)]" : ""}`}>
              {k === "3d" && <Icon name="cube" size={14} />} {l}
            </button>
          ))}
          <Link href={`/try-on?p=${p.slug}&v=${v.id}`} className="chip !border-[var(--blue)] !text-[var(--blue)] ml-auto"><Icon name="camera" size={14} /> Try on my face</Link>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-6 text-center">
          {[["Lens", p.lensWidth], ["Bridge", p.bridge], ["Temple", p.templeLength], ["Frame", p.frameWidth]].map(([l, n]) => (
            <div key={l} className="card-flat py-3">
              <div className="font-display text-2xl font-semibold text-[var(--navy)]">{n}</div>
              <div className="text-[11px] uppercase tracking-wider muted font-bold">{l} mm</div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- buy box ---------- */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="code-pill">{p.modelCode}</span>
          {p.isNew && <span className="tag tag-light">New</span>}
          {p.isBestseller && <span className="tag">Bestseller</span>}
        </div>
        <h1 className="h-section">{p.name}</h1>
        <p className="muted mt-1">{cap(p.shape)} · {p.material} · {cap(p.gender)} · {p.weightGrams} g</p>
        <div className="mt-4 text-2xl"><Price cents={p.price} strike={p.compareAt} /></div>
        {pricing.bundleTiers.some((t) => t.off > 0) && (
          <p className="text-sm text-[var(--ok)] font-semibold mt-1">{[...pricing.bundleTiers].sort((x, y) => x.qty - y.qty).filter((t) => t.off > 0).map((t) => `Buy ${t.qty} save ${Math.round(t.off * 100)}%`).join(" · ")}</p>
        )}

        <div className="mt-6">
          <div className="text-sm mb-2">Colour: <b>{v.colorName}</b> {v.stock > 0 ? <span className="text-[var(--ok)] ml-1">· In stock{v.stock < 5 ? ` (only ${v.stock} left)` : ""}</span> : <span className="text-[var(--bad)] ml-1">· Out of stock</span>}</div>
          <div className="flex gap-2.5 flex-wrap">
            {p.variants.map((x, i) => (
              <button key={x.id} aria-label={x.colorName} title={x.colorName} onClick={() => setVi(i)} className={`swatch !w-9 !h-9 ${i === vi ? "on" : ""} ${x.stock <= 0 ? "opacity-40" : ""}`} style={{ background: swatchBg(x) }} />
            ))}
          </div>
        </div>

        {/* lenses (only when lens types are switched on in Admin → Lens pricing) */}
        <div className="mt-8">
          {hasLensTypes && (
          <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-xl font-semibold text-[var(--navy)]">Choose lenses</h2>
            <Link href="/lenses" className="text-sm text-[var(--blue)] font-bold">Compare →</Link>
          </div>
          <div className="grid gap-2">
            {types.map((l) => (
              <label key={l.code} className={`check ${lens === l.code ? "on" : ""}`}>
                <input type="radio" name="lens" checked={lens === l.code} onChange={() => setLens(l.code)} className="mt-1" />
                <span className="flex-1">
                  <span className="flex justify-between font-bold text-sm"><span>{l.code === "none" && sun ? "Standard sun lenses (non-prescription)" : l.name}</span><span>{l.price ? "+" + usd(l.price) : "Included"}</span></span>
                  <span className="text-[13px] muted block mt-0.5">{l.code === "none" && sun ? "UV400 polarised lenses as shown." : l.description}</span>
                </span>
              </label>
            ))}
          </div>
          </>
          )}
          {coats.length > 0 && (
            <details className={`${hasLensTypes ? "mt-3" : ""} card-flat p-4`} open={coatings.length > 0 || undefined}>
              <summary className="font-bold text-sm cursor-pointer">Optional upgrades & coatings</summary>
              <div className="grid gap-2 mt-3">
                {coats.map((c) => (
                  <label key={c.code} className={`check ${coatings.includes(c.code) ? "on" : ""}`}>
                    <input type="checkbox" checked={coatings.includes(c.code)} onChange={(e) => setCoatings(e.target.checked ? [...coatings, c.code] : coatings.filter((x) => x !== c.code))} className="mt-1" />
                    <span className="flex-1 text-sm">
                      <span className="flex justify-between font-bold"><span>{c.name}</span><span>+{usd(c.price)}</span></span>
                      <span className="text-[13px] muted">{c.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* prescription */}
        {needsRx && (
          <div className="mt-8">
            <h2 className="font-display text-xl font-semibold mb-3 text-[var(--navy)]">Your prescription</h2>
            <div className="seg mb-4 flex-wrap">
              {([["form", "Enter now"], ["upload", "Upload photo"], ["later", "Send later"], ["none", "No prescription"]] as const).map(([k, l]) => (
                <button key={k} type="button" className={rxMode === k ? "on" : ""} onClick={() => setRxMode(k)}>{l}</button>
              ))}
            </div>
            {rxMode === "form" && <RxForm value={rx} onChange={setRx} estimatedPd={estPd} />}
            {rxMode === "upload" && <RxUpload current={upload?.name} onDone={(id, name) => setUpload({ id, name })} />}
            {rxMode === "later" && <p className="text-sm muted card-flat p-4">No problem — place your order now and email or chat us your prescription. We won’t cut lenses until it’s confirmed.</p>}
            {rxMode === "none" && <p className="text-sm muted card-flat p-4">Non-prescription (plano) lenses with the coating you chose — ideal for screen protection or style.</p>}
          </div>
        )}

        {/* add */}
        <div className="mt-8 card p-5">
          <div className="flex justify-between text-sm"><span>Frame</span><span>{usd(p.price)}</span></div>
          {lensPrice > 0 && <div className="flex justify-between text-sm mt-1"><span>Lenses & coatings</span><span>{usd(lensPrice)}</span></div>}
          <div className="flex justify-between items-baseline mt-2 pt-2 border-t border-[var(--line)]">
            <b>Per pair</b>
            <Price cents={p.price + lensPrice} className="text-xl" />
          </div>
          <div className="flex gap-3 mt-4">
            <div className="flex items-center border border-[var(--line)] rounded-full">
              <button className="px-3 py-2" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease"><Icon name="minus" size={14} /></button>
              <span className="w-7 text-center font-bold">{qty}</span>
              <button className="px-3 py-2" onClick={() => setQty(Math.min(20, qty + 1))} aria-label="Increase"><Icon name="plus" size={14} /></button>
            </div>
            <button className="btn btn-primary btn-lg flex-1" onClick={add} disabled={v.stock <= 0}>Add to bag</button>
            <button className={`icon-btn !w-[52px] !h-[52px] ${on ? "!text-[#e11d48]" : ""}`} onClick={() => toggleWish(p.id)} aria-label="Wishlist">
              <svg width="20" height="20" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8"><path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5c-2.2 4.6-9.2 9-9.2 9Z" /></svg>
            </button>
          </div>
          {err && <p className="err mt-3">{err}</p>}
          <button className="btn btn-outline w-full mt-3" onClick={() => window.dispatchEvent(new Event("open-chat"))}>
            <Icon name="chat" size={16} /> Ask the seller about this frame
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5 text-center text-[12.5px]">
          {[["truck", "DHL Express worldwide"], ["refresh", "14-day returns"], ["shield", "Secure PayPal checkout"]].map(([i, t]) => (
            <div key={t} className="card-flat py-3 px-2"><Icon name={i} className="mx-auto text-[var(--blue)]" /><div className="mt-1.5 font-semibold">{t}</div></div>
          ))}
        </div>

        <div className="mt-8 prose-x">
          <h2>About this frame</h2>
          <p>{p.description}</p>
          <p><b>Suits face shapes:</b> {p.faceShapes.map(cap).join(", ") || "Most"}</p>
          <p className="text-sm muted">{pricing.shippingNote}. Import duties may apply in your country.</p>
        </div>
      </div>
    </div>
  );
}
