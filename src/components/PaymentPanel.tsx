"use client";
import { useEffect, useRef, useState } from "react";
import BrandLogo from "./BrandLogo";
import Icon from "./Icon";
import { useSite } from "./Providers";
import { usd } from "@/lib/money";
import { prepareUpload } from "@/lib/shrink-image";

export type Bank = { beneficiary: string; bank: string; account: string; swift: string; note: string };
type Method = "paypal" | "xtransfer";

const METHOD_INFO: Record<Method, { title: string; sub: string; badge: string }> = {
  paypal: { title: "PayPal", sub: "PayPal balance, debit or credit card", badge: "Instant" },
  xtransfer: { title: "XTransfer bank transfer", sub: "International transfer in USD — upload your receipt", badge: "1 business day" },
};

/**
 * The payment step: choose PayPal or XTransfer, then pay. Used inside the chat checkout and on the order page.
 * `onChoose` persists the choice (chat); `onDone` refreshes the parent after a payment or receipt upload.
 */
export function PaymentChooser({ number, token, total, methods, chosen, status, bank, onChoose, onDone, readOnly }: {
  number: string; token: string; total: number; methods: string[]; chosen?: string; status?: string; bank: Bank | null;
  onChoose?: (m: Method) => Promise<void> | void; onDone?: () => void; readOnly?: boolean;
}) {
  const [method, setMethod] = useState<Method | "">((chosen as Method) || "");
  useEffect(() => setMethod((chosen as Method) || ""), [chosen]);
  const available = methods.filter((m): m is Method => m === "paypal" || m === "xtransfer");

  if (status === "paid") {
    return (
      <div className="rounded-2xl bg-[#e9f8f0] border border-[#bfe8d2] p-4 text-sm flex gap-3 items-center">
        <span className="w-9 h-9 rounded-full bg-[var(--ok)] text-white grid place-items-center shrink-0"><Icon name="check" size={18} /></span>
        <span><b className="block">Paid — thank you!</b>{usd(total)} received{chosen ? ` by ${chosen === "paypal" ? "PayPal" : "bank transfer"}` : ""}.</span>
      </div>
    );
  }
  if (status === "awaiting") {
    return (
      <div className="rounded-2xl bg-[#fff8e6] border border-[#f5dfa6] p-4 text-sm flex gap-3 items-center">
        <span className="w-9 h-9 rounded-full bg-[var(--warn)] text-white grid place-items-center shrink-0"><Icon name="refresh" size={16} /></span>
        <span><b className="block">Receipt received — verifying</b>We’ll confirm your transfer within 1 business day.</span>
      </div>
    );
  }
  if (!available.length) return <p className="text-sm">Online payment is paused right now — please message us and we’ll help you complete the order.</p>;

  const pick = async (m: Method) => {
    if (readOnly) return;
    setMethod(m);
    await onChoose?.(m);
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-2" role="radiogroup" aria-label="Payment method">
        {available.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            disabled={readOnly}
            onClick={() => pick(m)}
            className={`flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left transition ${method === m ? "border-[var(--blue)] shadow-[0_8px_24px_-12px_rgba(29,91,216,.6)]" : "border-[var(--line)] hover:border-[#b9cdf3]"}`}
          >
            <span className={`w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 ${method === m ? "border-[var(--blue)]" : "border-[#c4d0e4]"}`}>{method === m && <span className="w-2.5 h-2.5 rounded-full bg-[var(--blue)]" />}</span>
            <span className="w-24 h-8 grid place-items-center shrink-0"><BrandLogo name={m} className="max-h-7 max-w-24" /></span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center gap-2 font-bold text-[14px]">{METHOD_INFO[m].title}<span className="tag tag-light !text-[9.5px] !px-2">{METHOD_INFO[m].badge}</span></span>
              <span className="block text-[12.5px] muted leading-snug">{METHOD_INFO[m].sub}</span>
            </span>
          </button>
        ))}
      </div>

      {method === "paypal" && !readOnly && <PayPalButtons number={number} token={token} onDone={onDone} />}
      {method === "xtransfer" && !readOnly && bank && <BankTransfer number={number} token={token} total={total} bank={bank} onDone={onDone} />}

      <div className="flex items-center justify-center gap-2 text-[11.5px] muted">
        <Icon name="lock" size={13} /> Secure payment · charged in USD · {usd(total)}
      </div>
    </div>
  );
}

