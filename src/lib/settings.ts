import "server-only";
import { db } from "./db";
import { DEFAULT_POLICIES } from "./policies-default";
import type { PublicSettings, Settings } from "./settings-shared";
import { SECRET_FIELDS, bankReady, paypalReady } from "./settings-shared";

const env = (k: string, fb = "") => process.env[k] ?? fb;

/** Defaults come from .env (so an existing .env keeps working); anything saved in the admin panel overrides them. */
export function defaultSettings(): Settings {
  return {
    store: {
      name: "Wenzhou Kangjing Shopy",
      tagline: "See the world clearly",
      description: "Optical frames and sunglasses shipped worldwide by DHL Express from Wenzhou, China. Try every frame on in 3D with your camera before you buy.",
      email: env("NEXT_PUBLIC_CONTACT_EMAIL", "forevereyewear54@gmail.com"),
      phone: env("NEXT_PUBLIC_PHONE", "+86 133 5618 0103"),
      whatsapp: env("NEXT_PUBLIC_WHATSAPP", "8613356180103"),
      messenger: env("NEXT_PUBLIC_MESSENGER"),
      address: "Wenzhou, China",
    },
    home: {
      ticker: [
        "WORLDWIDE DHL EXPRESS DELIVERY",
        "BUY 2 SAVE 10% · BUY 3 SAVE 15% · BUY 5 SAVE 25%",
        "3D VIRTUAL TRY-ON ON EVERY FRAME",
        "PREMIUM LENS UPGRADES & COATINGS",
        "PAY WITH PAYPAL OR BANK TRANSFER",
      ],
      heroTitle: "Eyewear that fits your face —",
      heroHighlight: "anywhere",
      heroTitleEnd: "in the world.",
      heroSubtitle: "Featherlight frames with spring hinges, prescription lenses cut to order, and a 3D try-on studio that shows you exactly how each pair looks and fits — before you buy.",
      heroBadge: "New season · shipping worldwide",
      heroImage: "",
      faq: [
        { q: "Can I get prescription lenses?", a: "Yes. Every optical frame can be fitted with single-vision lenses cut to your prescription. Enter SPH, CYL, AXIS and PD for each eye at checkout, upload a photo of your prescription, or send it to us after ordering — we never cut lenses until your prescription is confirmed." },
        { q: "How does the virtual try-on work?", a: "Open the try-on studio and allow camera access. The frame locks onto your face automatically and follows your head in 3D. It also measures your face width to show whether a frame fits, and detects your face shape to suggest styles. Everything runs on your own device — no images are uploaded or stored." },
        { q: "How does bundle pricing work?", a: "Mix any models and colours. 2 frames save 10%, 3 frames save 15% and 5 or more save 25% on all frames in your bag. Lenses and shipping are added on top." },
        { q: "Where do you ship from and how long does it take?", a: "We ship from Wenzhou, China, worldwide with DHL Express, door to door, usually in 3–6 business days after dispatch. Live DHL rates for your country are shown at checkout." },
        { q: "Will I pay customs or import duty?", a: "Orders ship DAP (Delivered At Place). Depending on your country, DHL may collect import duty or tax on delivery. These are set by your local customs office and are not included in our prices." },
        { q: "How can I pay?", a: "PayPal (card or PayPal balance — instant confirmation) or international bank transfer via XTransfer. For bank transfers you upload your payment receipt and we confirm within one business day." },
        { q: "What if the frame doesn’t suit me?", a: "Unworn frames can be returned or exchanged within 14 days of delivery. Prescription lenses are made just for you, so those are non-refundable unless they are faulty." },
      ],
    },
    pricing: {
      bundleTiers: [
        { qty: 1, off: 0 },
        { qty: 2, off: 0.1 },
        { qty: 3, off: 0.15 },
        { qty: 5, off: 0.25 },
      ],
      shippingNote: "DHL Express door-to-door in 3–6 business days",
    },
    payments: {
      paypalEnabled: true,
      paypalMode: env("PAYPAL_ENV") === "live" ? "live" : "sandbox",
      paypalClientId: env("NEXT_PUBLIC_PAYPAL_CLIENT_ID"),
      paypalSecret: env("PAYPAL_CLIENT_SECRET"),
      paypalWebhookId: env("PAYPAL_WEBHOOK_ID"),
      xtransferEnabled: true,
      xtransferBeneficiary: env("XTRANSFER_BENEFICIARY", "Wenzhou Kangjing Shopy"),
      xtransferBank: env("XTRANSFER_BANK"),
      xtransferAccount: env("XTRANSFER_ACCOUNT"),
      xtransferSwift: env("XTRANSFER_SWIFT"),
      xtransferNote: env("XTRANSFER_NOTE", "Use your order number as the payment reference."),
    },
    shipping: {
      courierName: "DHL Express",
      intlPrice: 3500,
      intlExtraPerFrame: 500,
      intlDaysMin: 4,
      intlDaysMax: 7,
      countries: {
        US: { price: 3500, daysMin: 4, daysMax: 7 },
        GB: { price: 3300, daysMin: 4, daysMax: 6 },
        AU: { price: 2800, daysMin: 3, daysMax: 6 },
        HK: { price: 1900, daysMin: 2, daysMax: 3 },
      },
      domesticName: "Express courier (China)",
      domesticPrice: 0,
      domesticExtraPerFrame: 0,
      domesticDaysMin: 1,
      domesticDaysMax: 3,
      processingDaysMin: 1,
      processingDaysMax: 2,
      lensExtraDays: 3,
      freeOver: 0,
      customsIdCountries: "BR,KR,CL,AR,PE,IN,ID,TR,TW",
      customsIdLabel: "Tax / ID number for customs",
      fromCompany: env("SHIP_FROM_COMPANY", "Wenzhou Kangjing Shopy"),
      fromAddress: /^TODO/i.test(env("SHIP_FROM_ADDRESS")) ? "" : env("SHIP_FROM_ADDRESS"), // placeholder text never counts as an address
      fromCity: env("SHIP_FROM_CITY", "Wenzhou"),
      fromPostcode: env("SHIP_FROM_POSTCODE", "325000"),
      fromCountry: env("SHIP_FROM_COUNTRY", "CN"),
      fromPhone: env("SHIP_FROM_PHONE", "+8613356180103"),
      fromEmail: env("SHIP_FROM_EMAIL", "forevereyewear54@gmail.com"),
    },
    chat: {
      assistantName: "Order assistant",
      greeting: "Thank you, {name}! Your order {number} is reserved. I’ll help you finish it right here — it only takes a minute.",
      shippingIntro: "Your order ships from our factory in Wenzhou, China by DHL Express. Please check the delivery details DHL needs for customs:",
      domesticIntro: "Your order will be delivered within China by express courier:",
      paymentIntro: "How would you like to pay?",
      thanksPaid: "Payment received — thank you! Order {number} is confirmed. Estimated delivery: {eta}. We’ll send your tracking number here and by email.",
      thanksTransfer: "Thank you! We’ve received your transfer receipt for order {number}. Our team will confirm it within 1 business day and let you know here and by email.",
    },
    branding: {
      storeLogo: "",
      paypalLogo: "https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-color.svg",
      xtransferLogo: "https://static.xtransfer.com/BOSS/cms/2026-09-07/PICTURE/1e3b34428223422bb8325e082b5bc526.png",
      dhlLogo: "https://www.dhl.com/content/dam/dhl/global/core/images/logos/dhl-logo.svg",
    },
    email: {
      smtpHost: env("SMTP_HOST"),
      smtpPort: Number(env("SMTP_PORT", "587")) || 587,
      smtpUser: env("SMTP_USER"),
      smtpPass: env("SMTP_PASS"),
      mailFrom: env("MAIL_FROM", "Wenzhou Kangjing Shopy <forevereyewear54@gmail.com>"),
      sellerAlertEmail: env("SELLER_ALERT_EMAIL", "forevereyewear54@gmail.com"),
      callmebotPhone: env("CALLMEBOT_PHONE"),
      callmebotKey: env("CALLMEBOT_APIKEY"),
    },
    marketing: {
      gaId: env("NEXT_PUBLIC_GA_ID"),
      adsId: env("NEXT_PUBLIC_GADS_ID"),
      adsPurchaseLabel: env("NEXT_PUBLIC_GADS_PURCHASE_LABEL"),
    },
    policies: DEFAULT_POLICIES,
  };
}

