import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { forAdmin, getSettings, saveSettings } from "@/lib/settings";
import { testPaypal } from "@/lib/paypal";
import { sendTestMail } from "@/lib/mail";
import { COUNTRIES } from "@/lib/countries";

const str = (max: number) => z.string().trim().max(max);
const cents = z.number().int().min(0).max(10_000_000);
const secret = z.string().max(500); // "" = keep, "__clear__" = remove
const days = z.number().int().min(0).max(90);
// uploaded file (/api/files/…) or an https image URL
const logo = z.string().trim().max(500).refine((v) => v === "" || /^\/api\/files\/[a-z0-9]+$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v), "Use an uploaded image or an https:// image link");

const SECTIONS = {
  store: z.object({
    name: str(80).min(1), tagline: str(80), description: str(400), email: z.string().trim().email().max(200),
    phone: str(40), whatsapp: z.string().trim().regex(/^\+?[\d\s-]{0,20}$/, "WhatsApp number: digits only"), messenger: str(80), address: str(200),
  }),
  home: z.object({
    ticker: z.array(str(120)).max(12),
    heroTitle: str(120), heroHighlight: str(60), heroTitleEnd: str(80), heroSubtitle: str(400), heroBadge: str(80),
    heroImage: z.string().trim().max(200).refine((v) => v === "" || /^\/api\/files\/[a-z0-9]+$/.test(v), "Upload the hero photo here"),
    faq: z.array(z.object({ q: str(200), a: str(2000) })).max(30),
  }),
  pricing: z.object({
    bundleTiers: z.array(z.object({ qty: z.number().int().min(1).max(100), off: z.number().min(0).max(0.9) })).min(1).max(8),
    shippingNote: str(160),
  }),
  payments: z.object({
    paypalEnabled: z.boolean(), paypalMode: z.enum(["sandbox", "live"]), paypalClientId: str(200), paypalSecret: secret, paypalWebhookId: str(100),
    xtransferEnabled: z.boolean(), xtransferBeneficiary: str(120), xtransferBank: str(160), xtransferAccount: str(80), xtransferSwift: str(20), xtransferNote: str(300),
  }),
  shipping: z.object({
    courierName: str(60).min(1), intlPrice: cents, intlExtraPerFrame: cents, intlDaysMin: days, intlDaysMax: days,
    countries: z.record(z.string().length(2).refine((c) => COUNTRIES.some(([k]) => k === c), "Unknown country code"), z.object({ price: cents, daysMin: days, daysMax: days })),
    domesticName: str(80), domesticPrice: cents, domesticExtraPerFrame: cents, domesticDaysMin: days, domesticDaysMax: days,
    processingDaysMin: days, processingDaysMax: days, lensExtraDays: days, freeOver: cents,
    customsIdCountries: z.string().trim().max(300).regex(/^[A-Za-z,\s]*$/, "Country codes separated by commas, e.g. BR,KR"), customsIdLabel: str(80),
    fromCompany: str(120), fromAddress: str(200), fromCity: str(80), fromPostcode: str(20), fromCountry: z.string().length(2), fromPhone: str(40), fromEmail: z.string().trim().max(200),
  }),
  chat: z.object({
    assistantName: str(60).min(1), greeting: str(500), shippingIntro: str(500), domesticIntro: str(500), paymentIntro: str(300), thanksPaid: str(600), thanksTransfer: str(600),
  }),
  branding: z.object({ storeLogo: logo, paypalLogo: logo, xtransferLogo: logo, dhlLogo: logo }),
  email: z.object({
    smtpHost: str(200), smtpPort: z.number().int().min(1).max(65535), smtpUser: str(200), smtpPass: secret, mailFrom: str(200).refine((v) => !/[\r\n]/.test(v), "No line breaks allowed"),
    sellerAlertEmail: z.string().trim().max(200).refine((v) => !v || /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(v), "Enter one valid email address"), callmebotPhone: str(40), callmebotKey: secret,
  }),
  marketing: z.object({
    gaId: z.string().trim().regex(/^(G-[A-Z0-9]+)?$/i, "GA4 ID looks like G-XXXXXXX").max(40),
    adsId: z.string().trim().regex(/^(AW-[0-9]+)?$/i, "Google Ads ID looks like AW-123456789").max(40),
    adsPurchaseLabel: z.string().trim().regex(/^[A-Za-z0-9_-]*$/, "Letters, numbers, - and _ only").max(80),
  }),
  policies: z.object({ shipping: str(20000), returns: str(20000), privacy: str(20000), terms: str(20000) }),
} as const;

async function guard() {
  try {
    return await requireAdmin();
  } catch {
    return null;
  }
}

export async function GET() {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(forAdmin(await getSettings()));
}

export async function POST(req: Request) {
  if (!(await guard())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);

  if (body?.test) {
    if (body.test === "paypal") return NextResponse.json(await testPaypal());
    if (body.test === "email") {
      const to = z.string().email().safeParse(body.to);
      if (!to.success) return NextResponse.json({ ok: false, error: "Enter an email address to send the test to." });
      return NextResponse.json(await sendTestMail(to.data));
    }
    return NextResponse.json({ ok: false, error: "Unknown test" }, { status: 400 });
  }

  const section = body?.section as keyof typeof SECTIONS;
  const schema = SECTIONS[section];
  if (!schema) return NextResponse.json({ error: "Unknown settings section" }, { status: 400 });
  const p = schema.safeParse(body.data);
  if (!p.success) {
    const i = p.error.issues[0];
    return NextResponse.json({ error: `${i?.path.join(" › ") || section}: ${i?.message}` }, { status: 400 });
  }
  await saveSettings({ [section]: p.data } as never);
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, ...forAdmin(await getSettings()) });
}
