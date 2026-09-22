"use client";
import { useSite } from "./Providers";

const ALT = { paypal: "PayPal", xtransfer: "XTransfer", dhl: "DHL Express" } as const;

/** Official partner logos (PayPal, XTransfer, DHL). Replace them any time in Admin → Store settings → Logos. */
export default function BrandLogo({ name, className = "h-6" }: { name: keyof typeof ALT; className?: string }) {
  const { branding } = useSite();
  const src = name === "paypal" ? branding.paypalLogo : name === "xtransfer" ? branding.xtransferLogo : branding.dhlLogo;
  if (!src) return <span className={`font-extrabold tracking-tight ${name === "dhl" ? "text-[#d40511]" : "text-[var(--navy)]"}`}>{ALT[name]}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={ALT[name]} className={`${className} w-auto object-contain`} loading="lazy" referrerPolicy="no-referrer" />;
}
