// All prices are stored and charged in USD cents. Local currency is display-only.
export const usd = (cents: number) =>
  "US$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 });

export function formatIn(cents: number, currency: string, rate: number) {
  const amount = (cents / 100) * rate;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

// Country (ISO2) -> currency. Anything missing falls back to USD.
export const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD", CA: "CAD", GB: "GBP", AU: "AUD", NZ: "NZD", IN: "INR", BD: "BDT", PK: "PKR", LK: "LKR",
  NP: "NPR", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", OM: "OMR", BH: "BHD", JP: "JPY", CN: "CNY",
  HK: "HKD", SG: "SGD", MY: "MYR", TH: "THB", ID: "IDR", PH: "PHP", VN: "VND", KR: "KRW", TW: "TWD",
  CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", TR: "TRY",
  ZA: "ZAR", NG: "NGN", KE: "KES", EG: "EGP", MA: "MAD", BR: "BRL", MX: "MXN", AR: "ARS", CL: "CLP",
  CO: "COP", PE: "PEN", IL: "ILS", RU: "RUB", UA: "UAH",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", IE: "EUR", PT: "EUR",
  FI: "EUR", GR: "EUR", SK: "EUR", SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", HR: "EUR",
};

// Offline fallback rates (USD -> X). Live rates are fetched and cached by /api/fx.
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1, EUR: 0.92, GBP: 0.79, CAD: 1.36, AUD: 1.52, NZD: 1.66, INR: 83.5, BDT: 120, PKR: 280, AED: 3.67,
  SAR: 3.75, JPY: 150, CNY: 7.2, SGD: 1.35, MYR: 4.7, CHF: 0.89, SEK: 10.5, NOK: 10.7, DKK: 6.9, ZAR: 18.5,
  BRL: 5.1, MXN: 17.5, TRY: 32, KRW: 1350, HKD: 7.8, THB: 36, PHP: 56, IDR: 15800, QAR: 3.64, KWD: 0.31,
};

export const CURRENCIES = Array.from(new Set(["USD", ...Object.values(COUNTRY_CURRENCY)])).sort();
