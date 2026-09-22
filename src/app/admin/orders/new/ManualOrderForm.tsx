"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { usd } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";

type Line = { variantId: string; label: string; basePrice: number; qty: number; lensCode: string; price: string };
type Preview = { subtotal: number; bundleDiscount: number; lensTotal: number; shipping: number; adjustment: number; total: number; stockIssues: string[] };

export default function ManualOrderForm({ lenses }: { lenses: { code: string; name: string; price: number }[] }) {
  const router = useRouter();
  const [c, setC] = useState({ email: "", name: "", phone: "", line1: "", line2: "", city: "", state: "", postcode: "", country: "" });
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductDTO[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [applyBundle, setApplyBundle] = useState(true);
  const [autoShip, setAutoShip] = useState(true);
  const [ship, setShip] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState<"paypal" | "xtransfer" | "cash" | "other">("paypal");
  const [markPaid, setMarkPaid] = useState(false);
  const [sendLink, setSendLink] = useState(true);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.length < 2) return setResults([]);
    const t = setTimeout(() => fetch(`/api/products?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((j) => setResults(j.items || [])).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => setPreview(null), [c, lines, applyBundle, autoShip, ship, discount]);

  const body = (extra: object) =>
    JSON.stringify({
      customer: c,
      items: lines.map((l) => ({ variantId: l.variantId, qty: l.qty, lensCode: l.lensCode, unitPrice: l.price.trim() === "" ? null : Math.round(parseFloat(l.price) * 100) })),
      applyBundle,
      shipping: autoShip ? null : Math.round((parseFloat(ship) || 0) * 100),
      adjustment: -Math.round((parseFloat(discount) || 0) * 100),
      paymentMethod: method,
      markPaid,
      sendPaymentLink: !markPaid && sendLink,
      note,
      ...extra,
    });

  const calc = async () => {
    setErr("");
    const r = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: body({ preview: true }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "Check the form");
    setPreview(j);
  };
  const create = async () => {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/admin/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: body({}) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Could not create order");
    router.push(`/admin/orders/${j.id}`);
  };
  const setField = (k: keyof typeof c) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setC({ ...c, [k]: e.target.value });

  return (
    <div className="grid gap-6">
      <section className="card p-6 grid gap-4">
        <div className="font-bold">1. Customer & delivery address</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="input" placeholder="Email *" type="email" value={c.email} onChange={setField("email")} />
          <input className="input" placeholder="Phone / WhatsApp *" value={c.phone} onChange={setField("phone")} />
          <input className="input sm:col-span-2" placeholder="Full name *" value={c.name} onChange={setField("name")} />
          <input className="input sm:col-span-2" placeholder="Address line 1 *" value={c.line1} onChange={setField("line1")} />
          <input className="input sm:col-span-2" placeholder="Address line 2" value={c.line2} onChange={setField("line2")} />
          <input className="input" placeholder="City *" value={c.city} onChange={setField("city")} />
          <input className="input" placeholder="State / region" value={c.state} onChange={setField("state")} />
          <input className="input" placeholder="Postcode" value={c.postcode} onChange={setField("postcode")} />
          <select className="select" value={c.country} onChange={setField("country")}>
            <option value="">Country *</option>
            {COUNTRIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </div>
      </section>

      <section className="card p-6 grid gap-4">
        <div className="font-bold">2. Frames</div>
        <input className="input" placeholder="Search frames by name or model number…" value={q} onChange={(e) => setQ(e.target.value)} />
        {results.length > 0 && (
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {results.flatMap((p) => p.variants.map((v) => (
              <button key={v.id} className="chip hover:border-[var(--blue)]" onClick={() => setLines([...lines, { variantId: v.id, label: `${p.name} ${p.modelCode} · ${v.colorName}`, basePrice: p.price, qty: 1, lensCode: "none", price: "" }])}>
                <span className="w-3.5 h-3.5 rounded-full" style={{ background: v.colorHex }} /> {p.name} {p.modelCode} · {v.colorName} <span className="muted">({usd(p.price)}, stock {v.stock})</span>
              </button>
            )))}
          </div>
        )}
        {lines.length > 0 && (
          <div className="overflow-x-auto">
            <table className="table min-w-[680px]">
              <thead><tr><th>Frame</th><th>Qty</th><th>Lens</th><th>Unit price (US$)</th><th></th></tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="text-sm">{l.label}</td>
                    <td><input type="number" min={1} className="input !w-20 !py-1.5" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: Math.max(1, parseInt(e.target.value) || 1) } : x)))} /></td>
                    <td>
                      <select className="select !py-1.5 !w-48" value={l.lensCode} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, lensCode: e.target.value } : x)))}>
                        {lenses.map((le) => <option key={le.code} value={le.code}>{le.name}{le.price ? ` (+${usd(le.price)})` : ""}</option>)}
                      </select>
                    </td>
                    <td><input className="input !w-32 !py-1.5" placeholder={(l.basePrice / 100).toFixed(2)} value={l.price} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/[^0-9.]/g, "") } : x)))} /></td>
                    <td><button className="text-[var(--bad)] text-xs font-bold" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs muted mt-2">Leave unit price blank to use the normal price.</p>
          </div>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={applyBundle} onChange={(e) => setApplyBundle(e.target.checked)} /> Apply bundle discount automatically</label>
      </section>

      <section className="card p-6 grid gap-4">
        <div className="font-bold">3. Shipping, discount & payment</div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={autoShip} onChange={() => setAutoShip(true)} /> Calculate shipping (DHL / my rates)</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" checked={!autoShip} onChange={() => setAutoShip(false)} /> Set shipping manually (US$)</label>
            {!autoShip && <input className="input !w-40" value={ship} onChange={(e) => setShip(e.target.value.replace(/[^0-9.]/g, ""))} />}
          </div>
          <div>
            <label className="label">Extra discount (US$)</label>
            <input className="input !w-40" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
          <div>
            <label className="label">Payment method</label>
            <select className="select" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="paypal">PayPal / card (customer pays via link)</option>
              <option value="xtransfer">Bank transfer (XTransfer)</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid gap-2 content-end">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} /> Already paid — mark as paid now</label>
            {!markPaid && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sendLink} onChange={(e) => setSendLink(e.target.checked)} /> Email the customer a payment link</label>}
          </div>
          <textarea className="textarea sm:col-span-2" rows={2} placeholder="Internal note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </section>

      <section className="card p-6 grid gap-3">
        {preview && (
          <div className="grid gap-1 text-sm max-w-sm">
            <div className="flex justify-between"><span>Frames</span><span>{usd(preview.subtotal)}</span></div>
            {preview.bundleDiscount > 0 && <div className="flex justify-between text-[var(--ok)]"><span>Bundle saving</span><span>−{usd(preview.bundleDiscount)}</span></div>}
            <div className="flex justify-between"><span>Lenses</span><span>{usd(preview.lensTotal)}</span></div>
            <div className="flex justify-between"><span>Shipping</span><span>{usd(preview.shipping)}</span></div>
            {preview.adjustment !== 0 && <div className="flex justify-between text-[var(--ok)]"><span>Discount</span><span>−{usd(Math.abs(preview.adjustment))}</span></div>}
            <div className="flex justify-between border-t border-[var(--line)] pt-1 text-base"><b>Total</b><b>{usd(preview.total)}</b></div>
            {preview.stockIssues.length > 0 && <p className="text-[var(--warn)] text-xs mt-1">Low stock: {preview.stockIssues.join(", ")} — you can still create the order.</p>}
          </div>
        )}
        {err && <p className="err">{err}</p>}
        <div className="flex gap-2">
          <button className="btn btn-outline" onClick={calc} disabled={!lines.length}>Calculate total</button>
          <button className="btn btn-primary" onClick={create} disabled={!preview || busy}>{busy ? "Creating…" : "Create order"}</button>
        </div>
      </section>
    </div>
  );
}
