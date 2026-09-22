"use client";
import Link from "next/link";
import { createContext, useContext, useState } from "react";
import BrandLogo from "./BrandLogo";
import Icon from "./Icon";
import { PaymentChooser } from "./PaymentPanel";
import { usd } from "@/lib/money";

/** Lets cards ask the chat to refresh right after the customer acts. Absent in the admin inbox (read-only). */
export const ChatActions = createContext<{ refresh: () => void; interactive: boolean }>({ refresh: () => {}, interactive: false });

const post = (body: unknown) => fetch("/api/chat/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function CardShell({ title, icon, right, children, tone = "blue" }: { title: string; icon: string; right?: React.ReactNode; children: React.ReactNode; tone?: "blue" | "green" }) {
  return (
    <div className="w-full rounded-2xl border border-[var(--line)] bg-white overflow-hidden shadow-[0_8px_24px_-18px_rgba(10,36,99,.5)] text-sm">
      <div className={`px-4 py-2.5 flex items-center justify-between gap-2 text-white ${tone === "green" ? "bg-[var(--ok)]" : "bg-[var(--navy)]"}`}>
        <span className="font-bold flex items-center gap-2"><Icon name={icon} size={15} /> {title}</span>
        {right}
      </div>
      <div className="p-4 grid gap-3">{children}</div>
    </div>
  );
}

type OrderP = {
  number: string; token: string;
  items: { name: string; colorName: string; qty: number; lens: string; total: number }[];
  ship: { name: string; phone: string; email: string; lines: string[] };
  subtotal: number; bundleDiscount: number; lensTotal: number; shipping: number; adjustment: number; total: number;
};