function PayPalButtons({ number, token, onDone }: { number: string; token: string; onDone?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const { payments } = useSite();
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const clientId = payments.paypalClientId;

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    const render = () => {
      const paypal = (window as any).paypal;
      if (!paypal || !box.current || cancelled) return;
      box.current.textContent = "";
      paypal
        .Buttons({
          style: { layout: "vertical", color: "gold", shape: "pill", label: "pay", height: 44 },
          createOrder: async () => {
            setErr("");
            const r = await fetch("/api/paypal/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, token }) });
            const j = await r.json().catch(() => ({}));
            if (!r.ok) {
              setErr(j.error || "Could not start PayPal");
              throw new Error(j.error);
            }
            return j.id;
          },
          onApprove: async (data: { orderID: string }, actions: { restart?: () => unknown }) => {
            setBusy(true);
            setErr("");
            const r = await fetch("/api/paypal/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ number, token, paypalOrderId: data.orderID }) });
            const j = await r.json().catch(() => ({}));
            setBusy(false);
            if (r.status === 402 && j.restart && actions?.restart) return actions.restart();
            if (!r.ok || r.status === 202) return setErr(j.error || "Payment could not be captured. You have not been charged.");
            onDone?.();
          },
          onCancel: () => setErr("Payment cancelled — you can try again whenever you’re ready."),
          onError: () => setErr("PayPal ran into a problem. Please try again or choose bank transfer."),
        })
        .render(box.current)
        .then(() => !cancelled && setReady(true))
        .catch(() => {});
    };
    const id = "paypal-sdk";
    if (document.getElementById(id)) render();
    else {
      const s = document.createElement("script");
      s.id = id;
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
      s.onload = render;
      s.onerror = () => setErr("Couldn’t load PayPal. Check your connection and try again.");
      document.body.appendChild(s);
    }
    return () => {
      cancelled = true;
    };
  }, [clientId, number, token, onDone]);

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--sky-2)] p-3">
      {!ready && !err && <div className="h-11 rounded-full bg-white animate-pulse grid place-items-center text-xs muted">Loading PayPal…</div>}
      <div ref={box} />
      {busy && <p className="muted text-sm mt-2 text-center">Confirming your payment…</p>}
      {err && <p className="err mt-2 text-center">{err}</p>}
    </div>
  );
}

function BankTransfer({ number, token, total, bank, onDone }: { number: string; token: string; total: number; bank: Bank; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ref, setRef] = useState("");
  const [copied, setCopied] = useState("");
  const upload = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    setErr("");
    let file: File;
    try { file = await prepareUpload(f); } catch (e: any) { setBusy(false); return setErr(e.message); }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("token", token);
    fd.append("reference", ref);
    const r = await fetch(`/api/orders/${encodeURIComponent(number)}/proof`, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Upload failed");
    onDone?.();
  };
  const rows: [string, string][] = [["Beneficiary", bank.beneficiary], ["Bank", bank.bank], ["Account / IBAN", bank.account], ["SWIFT / BIC", bank.swift], ["Amount", `USD ${(total / 100).toFixed(2)}`], ["Reference", number]];
  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--sky-2)] p-3">
      <div className="rounded-xl bg-white border border-[var(--line)] divide-y divide-[var(--line)]">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 px-3 py-2 text-[13px]">
            <span className="muted">{k}</span>
            <span className="font-bold text-right flex items-center gap-2 break-all">
              {v}
              <button type="button" className="text-[var(--blue)] text-[11px] shrink-0" onClick={() => { navigator.clipboard?.writeText(v); setCopied(k); setTimeout(() => setCopied(""), 1200); }} aria-label={`Copy ${k}`}>{copied === k ? "Copied" : "Copy"}</button>
            </span>
          </div>
        ))}
        {!bank.account && <div className="px-3 py-2 text-[13px] text-[var(--warn)]">Bank details are being updated — message us for the account number.</div>}
      </div>
      {bank.note && <p className="text-[12.5px] muted">{bank.note}</p>}
      <input className="input !py-2 text-sm" placeholder="Transfer reference / transaction no. (optional)" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={80} />
      <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#b9cdf3] bg-white p-4 cursor-pointer hover:border-[var(--blue)] text-center">
        <Icon name="upload" size={18} className="text-[var(--blue)]" />
        <span className="font-bold text-[13px]">{busy ? "Uploading…" : "I’ve paid — upload my transfer receipt"}</span>
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      {err && <p className="err text-center">{err}</p>}
    </div>
  );
}

/** Order page version: same payment step inside a card. */
export default function PaymentPanel({ number, token, total, method, paymentStatus, paypalEnabled, xtransferEnabled, bank }: {
  number: string; token: string; total: number; method: string; paymentStatus: string; paypalEnabled: boolean; xtransferEnabled: boolean; bank: Bank;
}) {
  const methods = [paypalEnabled && "paypal", xtransferEnabled && "xtransfer"].filter(Boolean) as string[];
  if (paymentStatus === "paid") return null;
  return (
    <div className="card p-6 border-2 !border-[var(--blue)]">
      <div className="font-display text-2xl font-semibold text-[var(--navy)] mb-4">{paymentStatus === "awaiting_verification" ? "Payment" : `Pay ${usd(total)}`}</div>
      <PaymentChooser
        number={number}
        token={token}
        total={total}
        methods={methods}
        chosen={methods.includes(method) ? method : methods.length === 1 ? methods[0] : ""}
        status={paymentStatus === "awaiting_verification" ? "awaiting" : "open"}
        bank={xtransferEnabled ? bank : null}
        onDone={() => window.location.reload()}
      />
    </div>
  );
}
