"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import FrameArt from "@/components/FrameArt";
import Icon from "@/components/Icon";
import { useSite, useStore } from "@/components/Providers";
import { COUNTRIES } from "@/lib/countries";
import { usd, COUNTRY_CURRENCY } from "@/lib/money";

type Quote = { kind: "intl" | "domestic"; name: string; price: number; daysMin: number; daysMax: number; etaFrom: string; etaTo: string; requiresId: boolean };
type Addr = { name: string; phone: string; line1: string; line2: string; city: string; state: string; postcode: string; country: string };
type QuoteView = { token: string; country: string; shipping: number; subtotal: number; bundleDiscount: number; total: number; lines: { name: string; colorName: string; lensName: string; qty: number; total: number }[] };

const fmtDay = (s: string) => new Date(s).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="container-x py-12 muted">Loading checkout…</div>}>
      <Checkout />
    </Suspense>
  );
}

function Checkout() {
  const { cart, totals, me, clearCart, local, refreshMe } = useStore();
  const { shipFromCountry } = useSite();
  const router = useRouter();
  const sp = useSearchParams();
  const quoteToken = sp.get("quote");
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [quoteErr, setQuoteErr] = useState("");
  const [email, setEmail] = useState("");
  const [addr, setAddr] = useState<Addr>({ name: "", phone: "", line1: "", line2: "", city: "", state: "", postcode: "", country: "" });
  const [saved, setSaved] = useState<(Addr & { id: string; label: string; isDefault: boolean })[]>([]);
  const [saveAddr, setSaveAddr] = useState(true);
  const [ship, setShip] = useState<Quote | null>(null);
  const [agree, setAgree] = useState(false);
  const [makeAcct, setMakeAcct] = useState(false);
  const [acctPw, setAcctPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!me) return;
    setEmail((e) => e || me.email);
    setAddr((a) => ({ ...a, name: a.name || me.name }));
    fetch("/api/account/addresses").then((r) => r.json()).then((j) => {
      setSaved(j.items || []);
      const def = (j.items || []).find((x: any) => x.isDefault) || j.items?.[0];
      if (def) setAddr((a) => (a.line1 ? a : { name: def.name, phone: def.phone, line1: def.line1, line2: def.line2, city: def.city, state: def.state, postcode: def.postcode, country: def.country }));
    }).catch(() => {});
  }, [me]);

  useEffect(() => {
    if (addr.country) return;
    const region = (navigator.language.split("-")[1] || "").toUpperCase();
    if (COUNTRIES.some(([c]) => c === region)) setAddr((a) => ({ ...a, country: region }));
  }, [addr.country]);

  useEffect(() => {
    if (!quoteToken) return;
    fetch(`/api/quotes/${encodeURIComponent(quoteToken)}`).then(async (r) => {
      const j = await r.json();
      if (!r.ok) return setQuoteErr(j.error || "This quote is no longer available.");
      setQuote(j.quote);
      setAddr((a) => ({ ...a, country: j.quote.country }));
    });
  }, [quoteToken]);

  const frames = quote ? quote.lines.reduce((s, l) => s + l.qty, 0) : totals.frames;
  const itemsTotal = quote ? quote.subtotal - quote.bundleDiscount : totals.total;
  const hasLenses = !quote && cart.some((c) => c.lensPrice > 0);

  // delivery estimate for the chosen country (final details are confirmed in the chat)
  useEffect(() => {
    if (!addr.country || frames === 0) return setShip(null);
    const id = setTimeout(async () => {
      const r = await fetch("/api/shipping/rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: addr.country, frames, itemsTotal, hasLenses }) }).then((r) => r.json()).catch(() => null);
      setShip(r?.quote || null);
    }, 300);
    return () => clearTimeout(id);
  }, [addr.country, frames, itemsTotal, hasLenses]);

  const shippingPrice = quote ? quote.shipping : ship?.price ?? 0;
  const grand = itemsTotal + shippingPrice;
  const intl = !!addr.country && addr.country !== shipFromCountry;

  const valid = useMemo(() => email.includes("@") && addr.name && addr.phone && addr.line1 && addr.city && addr.country && agree && (!makeAcct || !!me || acctPw.length >= 8), [email, addr, agree, makeAcct, acctPw, me]);

  const confirm = async () => {
    setErr("");
    if (!valid) return setErr(makeAcct && !me && acctPw.length < 8 ? "Choose an account password of at least 8 characters." : "Please complete the required fields and accept the terms.");
    setBusy(true);
    const r = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email, address: addr, saveAddress: !!me && saveAddr, quoteToken: quote?.token,
        items: quote ? [] : cart.map((c) => ({ variantId: c.variantId, qty: c.qty, lensCode: c.lensCode, coatings: c.coatings, rxMode: c.rxMode, rx: c.rx, rxUploadId: c.rxUploadId })),
        displayCurrency: COUNTRY_CURRENCY[addr.country] || "USD",
        ...(makeAcct && !me ? { createAccount: { password: acctPw } } : {}),
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Could not place the order. Please try again.");
    (window as any).gtag?.("event", "begin_checkout", { currency: "USD", value: grand / 100 });
    if (!quote) clearCart();
    if (makeAcct && !me) await refreshMe();
    router.push(`/order/${j.number}?t=${j.token}&chat=1`);
    // the order summary + delivery + payment steps are waiting in the chat
    window.dispatchEvent(new CustomEvent("open-chat", { detail: { checkout: true } }));
  };

  if (quoteToken && quoteErr) return <div className="container-x py-16 text-center"><p className="lead">{quoteErr}</p><Link href="/shop" className="btn btn-primary mt-4">Shop frames</Link></div>;
  if (!quoteToken && cart.length === 0) return <div className="container-x py-16 text-center"><p className="lead">Your bag is empty.</p><Link href="/shop" className="btn btn-primary mt-4">Shop frames</Link></div>;
  if (quoteToken && !quote) return <div className="container-x py-16 muted">Loading your quote…</div>;

  const set = (k: keyof Addr) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddr({ ...addr, [k]: e.target.value });

  return (
    <div className="container-x py-10">
      <ol className="flex flex-wrap items-center gap-2 text-sm mb-6">
        {["Bag", "Delivery address", "Confirm in chat", "Pay"].map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${i <= 1 ? "bg-[var(--navy)] text-white" : "bg-[var(--sky)] text-[var(--blue)]"}`}>{i + 1}</span>
            <span className={i <= 1 ? "font-bold" : "muted"}>{s}</span>
            {i < 3 && <span className="w-8 h-px bg-[var(--line)] mx-1" />}
          </li>
        ))}
      </ol>
      <h1 className="h-section mb-2">Checkout</h1>
      <p className="muted mb-8 flex items-center gap-2"><Icon name="lock" size={15} /> Enter your delivery details — then our order assistant confirms shipping and payment with you in the chat.</p>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8 items-start">
        <div className="grid gap-6">
          <section className="card p-6">
            <h2 className="font-display text-xl font-semibold text-[var(--navy)] mb-4">Contact & delivery address</h2>
            {!me && <p className="text-sm muted mb-4">Have an account? <Link href="/login?next=/checkout" className="text-[var(--blue)] font-bold">Sign in</Link> for saved addresses and prescriptions.</p>}
            {saved.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {saved.map((a) => (
                  <button key={a.id} className="chip hover:border-[var(--blue)]" onClick={() => setAddr({ name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postcode: a.postcode, country: quote ? addr.country : a.country })}>
                    {a.label}: {a.city}, {a.country}
                  </button>
                ))}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <F label="Email *"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></F>
              <F label="Phone with country code *"><input className="input" value={addr.phone} onChange={set("phone")} autoComplete="tel" placeholder="+1 555 000 0000" /></F>
              <F label="Full name *" wide><input className="input" value={addr.name} onChange={set("name")} autoComplete="name" /></F>
              <F label="Address line 1 *" wide><input className="input" value={addr.line1} onChange={set("line1")} autoComplete="address-line1" /></F>
              <F label="Address line 2" wide><input className="input" value={addr.line2} onChange={set("line2")} autoComplete="address-line2" /></F>
              <F label="City *"><input className="input" value={addr.city} onChange={set("city")} autoComplete="address-level2" /></F>
              <F label="State / region"><input className="input" value={addr.state} onChange={set("state")} autoComplete="address-level1" /></F>
              <F label="Postcode"><input className="input" value={addr.postcode} onChange={set("postcode")} autoComplete="postal-code" /></F>
              <F label="Country *">
                <select className="select" value={addr.country} onChange={set("country")} disabled={!!quote} autoComplete="country">
                  <option value="">Select country</option>
                  {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
                </select>
              </F>
            </div>
            {me && <label className="flex items-center gap-2 text-sm mt-4"><input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} /> Save this address to my account</label>}
            {!me && (
              <div className="mt-5 rounded-2xl bg-[var(--sky-2)] border border-[var(--line)] p-4">
                <label className="flex items-start gap-2 text-sm font-semibold cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={makeAcct} onChange={(e) => setMakeAcct(e.target.checked)} />
                  <span>Create an account <span className="font-normal muted">— track this order, download invoices, reorder and chat with us from any device.</span></span>
                </label>
                {makeAcct && (
                  <div className="mt-3 max-w-sm">
                    <label className="label">Choose a password *</label>
                    <input className="input" type="password" minLength={8} value={acctPw} onChange={(e) => setAcctPw(e.target.value)} autoComplete="new-password" />
                    <p className="text-xs muted mt-1">At least 8 characters. Your account uses the email above.</p>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="card p-6">
            <h2 className="font-display text-xl font-semibold text-[var(--navy)] mb-4">What happens next</h2>
            <ol className="grid gap-3 text-sm">
              {[
                ["cart", "Confirm your order", "Your order is reserved and the chat opens with your summary."],
                ["truck", intl ? "Confirm DHL Express delivery" : "Confirm delivery", intl ? "We show the DHL price and arrival date, and ask for the details customs needs." : "We show the delivery price and arrival date."],
                ["lock", "Pay securely in the chat", "Choose PayPal or XTransfer bank transfer — then you’ll get your receipt and confirmation."],
              ].map(([ic, t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="w-9 h-9 rounded-full bg-[var(--sky)] text-[var(--blue)] grid place-items-center shrink-0"><Icon name={ic} size={16} /></span>
                  <span><b className="block">{i + 1}. {t}</b><span className="muted">{d}</span></span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-[var(--line)]">
              <span className="text-xs muted font-bold uppercase tracking-wider">We accept</span>
              <span className="h-9 px-3 rounded-lg border border-[var(--line)] bg-white grid place-items-center"><BrandLogo name="paypal" className="h-5" /></span>
              <span className="h-9 px-3 rounded-lg border border-[var(--line)] bg-white grid place-items-center"><BrandLogo name="xtransfer" className="h-5" /></span>
              {intl && <><span className="text-xs muted font-bold uppercase tracking-wider ml-2">Ships with</span><span className="h-9 px-3 rounded-lg bg-[#ffcc00] grid place-items-center"><BrandLogo name="dhl" className="h-4" /></span></>}
            </div>
            {intl && (
              <div className="mt-4 rounded-xl bg-[#fff8e6] border border-[#f5dfa6] p-4 text-[13px] leading-relaxed">
                <b>Customs & import duty:</b> your order ships DAP from China. Your country’s customs may charge import duty or tax, collected by DHL on delivery — not included in our prices. <Link href="/policies/shipping" className="text-[var(--blue)] font-bold">Learn more</Link>
              </div>
            )}
            <label className="flex items-start gap-2 text-sm mt-5">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1" />
              <span>I agree to the <Link href="/policies/terms" className="text-[var(--blue)] font-bold" target="_blank">terms</Link> and <Link href="/policies/returns" className="text-[var(--blue)] font-bold" target="_blank">returns policy</Link>.</span>
            </label>
          </section>
        </div>

        <aside className="card p-6 grid gap-3 text-sm lg:sticky lg:top-24">
          <div className="font-display text-xl font-semibold text-[var(--navy)]">Order summary</div>
          {quote
            ? quote.lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-3"><span>{l.qty}× {l.name} <span className="muted">({l.colorName})</span></span><span className="font-semibold">{usd(l.total)}</span></div>
              ))
            : cart.map((c) => (
                <div key={c.key} className="flex gap-3 items-center">
                  <div className="w-16 h-11 rounded-lg bg-[var(--sky-2)] grid place-items-center shrink-0"><FrameArt spec={{ ...c.spec, shape: c.shape }} color={c.colorHex} accent={c.accentHex} finish={c.finish} sun={c.sun} className="w-full" /></div>
                  <div className="flex-1 min-w-0"><div className="font-semibold truncate">{c.qty}× {c.name}</div><div className="muted text-xs truncate">{c.colorName}{c.coatingNames.length ? ` · ${c.coatingNames.join(", ")}` : c.lensName !== "Frame only" ? ` · ${c.lensName}` : " · Frame only"}</div></div>
                  <div className="font-semibold">{usd((c.unitPrice + c.lensPrice) * c.qty)}</div>
                </div>
              ))}
          <div className="border-t border-[var(--line)] pt-3 grid gap-1.5">
            {!quote && <Row l={`Frames (${totals.frames})`} r={usd(totals.subtotal)} />}
            {(quote ? quote.bundleDiscount : totals.bundleDiscount) > 0 && <Row l="Bundle saving" r={"−" + usd(quote ? quote.bundleDiscount : totals.bundleDiscount)} className="text-[var(--ok)] font-semibold" />}
            {!quote && totals.lensTotal > 0 && <Row l="Upgrades" r={usd(totals.lensTotal)} />}
            <Row l={ship ? ship.name : "Shipping"} r={!addr.country ? "Select country" : ship ? (shippingPrice ? usd(shippingPrice) : "Free") : "…"} />
            {ship && <div className="text-xs muted -mt-0.5">Estimated arrival {fmtDay(ship.etaFrom)} – {fmtDay(ship.etaTo)}</div>}
          </div>
          <div className="flex justify-between items-baseline border-t border-[var(--line)] pt-3 text-base">
            <b>Total (USD)</b>
            <span className="text-right"><b className="text-xl">{usd(grand)}</b>{local(grand) && <span className="block text-xs muted">≈ {local(grand)}</span>}</span>
          </div>
          {err && <p className="err">{err}</p>}
          <button className="btn btn-primary btn-lg w-full" onClick={confirm} disabled={busy || !valid}>
            {busy ? "Reserving your order…" : <>Confirm order <Icon name="chat" size={16} /></>}
          </button>
          <p className="text-xs muted text-center">Next: confirm delivery & pay in the chat. No payment is taken yet.</p>
        </aside>
      </div>
    </div>
  );
}

function F({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
function Row({ l, r, className }: { l: string; r: string; className?: string }) {
  return <div className={`flex justify-between ${className || ""}`}><span>{l}</span><span>{r}</span></div>;
}