export function OrderCard({ p }: { p: OrderP }) {
  return (
    <CardShell title={`Order ${p.number}`} icon="cart" right={<span className="text-[11px] opacity-80">Submitted</span>}>
      <div className="grid gap-1.5">
        {p.items.map((i, k) => (
          <div key={k} className="flex justify-between gap-3">
            <span>{i.qty}× <b>{i.name}</b> <span className="muted">· {i.colorName}{i.lens ? ` · ${i.lens}` : ""}</span></span>
            <span className="font-semibold whitespace-nowrap">{usd(i.total)}</span>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-[var(--sky-2)] p-3 text-[12.5px] leading-relaxed">
        <div className="font-bold text-[var(--navy)] mb-0.5 flex items-center gap-1.5"><Icon name="truck" size={13} /> Deliver to</div>
        {p.ship.name} · {p.ship.phone}<br />{p.ship.lines.join(", ")}<br /><span className="muted">{p.ship.email}</span>
      </div>
      <div className="grid gap-1 text-[13px]">
        {p.bundleDiscount > 0 && <Row l="Bundle saving" r={`−${usd(p.bundleDiscount)}`} className="text-[var(--ok)]" />}
        <Row l="Shipping" r={p.shipping ? usd(p.shipping) : "Free"} />
        {p.adjustment !== 0 && <Row l={p.adjustment < 0 ? "Discount" : "Adjustment"} r={`${p.adjustment < 0 ? "−" : "+"}${usd(Math.abs(p.adjustment))}`} />}
        <div className="flex justify-between border-t border-[var(--line)] pt-2 mt-1 text-[15px]"><b>Total</b><b>{usd(p.total)}</b></div>
      </div>
    </CardShell>
  );
}

type ShipP = {
  number: string; token: string; kind: "intl" | "domestic"; courier: string; price: number; eta: string; days: [number, number];
  country: string; requiresId: boolean; idLabel: string; confirmed: boolean;
  fields: { name?: string; phone?: string; postcode?: string; line1?: string; city?: string; customsId?: string };
};

export function ShippingCard({ p }: { p: ShipP }) {
  const { refresh, interactive } = useContext(ChatActions);
  const [f, setF] = useState({ phone: p.fields.phone || "", postcode: p.fields.postcode || "", customsId: p.fields.customsId || "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const intl = p.kind === "intl";

  const confirm = async () => {
    setErr("");
    setBusy(true);
    const r = await post({ action: "shipping", number: p.number, token: p.token, ...f });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Please check the details");
    refresh();
  };

  return (
    <CardShell title={intl ? "International delivery" : "Delivery"} icon="truck" right={p.confirmed ? <span className="text-[11px] flex items-center gap-1"><Icon name="check" size={12} /> Confirmed</span> : undefined}>
      <div className="flex items-center gap-3">
        <span className="w-20 h-9 rounded-lg bg-[#ffcc00] grid place-items-center shrink-0 px-2">{intl ? <BrandLogo name="dhl" className="max-h-5" /> : <Icon name="truck" />}</span>
        <span className="flex-1">
          <b className="block">{p.courier}</b>
          <span className="muted text-[12.5px]">Wenzhou, China → {p.country}</span>
        </span>
        <b className="text-[15px]">{p.price ? usd(p.price) : "Free"}</b>
      </div>
      <div className="rounded-xl bg-[var(--sky-2)] px-3 py-2.5 flex items-start gap-2">
        <Icon name="refresh" size={15} className="text-[var(--blue)] mt-0.5" />
        <span className="text-[12.5px]"><b className="text-[var(--navy)]">Estimated arrival: {p.eta}</b><br /><span className="muted">{p.days[0]}–{p.days[1]} business days incl. preparation · door-to-door with tracking</span></span>
      </div>

      {intl && !p.confirmed && (
        <div className="grid gap-2">
          <div className="text-[12.5px] font-bold text-[var(--navy)]">DHL needs these details for customs clearance</div>
          <div className="text-[12px] muted">{p.fields.name} · {[p.fields.line1, p.fields.city].filter(Boolean).join(", ")}</div>
          <label className="grid gap-1 text-[12px] font-semibold">Phone number (with country code)
            <input className="input !py-2" value={f.phone} disabled={!interactive} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+61 400 000 000" />
          </label>
          <label className="grid gap-1 text-[12px] font-semibold">Postcode / ZIP
            <input className="input !py-2" value={f.postcode} disabled={!interactive} onChange={(e) => setF({ ...f, postcode: e.target.value })} />
          </label>
          {p.requiresId && (
            <label className="grid gap-1 text-[12px] font-semibold">{p.idLabel} <span className="font-normal muted">Required by customs in {p.country}</span>
              <input className="input !py-2" value={f.customsId} disabled={!interactive} onChange={(e) => setF({ ...f, customsId: e.target.value })} />
            </label>
          )}
          <p className="text-[11.5px] muted">Import duty or tax may be collected by DHL on delivery (DAP). It is set by your country’s customs and isn’t included in the price.</p>
          {err && <p className="err">{err}</p>}
          {interactive && <button className="btn btn-primary w-full" disabled={busy} onClick={confirm}>{busy ? "Saving…" : "Confirm DHL delivery details"}</button>}
        </div>
      )}
      {intl && p.confirmed && (
        <div className="text-[12.5px] muted">Phone {p.fields.phone} · Postcode {p.fields.postcode || "—"}{p.fields.customsId ? ` · ID ${p.fields.customsId}` : ""}</div>
      )}
    </CardShell>
  );
}

type PayP = { number: string; token: string; total: number; methods: string[]; chosen: string; status: string; bank: { beneficiary: string; bank: string; account: string; swift: string; note: string } | null };

export function PaymentCard({ p, body }: { p: PayP; body: string }) {
  const { refresh, interactive } = useContext(ChatActions);
  return (
    <CardShell title={body || "Payment"} icon="lock" right={<b className="text-[13px]">{usd(p.total)}</b>} tone={p.status === "paid" ? "green" : "blue"}>
      <PaymentChooser
        number={p.number}
        token={p.token}
        total={p.total}
        methods={p.methods}
        chosen={p.chosen}
        status={p.status}
        bank={p.bank}
        readOnly={!interactive}
        onChoose={async (m) => {
          await post({ action: "pay_method", number: p.number, token: p.token, method: m });
          refresh();
        }}
        onDone={refresh}
      />
    </CardShell>
  );
}

export function ThanksCard({ p, body }: { p: { number: string; token: string; total: number; eta?: string }; body: string }) {
  return (
    <div className="w-full rounded-2xl overflow-hidden border border-[#bfe8d2] bg-gradient-to-b from-[#effaf4] to-white text-sm">
      <div className="p-5 text-center">
        <div className="w-14 h-14 rounded-full bg-[var(--ok)] text-white grid place-items-center mx-auto shadow-[0_10px_24px_-10px_rgba(15,157,88,.8)]"><Icon name="check" size={28} /></div>
        <div className="font-display text-xl font-semibold text-[var(--navy)] mt-3">Thank you for your order!</div>
        <p className="muted mt-1 leading-relaxed">{body}</p>
        <div className="grid grid-cols-2 gap-2 mt-4 text-left">
          <div className="rounded-xl bg-white border border-[var(--line)] p-3"><div className="text-[11px] muted font-bold uppercase tracking-wider">Order</div><b>{p.number}</b></div>
          <div className="rounded-xl bg-white border border-[var(--line)] p-3"><div className="text-[11px] muted font-bold uppercase tracking-wider">Paid</div><b>{usd(p.total)}</b></div>
          {p.eta && <div className="col-span-2 rounded-xl bg-white border border-[var(--line)] p-3"><div className="text-[11px] muted font-bold uppercase tracking-wider">Estimated delivery</div><b>{p.eta}</b></div>}
        </div>
        <Link href={`/order/${p.number}?t=${p.token}`} className="btn btn-outline btn-sm mt-4">View order & tracking</Link>
      </div>
    </div>
  );
}

function Row({ l, r, className }: { l: string; r: string; className?: string }) {
  return <div className={`flex justify-between ${className || ""}`}><span className="muted">{l}</span><span>{r}</span></div>;
}