const KEY = "storeSettings";
let cache: { at: number; value: Settings } | null = null;

const RECORD_KEYS = new Set(["countries"]);

function deepMerge<T>(base: T, over: unknown, allowNew = false): T {
  if (!over || typeof over !== "object" || Array.isArray(over)) return base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const b = (base as any)?.[k];
    if (v === undefined || v === null) continue;
    if (RECORD_KEYS.has(k)) {
      if (typeof v === "object" && !Array.isArray(v)) out[k] = v;
    } else if (b === undefined) {
      if (allowNew) out[k] = v;
    } else if (b && typeof b === "object" && !Array.isArray(b) && typeof v === "object" && !Array.isArray(v)) out[k] = deepMerge(b, v, allowNew);
    else if (typeof b === typeof v || (Array.isArray(b) && Array.isArray(v))) out[k] = v;
  }
  return out;
}

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 15_000) return cache.value;
  let saved: unknown = null;
  try {
    const row = await db.setting.findUnique({ where: { key: KEY } });
    saved = row ? JSON.parse(row.value) : null;
  } catch (e) {
    console.error("[settings] could not load, using defaults", e);
  }
  const value = deepMerge(defaultSettings(), saved);
  cache = { at: Date.now(), value };
  return value;
}

/** Saves a partial settings object. Secret fields left blank keep their stored value. */
export async function saveSettings(patch: Partial<Settings>) {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  const stored = row ? JSON.parse(row.value) : {};
  const next: any = deepMerge(stored, patch, true);
  // blank secret = keep existing
  for (const path of SECRET_FIELDS) {
    const [sec, field] = path.split(".");
    const incoming = (patch as any)?.[sec]?.[field];
    if (incoming === "__clear__") next[sec][field] = "";
    else if (incoming === "" || incoming === undefined) {
      if (stored?.[sec]?.[field] !== undefined) next[sec][field] = stored[sec][field];
      else if (next[sec]) delete next[sec][field];
    }
  }
  await db.setting.upsert({ where: { key: KEY }, update: { value: JSON.stringify(next) }, create: { key: KEY, value: JSON.stringify(next) } });
  cache = null;
}

export function toPublic(s: Settings): PublicSettings {
  return {
    store: s.store,
    home: s.home,
    pricing: s.pricing,
    payments: { paypalEnabled: paypalReady(s.payments), paypalClientId: s.payments.paypalClientId, xtransferEnabled: bankReady(s.payments) },
    branding: s.branding,
    shipFromCountry: s.shipping.fromCountry,
  };
}

/** Settings for the admin form: secrets replaced by a "saved" marker, never the real value. */
export function forAdmin(s: Settings) {
  const copy: any = JSON.parse(JSON.stringify(s));
  const secretState: Record<string, boolean> = {};
  for (const path of SECRET_FIELDS) {
    const [sec, field] = path.split(".");
    secretState[path] = !!copy[sec][field];
    copy[sec][field] = "";
  }
  return { settings: copy as Settings, secretState };
}
