import "server-only";
import { FALLBACK_RATES } from "./money";

let cache: { at: number; rates: Record<string, number> } | null = null;

export async function getRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < 12 * 3600_000) return cache.rates;
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 43200 } });
    const j = await r.json();
    if (j?.rates?.USD === 1) {
      cache = { at: Date.now(), rates: j.rates };
      return j.rates;
    }
  } catch {}
  return FALLBACK_RATES;
}
