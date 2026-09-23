"use client";
import Link from "next/link";
import { useState } from "react";
import FrameArt from "./FrameArt";
import Icon from "./Icon";
import { Price, useStore } from "./Providers";
import { cap, ProductDTO } from "@/lib/types";
import { swatchBg } from "@/lib/finish";

export default function ProductCard({ p }: { p: ProductDTO }) {
  const [vi, setVi] = useState(0);
  const [view, setView] = useState<"front" | "side">("front");
  const { wishlist, toggleWish } = useStore();
  const v = p.variants[vi] ?? p.variants[0];
  const on = wishlist.includes(p.id);
  const img = v?.images?.[view === "front" ? 0 : 1] || v?.images?.[0];
  if (!v) return null; // a frame without colours is never shown

  return (
    <article className="p-card">
      <div className="p-media">
        <span className="p-sku z-10">{v?.sku}</span>
        <button className={`p-heart z-10 ${on ? "on" : ""}`} onClick={() => toggleWish(p.id)} aria-label={on ? "Remove from wishlist" : "Add to wishlist"}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8"><path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5c-2.2 4.6-9.2 9-9.2 9Z" /></svg>
        </button>
        <Link href={`/product/${p.slug}?v=${v?.id}`} className={img ? "absolute inset-0 block" : "w-[82%] block"} aria-label={`${p.name} ${p.modelCode}`}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={`${p.name} in ${v.colorName}`} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <FrameArt spec={p} color={v.colorHex} accent={v.accentHex} finish={v.finish} view={view} sun={p.category === "sunglasses"} className="w-full drop-shadow-[0_14px_14px_rgba(10,36,99,.18)]" title={`${p.name} in ${v.colorName}`} />
          )}
        </Link>
        <div className={`absolute bottom-3 right-3 seg ${v?.images?.length === 1 ? "hidden" : ""}`}>
          <button className={view === "front" ? "on" : ""} onClick={() => setView("front")}>{v?.images?.length ? "Folded" : "Front"}</button>
          <button className={view === "side" ? "on" : ""} onClick={() => setView("side")}>{v?.images?.length ? "Open" : "Angle"}</button>
        </div>
        {(p.isNew || p.compareAt) && (
          <span className="absolute bottom-3 left-3 tag tag-light">{p.compareAt ? "Sale" : "New"}</span>
        )}
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex justify-between items-start gap-2">
          <div>
            <Link href={`/product/${p.slug}?v=${v?.id}`} className="font-display text-[22px] font-semibold text-[var(--navy)] hover:text-[var(--blue)]">{p.name}</Link>
            <div className="text-[13px] muted">{cap(p.shape)} · {p.material}</div>
          </div>
          <span className="code-pill">{p.modelCode}</span>
        </div>
        <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Colour">
          {p.variants.map((x, i) => (
            <button
              key={x.id}
              role="radio"
              aria-checked={i === vi}
              aria-label={x.colorName}
              title={x.colorName}
              className={`swatch ${i === vi ? "on" : ""}`}
              style={{ background: swatchBg(x) }}
              onClick={() => setVi(i)}
            />
          ))}
        </div>
        <div className="text-[13px]">Colour: <b>{v?.colorName}</b>{v && v.stock === 0 && <span className="text-[var(--bad)] ml-2">Out of stock</span>}</div>
        <div className="flex items-center justify-between mt-auto pt-1">
          <Price cents={p.price} strike={p.compareAt} className="text-[17px]" />
          <Link href={`/product/${p.slug}?v=${v?.id}`} className="btn btn-primary btn-sm">Select</Link>
        </div>
        <Link href={`/try-on?p=${p.slug}&v=${v?.id}`} className="tryon-link">
          <span className="flex items-center gap-2"><Icon name="camera" size={16} /> Try it on virtually</span>
          <Icon name="arrow" size={16} />
        </Link>
      </div>
    </article>
  );
}
