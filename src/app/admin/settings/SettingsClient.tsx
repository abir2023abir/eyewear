"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Settings } from "@/lib/settings-shared";
import { bankDetailsReal } from "@/lib/settings-shared";
import { COUNTRIES } from "@/lib/countries";

type Tab = "store" | "branding" | "home" | "pricing" | "payments" | "shipping" | "chat" | "email" | "marketing" | "policies" | "account";
const TABS: [Tab, string][] = [
  ["store", "Store & contact"],
  ["branding", "Logos"],
  ["home", "Homepage"],
  ["pricing", "Bundles"],
  ["payments", "Payments"],
  ["shipping", "Shipping & delivery"],
  ["chat", "Chat assistant"],
  ["email", "Email & alerts"],
  ["marketing", "Analytics & ads"],
  ["policies", "Policies"],
  ["account", "My login"],
];

const toUsd = (c: number) => (c / 100).toFixed(2);
const toCents = (v: string) => Math.max(0, Math.round((parseFloat(v) || 0) * 100));

export default function SettingsClient({ initial, secretState, myEmail }: { initial: Settings; secretState: Record<string, boolean>; myEmail: string }) {
  const router = useRouter();
  const [s, setS] = useState<Settings>(initial);
  const [secrets, setSecrets] = useState(secretState);
  const [tab, setTab] = useState<Tab>("store");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const h = window.location.hash.replace("#", "") as Tab;
    if (TABS.some(([t]) => t === h)) setTab(h);
  }, []);

  const set = <K extends keyof Settings>(sec: K, patch: Partial<Settings[K]>) => setS((x) => ({ ...x, [sec]: { ...x[sec], ...patch } }));

  const save = async (section: keyof Settings) => {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section, data: s[section] }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j.error || "Could not save" });
    setS(j.settings);
    setSecrets(j.secretState);
    setMsg({ ok: true, text: "Saved — the website is updated." });
    router.refresh();
  };

  const test = async (kind: "paypal" | "email", to?: string) => {
    setMsg({ ok: true, text: "Testing…" });
    const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: kind, to }) });
    const j = await r.json().catch(() => ({}));
    setMsg(j.ok ? { ok: true, text: kind === "paypal" ? `PayPal connected (${j.mode}).` : `Test email sent to ${to}.` } : { ok: false, text: j.error || "Test failed" });
  };

  const SaveBar = ({ section, extra }: { section: keyof Settings; extra?: React.ReactNode }) => (
    <div className="flex flex-wrap items-center gap-3 pt-5 mt-2 border-t border-[var(--line)]">
      <button className="btn btn-primary" disabled={busy} onClick={() => save(section)}>{busy ? "Saving…" : "Save changes"}</button>
      {extra}
    </div>
  );

  return (
    <div className="grid md:grid-cols-[200px_1fr] gap-6 items-start">
      <nav className="card p-2 grid gap-0.5 md:sticky md:top-6">
        {TABS.map(([t, l]) => (
          <button key={t} onClick={() => { setTab(t); setMsg(null); history.replaceState(null, "", `#${t}`); }} className={`text-left px-3 py-2 rounded-lg text-sm font-semibold ${tab === t ? "bg-[var(--sky)] text-[var(--blue)]" : "hover:bg-[var(--sky-2)]"}`}>{l}</button>
        ))}
      </nav>

      <div className="card p-6 grid gap-4">
        {msg && <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${msg.ok ? "bg-[#e3f7ec] text-[var(--ok)]" : "bg-[#fde8e8] text-[var(--bad)]"}`}>{msg.text}</div>}

        {tab === "store" && (
          <>
            <H t="Store & contact" d="Shown in the header, footer, emails, chat buttons and invoices." />
            <Grid>
              <F l="Store name"><input className="input" value={s.store.name} onChange={(e) => set("store", { name: e.target.value })} /></F>
              <F l="Tagline (under the logo)"><input className="input" value={s.store.tagline} onChange={(e) => set("store", { tagline: e.target.value })} /></F>
              <F l="Contact email"><input className="input" type="email" value={s.store.email} onChange={(e) => set("store", { email: e.target.value })} /></F>
              <F l="Phone (Call button)"><input className="input" value={s.store.phone} onChange={(e) => set("store", { phone: e.target.value })} /></F>
              <F l="WhatsApp number (with country code)" hint="e.g. 8613356180103"><input className="input" value={s.store.whatsapp} onChange={(e) => set("store", { whatsapp: e.target.value })} /></F>
              <F l="Facebook Messenger page name" hint="Leave blank to hide the Messenger button"><input className="input" value={s.store.messenger} onChange={(e) => set("store", { messenger: e.target.value })} /></F>
              <F l="Location / address (footer)" wide><input className="input" value={s.store.address} onChange={(e) => set("store", { address: e.target.value })} /></F>
              <F l="Store description (Google & footer)" wide><textarea className="textarea" rows={3} value={s.store.description} onChange={(e) => set("store", { description: e.target.value })} /></F>
            </Grid>
            <SaveBar section="store" />
          </>
        )}

        {tab === "home" && (
          <>
            <H t="Homepage" d="Hero text, the scrolling offer bar, and the FAQ." />
            <Grid>
              <F l="Hero badge"><input className="input" value={s.home.heroBadge} onChange={(e) => set("home", { heroBadge: e.target.value })} /></F>
              <F l="Hero title"><input className="input" value={s.home.heroTitle} onChange={(e) => set("home", { heroTitle: e.target.value })} /></F>
              <F l="Highlighted word (blue)"><input className="input" value={s.home.heroHighlight} onChange={(e) => set("home", { heroHighlight: e.target.value })} /></F>
              <F l="Title ending"><input className="input" value={s.home.heroTitleEnd} onChange={(e) => set("home", { heroTitleEnd: e.target.value })} /></F>
              <F l="Hero text" wide><textarea className="textarea" rows={3} value={s.home.heroSubtitle} onChange={(e) => set("home", { heroSubtitle: e.target.value })} /></F>
            </Grid>
            <div>
              <div className="label">Scrolling offer bar (one line each)</div>
              <textarea className="textarea" rows={5} value={s.home.ticker.join("\n")} onChange={(e) => set("home", { ticker: e.target.value.split("\n").slice(0, 12) })} />
            </div>
            <div>
              <div className="label">FAQ</div>
              <div className="grid gap-3">
                {s.home.faq.map((f, i) => (
                  <div key={i} className="card-flat p-3 grid gap-2">
                    <div className="flex gap-2">
                      <input className="input" placeholder="Question" value={f.q} onChange={(e) => set("home", { faq: s.home.faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)) })} />
                      <button className="btn btn-ghost !text-[var(--bad)]" onClick={() => set("home", { faq: s.home.faq.filter((_, j) => j !== i) })}>Remove</button>
                    </div>
                    <textarea className="textarea" rows={2} placeholder="Answer" value={f.a} onChange={(e) => set("home", { faq: s.home.faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)) })} />
                  </div>
                ))}
                <button className="btn btn-outline btn-sm w-fit" onClick={() => set("home", { faq: [...s.home.faq, { q: "", a: "" }] })}>+ Add question</button>
              </div>
            </div>
            <SaveBar section="home" />
          </>
        )}

        {tab === "pricing" && (
          <>
            <H t="Bundle discounts" d="Discount on every frame when the bag contains at least this many frames." />
            <div className="grid gap-2">
              {s.pricing.bundleTiers.map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span>From</span>
                  <input className="input !w-24" type="number" min={1} value={t.qty} onChange={(e) => set("pricing", { bundleTiers: s.pricing.bundleTiers.map((x, j) => (j === i ? { ...x, qty: Math.max(1, parseInt(e.target.value) || 1) } : x)) })} />
                  <span>frames →</span>
                  <input className="input !w-24" type="number" min={0} max={90} value={Math.round(t.off * 100)} onChange={(e) => set("pricing", { bundleTiers: s.pricing.bundleTiers.map((x, j) => (j === i ? { ...x, off: Math.min(90, Math.max(0, parseInt(e.target.value) || 0)) / 100 } : x)) })} />
                  <span>% off</span>
                  {s.pricing.bundleTiers.length > 1 && <button className="btn btn-ghost !text-[var(--bad)]" onClick={() => set("pricing", { bundleTiers: s.pricing.bundleTiers.filter((_, j) => j !== i) })}>Remove</button>}
                </div>
              ))}
              <button className="btn btn-outline btn-sm w-fit" onClick={() => set("pricing", { bundleTiers: [...s.pricing.bundleTiers, { qty: (s.pricing.bundleTiers.at(-1)?.qty || 1) + 1, off: 0 }] })}>+ Add tier</button>
            </div>
            <F l="Delivery note on product pages"><input className="input" value={s.pricing.shippingNote} onChange={(e) => set("pricing", { shippingNote: e.target.value })} /></F>
            <SaveBar section="pricing" />
          </>
        )}

        {tab === "payments" && (
          <>
            <H t="PayPal" d="developer.paypal.com → Apps & Credentials. Use Sandbox keys to test, Live keys to take real payments." />
            <Toggle label="Accept PayPal & cards" on={s.payments.paypalEnabled} set={(v) => set("payments", { paypalEnabled: v })} />
            <Grid>
              <F l="Mode"><select className="select" value={s.payments.paypalMode} onChange={(e) => set("payments", { paypalMode: e.target.value as "sandbox" | "live" })}><option value="sandbox">Sandbox (testing)</option><option value="live">Live (real money)</option></select></F>
              <F l="Client ID"><input className="input" value={s.payments.paypalClientId} onChange={(e) => set("payments", { paypalClientId: e.target.value })} /></F>
              <Secret l="Secret" saved={secrets["payments.paypalSecret"]} value={s.payments.paypalSecret} onChange={(v) => set("payments", { paypalSecret: v })} />
              <F l="Webhook ID" hint="PayPal app → Webhooks → add /api/paypal/webhook"><input className="input" value={s.payments.paypalWebhookId} onChange={(e) => set("payments", { paypalWebhookId: e.target.value })} /></F>
            </Grid>
            <H t="Bank transfer (XTransfer)" d="Shown to customers who choose bank transfer. They upload a receipt; you confirm it in Orders." />
            <Toggle label="Accept bank transfer" on={s.payments.xtransferEnabled} set={(v) => set("payments", { xtransferEnabled: v })} />
            {s.payments.xtransferEnabled && !bankDetailsReal(s.payments) && (
              <p className="rounded-xl bg-[#fff4f4] border border-[#f3c9c9] px-4 py-3 text-sm text-[var(--bad)] font-semibold">
                The bank name, account number or SWIFT below are still empty or examples, so bank transfer is hidden from customers. Enter your real XTransfer details and save.
              </p>
            )}
            <Grid>
              <F l="Beneficiary name"><input className="input" value={s.payments.xtransferBeneficiary} onChange={(e) => set("payments", { xtransferBeneficiary: e.target.value })} /></F>
              <F l="Bank name"><input className="input" value={s.payments.xtransferBank} onChange={(e) => set("payments", { xtransferBank: e.target.value })} /></F>
              <F l="Account number / IBAN"><input className="input" value={s.payments.xtransferAccount} onChange={(e) => set("payments", { xtransferAccount: e.target.value })} /></F>
              <F l="SWIFT / BIC"><input className="input" value={s.payments.xtransferSwift} onChange={(e) => set("payments", { xtransferSwift: e.target.value })} /></F>
              <F l="Note to customer" wide><input className="input" value={s.payments.xtransferNote} onChange={(e) => set("payments", { xtransferNote: e.target.value })} /></F>
            </Grid>
            <SaveBar section="payments" extra={<button className="btn btn-outline" onClick={() => test("paypal")}>Test PayPal connection</button>} />
          </>
        )}

        {tab === "shipping" && (
          <>
            <H t="Shipping & delivery" d="You book the courier yourself and paste the tracking number on the order. Customers see these prices and delivery estimates in the chat checkout." />
            <Grid>
              <F l="International courier name"><input className="input" value={s.shipping.courierName} onChange={(e) => set("shipping", { courierName: e.target.value })} /></F>
              <F l="Free shipping when the bag total is at least (US$)" hint="0 = never free"><input className="input" type="number" min={0} step="0.01" value={toUsd(s.shipping.freeOver)} onChange={(e) => set("shipping", { freeOver: toCents(e.target.value) })} /></F>
            </Grid>
            <CountryRates s={s} set={(p) => set("shipping", p)} />
            <H t="Delivery inside China" d="When the customer's country is the same as your ship-from country, this is used instead of DHL." />
            <Grid>
              <F l="Delivery name"><input className="input" value={s.shipping.domesticName} onChange={(e) => set("shipping", { domesticName: e.target.value })} /></F>
              <F l="Price, first frame (US$)"><input className="input" type="number" min={0} step="0.01" value={toUsd(s.shipping.domesticPrice)} onChange={(e) => set("shipping", { domesticPrice: toCents(e.target.value) })} /></F>
              <F l="Each extra frame (US$)"><input className="input" type="number" min={0} step="0.01" value={toUsd(s.shipping.domesticExtraPerFrame)} onChange={(e) => set("shipping", { domesticExtraPerFrame: toCents(e.target.value) })} /></F>
              <F l="Delivery days (min – max)"><DaysPair a={s.shipping.domesticDaysMin} b={s.shipping.domesticDaysMax} set={(x, y) => set("shipping", { domesticDaysMin: x, domesticDaysMax: y })} /></F>
            </Grid>
            <H t="Delivery time estimate" d="Estimated arrival = processing days + delivery days (business days, weekends skipped)." />
            <Grid>
              <F l="Processing before dispatch (min – max days)"><DaysPair a={s.shipping.processingDaysMin} b={s.shipping.processingDaysMax} set={(x, y) => set("shipping", { processingDaysMin: x, processingDaysMax: y })} /></F>
              <F l="Extra days when lens upgrades are ordered"><input className="input !w-28" type="number" min={0} value={s.shipping.lensExtraDays} onChange={(e) => set("shipping", { lensExtraDays: Math.max(0, parseInt(e.target.value) || 0) })} /></F>
            </Grid>
            <H t="Customs information" d="In these countries DHL needs the receiver's tax / ID number (e.g. Brazil CPF, Korea PCCC). The chat asks for it automatically." />
            <Grid>
              <F l="Countries that require an ID (codes, comma separated)" hint="e.g. BR,KR,CL,AR,PE,IN,ID,TR,TW"><input className="input" value={s.shipping.customsIdCountries} onChange={(e) => set("shipping", { customsIdCountries: e.target.value.toUpperCase() })} /></F>
              <F l="Field label shown to the customer"><input className="input" value={s.shipping.customsIdLabel} onChange={(e) => set("shipping", { customsIdLabel: e.target.value })} /></F>
            </Grid>
            <H t="Ship from" d="Used on invoices / packing slips. Orders to this country use the China delivery above." />
            <Grid>
              <F l="Company"><input className="input" value={s.shipping.fromCompany} onChange={(e) => set("shipping", { fromCompany: e.target.value })} /></F>
              <F l="Street address"><input className="input" placeholder="e.g. Building 3, 88 Industrial Road, Lucheng District" value={s.shipping.fromAddress} onChange={(e) => set("shipping", { fromAddress: e.target.value })} /></F>
              <F l="City"><input className="input" value={s.shipping.fromCity} onChange={(e) => set("shipping", { fromCity: e.target.value })} /></F>
              <F l="Postcode"><input className="input" value={s.shipping.fromPostcode} onChange={(e) => set("shipping", { fromPostcode: e.target.value })} /></F>
              <F l="Country"><select className="select" value={s.shipping.fromCountry} onChange={(e) => set("shipping", { fromCountry: e.target.value })}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></F>
              <F l="Phone"><input className="input" value={s.shipping.fromPhone} onChange={(e) => set("shipping", { fromPhone: e.target.value })} /></F>
              <F l="Email"><input className="input" value={s.shipping.fromEmail} onChange={(e) => set("shipping", { fromEmail: e.target.value })} /></F>
            </Grid>
            <SaveBar section="shipping" />
          </>
        )}

        {tab === "chat" && (
          <>
            <H t="Chat assistant" d="Automatic messages in the chat checkout. Placeholders: {name} {number} {eta}. You can still reply personally from the Chat inbox." />
            <Grid>
              <F l="Assistant name"><input className="input" value={s.chat.assistantName} onChange={(e) => set("chat", { assistantName: e.target.value })} /></F>
            </Grid>
            {([
              ["greeting", "Greeting after the order is placed"],
              ["shippingIntro", "Before the DHL delivery card (international)"],
              ["domesticIntro", "Before the China delivery card"],
              ["paymentIntro", "Payment question"],
              ["thanksPaid", "Thank-you after payment"],
              ["thanksTransfer", "After a bank-transfer receipt is uploaded"],
            ] as const).map(([k, l]) => (
              <F key={k} l={l} wide><textarea className="textarea" rows={2} value={s.chat[k]} onChange={(e) => set("chat", { [k]: e.target.value })} /></F>
            ))}
            <SaveBar section="chat" />
          </>
        )}

        {tab === "branding" && (
          <>
            <H t="Logos" d="Upload your own files or keep the official logos. Shown in the header, checkout, chat, order page and footer." />
            <div className="grid sm:grid-cols-2 gap-4">
              {([
                ["storeLogo", "Your store logo", "Leave empty to use the glasses icon + store name"],
                ["paypalLogo", "PayPal logo", ""],
                ["xtransferLogo", "XTransfer logo", ""],
                ["dhlLogo", "DHL logo", ""],
              ] as const).map(([k, l, hint]) => (
                <LogoField key={k} label={l} hint={hint} value={s.branding[k]} onChange={(v) => set("branding", { [k]: v })} onError={(t) => setMsg({ ok: false, text: t })} />
              ))}
            </div>
            <SaveBar section="branding" />
          </>
        )}

        {tab === "email" && <EmailTab s={s} set={(p) => set("email", p)} secrets={secrets} SaveBar={SaveBar} test={test} myEmail={myEmail} />}

        {tab === "marketing" && (
          <>
            <H t="Google Analytics & Google Ads" d="Paste the IDs — tracking starts automatically. Purchases are reported as conversions." />
            <Grid>
              <F l="GA4 Measurement ID" hint="G-XXXXXXXXXX"><input className="input" value={s.marketing.gaId} onChange={(e) => set("marketing", { gaId: e.target.value })} /></F>
              <F l="Google Ads ID" hint="AW-123456789"><input className="input" value={s.marketing.adsId} onChange={(e) => set("marketing", { adsId: e.target.value })} /></F>
              <F l="Purchase conversion label"><input className="input" value={s.marketing.adsPurchaseLabel} onChange={(e) => set("marketing", { adsPurchaseLabel: e.target.value })} /></F>
            </Grid>
            <SaveBar section="marketing" />
          </>
        )}

        {tab === "policies" && (
          <>
            <H t="Policy pages" d="Blank line = new paragraph · “## ” = heading · “- ” = bullet · **bold** · {store} = store name." />
            {(["shipping", "returns", "privacy", "terms"] as const).map((k) => (
              <F key={k} l={`${k[0].toUpperCase()}${k.slice(1)} policy`} wide>
                <textarea className="textarea font-mono text-[13px]" rows={10} value={s.policies[k]} onChange={(e) => set("policies", { [k]: e.target.value })} />
              </F>
            ))}
            <SaveBar section="policies" />
          </>
        )}

        {tab === "account" && <AccountTab myEmail={myEmail} />}
      </div>
    </div>
  );
}

function CountryRates({ s, set }: { s: Settings; set: (p: Partial<Settings["shipping"]>) => void }) {
  const [country, setCountry] = useState("US");
  const rows = Object.entries(s.shipping.countries).sort(([a], [b]) => a.localeCompare(b));
  const put = (c: string, patch: Partial<{ price: number; daysMin: number; daysMax: number }>) =>
    set({ countries: { ...s.shipping.countries, [c]: { ...s.shipping.countries[c], ...patch } } });
  return (
    <div className="card-flat p-4 grid gap-3">
      <div className="font-bold text-sm">International prices ({s.shipping.courierName})</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <F l="Default price, first frame (US$)"><input className="input" type="number" min={0} step="0.01" value={toUsd(s.shipping.intlPrice)} onChange={(e) => set({ intlPrice: toCents(e.target.value) })} /></F>
        <F l="Each extra frame (US$)"><input className="input" type="number" min={0} step="0.01" value={toUsd(s.shipping.intlExtraPerFrame)} onChange={(e) => set({ intlExtraPerFrame: toCents(e.target.value) })} /></F>
        <F l="Default delivery days (min – max)"><DaysPair a={s.shipping.intlDaysMin} b={s.shipping.intlDaysMax} set={(x, y) => set({ intlDaysMin: x, intlDaysMax: y })} /></F>
      </div>
      <div className="label !mb-0 mt-2">Country-specific prices & days (override the default)</div>
      <div className="overflow-x-auto">
        <table className="table min-w-[560px]">
          <thead><tr><th>Country</th><th>First frame US$</th><th>Delivery days</th><th></th></tr></thead>
          <tbody>
            {rows.map(([c, r]) => (
              <tr key={c}>
                <td className="text-sm font-semibold">{COUNTRIES.find(([k]) => k === c)?.[1] || c}</td>
                <td><input className="input !w-28 !py-1.5" type="number" min={0} step="0.01" value={toUsd(r.price)} onChange={(e) => put(c, { price: toCents(e.target.value) })} /></td>
                <td><DaysPair a={r.daysMin} b={r.daysMax} set={(x, y) => put(c, { daysMin: x, daysMax: y })} /></td>
                <td><button className="text-xs text-[var(--bad)] font-bold" onClick={() => { const n = { ...s.shipping.countries }; delete n[c]; set({ countries: n }); }}>Remove</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="muted text-sm">No country prices yet — every country uses the default.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 flex-wrap">
        <select className="select !w-56" value={country} onChange={(e) => setCountry(e.target.value)}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
        <button className="btn btn-outline btn-sm" onClick={() => set({ countries: { ...s.shipping.countries, [country]: s.shipping.countries[country] || { price: s.shipping.intlPrice, daysMin: s.shipping.intlDaysMin, daysMax: s.shipping.intlDaysMax } } })}>+ Add country</button>
      </div>
    </div>
  );
}

function DaysPair({ a, b, set }: { a: number; b: number; set: (a: number, b: number) => void }) {
  const n = (v: string) => Math.max(0, Math.min(90, parseInt(v) || 0));
  return (
    <span className="flex items-center gap-2 text-sm">
      <input className="input !w-20 !py-1.5" type="number" min={0} value={a} onChange={(e) => { const x = n(e.target.value); set(x, Math.max(x, b)); }} />
      –
      <input className="input !w-20 !py-1.5" type="number" min={0} value={b} onChange={(e) => set(a, Math.max(a, n(e.target.value)))} />
      <span className="muted">days</span>
    </span>
  );
}

function LogoField({ label, hint, value, onChange, onError }: { label: string; hint?: string; value: string; onChange: (v: string) => void; onError: (t: string) => void }) {
  const [busy, setBusy] = useState(false);
  const upload = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("kind", "image");
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return onError(j.error || "Upload failed");
    onChange(j.url);
  };
  return (
    <div className="card-flat p-4 grid gap-2">
      <div className="label !mb-0">{label}</div>
      <div className="h-16 rounded-lg bg-[var(--sky-2)] grid place-items-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt={label} className="max-h-12 max-w-[80%] object-contain" /> : <span className="text-xs muted">No logo</span>}
      </div>
      <div className="flex gap-2 flex-wrap">
        <label className="btn btn-outline btn-sm cursor-pointer">{busy ? "Uploading…" : "Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
        {value && <button className="btn btn-ghost btn-sm !text-[var(--bad)]" onClick={() => onChange("")}>Remove</button>}
      </div>
      <input className="input !py-1.5 text-xs" placeholder="…or paste an https:// image link" value={value} onChange={(e) => onChange(e.target.value.trim())} />
      {hint && <div className="text-xs muted">{hint}</div>}
    </div>
  );
}

function EmailTab({ s, set, secrets, SaveBar, test, myEmail }: { s: Settings; set: (p: Partial<Settings["email"]>) => void; secrets: Record<string, boolean>; SaveBar: (p: { section: keyof Settings; extra?: React.ReactNode }) => React.ReactElement; test: (k: "email", to: string) => void; myEmail: string }) {
  const [to, setTo] = useState(myEmail);
  return (
    <>
      <H t="Sending email (SMTP)" d="Order confirmations, receipts, shipping emails and chat replies. For Gmail: smtp.gmail.com, port 465, your Gmail address and an App Password." />
      <Grid>
        <F l="SMTP host"><input className="input" value={s.email.smtpHost} onChange={(e) => set({ smtpHost: e.target.value })} placeholder="smtp.gmail.com" /></F>
        <F l="Port"><input className="input" type="number" value={s.email.smtpPort} onChange={(e) => set({ smtpPort: parseInt(e.target.value) || 587 })} /></F>
        <F l="Username"><input className="input" value={s.email.smtpUser} onChange={(e) => set({ smtpUser: e.target.value })} /></F>
        <Secret l="Password / App password" saved={secrets["email.smtpPass"]} value={s.email.smtpPass} onChange={(v) => set({ smtpPass: v })} />
        <F l="Send as" wide><input className="input" value={s.email.mailFrom} onChange={(e) => set({ mailFrom: e.target.value })} placeholder="Store name <you@example.com>" /></F>
      </Grid>
      <H t="Seller alerts" d="New orders, bank-transfer receipts and chat messages while you’re offline." />
      <Grid>
        <F l="Alert email"><input className="input" value={s.email.sellerAlertEmail} onChange={(e) => set({ sellerAlertEmail: e.target.value })} /></F>
        <F l="WhatsApp alerts via CallMeBot — phone" hint="callmebot.com (free)"><input className="input" value={s.email.callmebotPhone} onChange={(e) => set({ callmebotPhone: e.target.value })} /></F>
        <Secret l="CallMeBot API key" saved={secrets["email.callmebotKey"]} value={s.email.callmebotKey} onChange={(v) => set({ callmebotKey: v })} />
      </Grid>
      <SaveBar
        section="email"
        extra={
          <span className="flex gap-2 items-center">
            <input className="input !w-56" value={to} onChange={(e) => setTo(e.target.value)} placeholder="send test to…" />
            <button className="btn btn-outline" onClick={() => test("email", to)}>Send test email</button>
          </span>
        }
      />
    </>
  );
}

function AccountTab({ myEmail }: { myEmail: string }) {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const submit = async () => {
    setMsg(null);
    if (f.next !== f.confirm) return setMsg({ ok: false, text: "New passwords don’t match." });
    const r = await fetch("/api/admin/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: f.current, next: f.next }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg({ ok: false, text: j.error || "Could not change password" });
    setMsg({ ok: true, text: "Password changed. Other devices have been signed out." });
    setF({ current: "", next: "", confirm: "" });
    router.refresh();
  };
  return (
    <>
      <H t="My admin login" d={`Signed in as ${myEmail}. Changing your password signs out every other device.`} />
      {msg && <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${msg.ok ? "bg-[#e3f7ec] text-[var(--ok)]" : "bg-[#fde8e8] text-[var(--bad)]"}`}>{msg.text}</div>}
      <div className="grid gap-3 max-w-sm">
        <F l="Current password"><input className="input" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></F>
        <F l="New password (min 10 characters)"><input className="input" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></F>
        <F l="Repeat new password"><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></F>
        <button className="btn btn-primary w-fit" onClick={submit} disabled={!f.current || f.next.length < 10}>Change password</button>
      </div>
    </>
  );
}

function H({ t, d }: { t: string; d?: string }) {
  return (
    <div className="pt-2">
      <div className="font-display text-xl font-semibold text-[var(--navy)]">{t}</div>
      {d && <p className="text-sm muted mt-0.5">{d}</p>}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-4">{children}</div>;
}
function F({ l, hint, wide, children }: { l: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label">{l}</label>
      {children}
      {hint && <div className="text-xs muted mt-1">{hint}</div>}
    </div>
  );
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm font-semibold cursor-pointer w-fit">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="w-4 h-4" /> {label}
    </label>
  );
}
function Secret({ l, saved, value, onChange }: { l: string; saved?: boolean; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{l}</label>
      <input className="input" type="password" autoComplete="new-password" value={value === "__clear__" ? "" : value} placeholder={value === "__clear__" ? "Will be removed on save" : saved ? "•••••••• saved — type to replace" : "Not set"} onChange={(e) => onChange(e.target.value)} />
      {saved && value !== "__clear__" && <button type="button" className="text-xs text-[var(--bad)] font-bold mt-1" onClick={() => onChange("__clear__")}>Remove saved value</button>}
    </div>
  );
}
