import "server-only";
import { getSettings } from "./settings";
import type { Settings } from "./settings-shared";

// Shipping is managed by the store owner (no courier API): prices and delivery days per country
// are set in Admin → Store settings → Shipping. The courier is booked by hand and the tracking
// number is entered on the order.

export type ShipQuote = {
  kind: "intl" | "domestic";
  name: string;
  price: number; // cents
  daysMin: number; // total business days incl. processing
  daysMax: number;
  etaFrom: string; // ISO date
  etaTo: string;
  requiresId: boolean;
  idLabel: string;
};

type Ship = Settings["shipping"];

export function addBusinessDays(from: Date, days: number) {
  const d = new Date(from);
  let left = Math.max(0, Math.round(days));
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

export const formatEta = (fromIso: string, toIso: string) => {
  const f = (s: string) => new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  return fromIso.slice(0, 10) === toIso.slice(0, 10) ? f(fromIso) : `${f(fromIso)} – ${f(toIso)}`;
};

export function needsCustomsId(s: Ship, country: string) {
  return s.customsIdCountries.toUpperCase().split(/[\s,]+/).filter(Boolean).includes(country.toUpperCase());
}

export function quoteFor(s: Ship, country: string, frames: number, itemsTotal = 0, hasLenses = false, from = new Date()): ShipQuote {
  const domestic = country.toUpperCase() === s.fromCountry.toUpperCase();
  const extra = Math.max(0, frames - 1);
  let price: number, tMin: number, tMax: number, name: string;
  if (domestic) {
    name = s.domesticName;
    price = s.domesticPrice + extra * s.domesticExtraPerFrame;
    tMin = s.domesticDaysMin;
    tMax = s.domesticDaysMax;
  } else {
    const c = s.countries[country.toUpperCase()];
    name = s.courierName;
    price = (c?.price ?? s.intlPrice) + extra * s.intlExtraPerFrame;
    tMin = c?.daysMin ?? s.intlDaysMin;
    tMax = c?.daysMax ?? s.intlDaysMax;
  }
  if (s.freeOver > 0 && itemsTotal >= s.freeOver) price = 0;
  const lens = hasLenses ? s.lensExtraDays : 0;
  const daysMin = s.processingDaysMin + lens + tMin;
  const daysMax = Math.max(daysMin, s.processingDaysMax + lens + tMax);
  return {
    kind: domestic ? "domestic" : "intl",
    name,
    price: Math.max(0, price),
    daysMin,
    daysMax,
    etaFrom: addBusinessDays(from, daysMin).toISOString(),
    etaTo: addBusinessDays(from, daysMax).toISOString(),
    requiresId: !domestic && needsCustomsId(s, country),
    idLabel: s.customsIdLabel,
  };
}

export async function quoteShipping(country: string, frames: number, itemsTotal = 0, hasLenses = false) {
  return quoteFor((await getSettings()).shipping, country, frames, itemsTotal, hasLenses);
}

export const trackingUrl = (n: string) =>
  `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(n)}`;
