"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { COUNTRIES } from "@/lib/countries";

type EditFields = { email: string; name: string; phone: string; line1: string; line2: string; city: string; state: string; postcode: string; country: string; shipping: number; adjustment: number };

export default function OrderActions({ id, status, paymentStatus, paymentMethod, tracking, hasPaypal, edit }: {
  id: string; status: string; paymentStatus: string; paymentMethod: string; tracking: string; hasPaypal: boolean; edit: EditFields;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [track, setTrack] = useState(tracking);
  const [note, setNote] = useState("");
  const [paidVia, setPaidVia] = useState(paymentMethod === "paypal" || paymentMethod === "xtransfer" || paymentMethod === "cash" ? paymentMethod : "other");
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ ...edit, shippingUsd: (edit.shipping / 100).toFixed(2), discountUsd: (Math.max(0, -edit.adjustment) / 100).toFixed(2) });
  const paid = paymentStatus === "paid";

  const act = async (action: string, extra: Record<string, unknown> = {}, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setBusy(action);
    setMsg(null);
    const r = await fetch(`/api/admin/orders/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    const j = await r.json().catch(() => ({}));
    setBusy("");
    setMsg({ ok: r.ok, text: r.ok ? j.message || "Saved" : j.error || "Failed" });
    if (r.ok && j.deleted) return router.push("/admin/orders");
    if (r.ok) router.refresh();
    return r.ok;
  };

  const saveEdit = async () => {
    const { shippingUsd, discountUsd, ...rest } = f;
    const ok = await act("edit", { ...rest, shipping: Math.round((parseFloat(shippingUsd) || 0) * 100), adjustment: -Math.round((parseFloat(discountUsd) || 0) * 100) });
    if (ok) setEditing(false);
  };

  return (
    <div className="card p-6 grid gap-5 text-sm">
      <div className="font-bold">Actions</div>
      {msg && <div className={`rounded-lg px-3 py-2 font-semibold ${msg.ok ? "bg-[#e3f7ec] text-[var(--ok)]" : "bg-[#fde8e8] text-[var(--bad)]"}`}>{msg.text}</div>}

      {!paid && (
        <div className="grid gap-2">
          <label className="label !mb-0">Payment</label>
          <div className="flex gap-2">
            <select className="select !py-2" value={paidVia} onChange={(e) => setPaidVia(e.target.value)}>
              <option value="xtransfer">Bank transfer</option>
              <option value="paypal">PayPal</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
            <button className="btn btn-blue whitespace-nowrap" disabled={!!busy} onClick={() => act("mark_paid", { method: paidVia }, "Confirm the full payment has been received? The customer gets a receipt email.")}>✓ Mark paid</button>
          </div>
          {hasPaypal && <button className="btn btn-outline" disabled={!!busy} onClick={() => act("paypal_check")}>{busy === "paypal_check" ? "Checking…" : "Check PayPal payment"}</button>}
          {paymentStatus === "awaiting_verification" && <button className="btn btn-outline" disabled={!!busy} onClick={() => act("reject_proof", {}, "Reject this receipt? The customer will be asked to pay again.")}>Reject bank receipt</button>}
        </div>
      )}

      <div>
        <label className="label">Order status</label>
        <select className="select" value={status} disabled={!!busy} onChange={(e) => act("status", { status: e.target.value })}>
          {["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div className="grid gap-2">
        <label className="label !mb-0">Shipping</label>
        <p className="text-xs muted">Book the parcel with DHL, then paste the tracking number here.</p>
        <div className="flex gap-2">
          <input className="input" placeholder="Tracking number" value={track} onChange={(e) => setTrack(e.target.value)} />
          <button className="btn btn-outline" disabled={!!busy || !track.trim()} onClick={() => act("tracking", { tracking: track.trim() })}>Save</button>
        </div>
        <p className="text-xs muted">Saving marks the order shipped and notifies the customer by email and in their chat.</p>
      </div>

      <div className="grid gap-2">
        <label className="label !mb-0">Email the customer</label>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-outline btn-sm" disabled={!!busy} onClick={() => act("resend", { email: "confirmation" })}>Order confirmation</button>
          <button className="btn btn-outline btn-sm" disabled={!!busy || paid} onClick={() => act("resend", { email: "payment_link" })}>Payment link</button>
          <button className="btn btn-outline btn-sm" disabled={!!busy || !paid} onClick={() => act("resend", { email: "receipt" })}>Receipt</button>
          <button className="btn btn-outline btn-sm" disabled={!!busy || !tracking} onClick={() => act("resend", { email: "shipped" })}>Shipped + tracking</button>
        </div>
      </div>

      <div className="grid gap-2">
        <button className="btn btn-outline" onClick={() => setEditing(!editing)}>{editing ? "Close editor" : "Edit customer, address & amounts"}</button>
        {editing && (
          <div className="grid gap-2 card-flat p-3">
            <input className="input" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input className="input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <input className="input" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <input className="input" placeholder="Address line 1" value={f.line1} onChange={(e) => setF({ ...f, line1: e.target.value })} />
            <input className="input" placeholder="Address line 2" value={f.line2} onChange={(e) => setF({ ...f, line2: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
              <input className="input" placeholder="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />
              <input className="input" placeholder="Postcode" value={f.postcode} onChange={(e) => setF({ ...f, postcode: e.target.value })} />
              <select className="select" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Shipping US$</label><input className="input" disabled={paid} value={f.shippingUsd} onChange={(e) => setF({ ...f, shippingUsd: e.target.value.replace(/[^0-9.]/g, "") })} /></div>
              <div><label className="label">Discount US$</label><input className="input" disabled={paid} value={f.discountUsd} onChange={(e) => setF({ ...f, discountUsd: e.target.value.replace(/[^0-9.]/g, "") })} /></div>
            </div>
            {paid && <p className="text-xs muted">Amounts are locked because the order is paid.</p>}
            <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={saveEdit}>Save changes</button>
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <label className="label !mb-0">Internal note</label>
        <textarea className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-outline btn-sm" disabled={!note.trim()} onClick={() => { act("note", { note }); setNote(""); }}>Add note</button>
      </div>

      {paid && <button className="btn btn-ghost !text-[var(--bad)]" onClick={() => act("refunded", {}, "Mark as refunded? (Issue the refund in PayPal/XTransfer first.)")}>Mark refunded</button>}
      {!paid && <button className="btn btn-ghost !text-[var(--bad)]" onClick={() => act("delete", { confirm: "DELETE" }, "Permanently delete this unpaid order?")}>Delete order</button>}
    </div>
  );
}
