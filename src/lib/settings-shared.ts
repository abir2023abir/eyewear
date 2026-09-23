// Types + the public subset of store settings. Safe to import from client components.

export type BundleTier = { qty: number; off: number }; // off = 0..0.9
export type FaqItem = { q: string; a: string };

export type PublicSettings = {
  store: {
    name: string;
    tagline: string;
    description: string;
    email: string;
    phone: string;
    whatsapp: string; // digits, for wa.me
    messenger: string;
    address: string;
  };
  home: {
    ticker: string[];
    heroTitle: string;
    heroHighlight: string;
    heroTitleEnd: string;
    heroSubtitle: string;
    heroBadge: string;
    heroImage: string; // uploaded photo for the homepage hero ("" = use the first featured frame)
    faq: FaqItem[];
  };
  pricing: { bundleTiers: BundleTier[]; shippingNote: string };
  payments: { paypalEnabled: boolean; paypalClientId: string; xtransferEnabled: boolean };
  branding: { storeLogo: string; paypalLogo: string; xtransferLogo: string; dhlLogo: string };
  shipFromCountry: string;
};

/** Delivery price + days for one destination country. */
export type CountryRate = { price: number; daysMin: number; daysMax: number };

export type Settings = Omit<PublicSettings, "shipFromCountry"> & {
  payments: PublicSettings["payments"] & {
    paypalMode: "sandbox" | "live";
    paypalSecret: string;
    paypalWebhookId: string;
    xtransferBeneficiary: string;
    xtransferBank: string;
    xtransferAccount: string;
    xtransferSwift: string;
    xtransferNote: string;
  };
  shipping: {
    courierName: string; // international courier shown to customers, e.g. "DHL Express"
    intlPrice: number; // cents, first frame, any country without its own price
    intlExtraPerFrame: number; // cents
    intlDaysMin: number; // transit business days
    intlDaysMax: number;
    countries: Record<string, CountryRate>; // ISO2 -> own price/days
    domesticName: string; // delivery inside the ship-from country (no DHL)
    domesticPrice: number;
    domesticExtraPerFrame: number;
    domesticDaysMin: number;
    domesticDaysMax: number;
    processingDaysMin: number; // before dispatch
    processingDaysMax: number;
    lensExtraDays: number; // added when lens upgrades are ordered
    freeOver: number; // cents; 0 = off
    customsIdCountries: string; // comma list of ISO2 where a tax/ID number is required
    customsIdLabel: string;
    fromCompany: string;
    fromAddress: string;
    fromCity: string;
    fromPostcode: string;
    fromCountry: string;
    fromPhone: string;
    fromEmail: string;
  };
  chat: {
    assistantName: string;
    greeting: string; // after the order card; {name} {number}
    shippingIntro: string; // before the DHL card
    domesticIntro: string;
    paymentIntro: string;
    thanksPaid: string; // {number} {eta}
    thanksTransfer: string;
  };
  email: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    mailFrom: string;
    sellerAlertEmail: string;
    callmebotPhone: string;
    callmebotKey: string;
  };
  marketing: { gaId: string; adsId: string; adsPurchaseLabel: string };
  policies: { shipping: string; returns: string; privacy: string; terms: string };
};

/** Fields never sent to the browser (admin sees only "saved" / "not set"). */
export const SECRET_FIELDS = [
  "payments.paypalSecret",
  "email.smtpPass",
  "email.callmebotKey",
] as const;

export const bundleOffFor = (tiers: BundleTier[], frames: number) => {
  let off = 0;
  for (const t of [...tiers].sort((a, b) => a.qty - b.qty)) if (frames >= t.qty) off = t.off;
  return off;
};

export const telHref = (p: string) => `tel:${p.replace(/[^\d+]/g, "")}`;
export const waLink = (digits: string, text?: string) =>
  `https://wa.me/${digits.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** PayPal can take payments only when it is switched on AND both API keys are filled in. */
export const paypalReady = (p: { paypalEnabled: boolean; paypalClientId?: string; paypalSecret?: string }) => !!(p.paypalEnabled && p.paypalClientId && p.paypalSecret);
/** Placeholder bank details (000…, XXX…, empty) must never be shown to customers. */
export const bankDetailsReal = (p: { xtransferAccount?: string; xtransferSwift?: string; xtransferBank?: string }) => {
  const acc = (p.xtransferAccount || "").replace(/s/g, ""), swift = (p.xtransferSwift || "").trim();
  return acc.length >= 5 && !/^0+$/.test(acc) && swift.length >= 8 && !/^X+$/i.test(swift) && !!(p.xtransferBank || "").trim();
};
/** Bank transfer is offered only when switched on AND real bank details are filled in. */
export const bankReady = (p: { xtransferEnabled: boolean; xtransferAccount?: string; xtransferSwift?: string; xtransferBank?: string }) => !!p.xtransferEnabled && bankDetailsReal(p);
