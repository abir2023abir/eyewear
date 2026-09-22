import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import { countryName } from "@/lib/countries";
import { trackingUrl } from "@/lib/shipping";
import { safeJson } from "@/lib/types";
import PayTag from "../../PayTag";
import OrderActions from "./OrderActions";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!o) notFound();
  const fx = o.displayCurrency !== "USD" ? `≈ ${o.displayCurrency} ${((o.total / 100) * o.fxRate).toFixed(2)} at order time` : "";

  return (
    <div className="grid gap-6 max-w-6xl">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <Link href="/admin/orders" className="text-sm text-[var(--blue)] font-bold">← Orders</Link>
          <h1 className="h-section !text-3xl mt-1">Order {o.number}</h1>
          <p className="muted text-sm">{o.createdAt.toLocaleString()} · {o.source === "manual" ? "manual order · " : o.source === "quote" ? "chat quote · " : ""}{o.paymentMethod} · <PayTag s={o.paymentStatus} /> · <span className="capitalize">{o.status.replace(/_/g, " ")}</span></p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/orders/${o.id}/slip`} target="_blank" className="btn btn-outline btn-sm">Packing slip</Link>
          <a href={`/api/orders/${o.number}/invoice`} target="_blank" rel="noopener" className="btn btn-outline btn-sm">Invoice PDF</a>
          <Link href={`/order/${o.number}?t=${o.accessToken}`} target="_blank" className="btn btn-outline btn-sm">Customer view ↗</Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="grid gap-6">
          <div className="card p-6">
            <div className="font-bold mb-3">Items & prescriptions</div>
            <div className="grid gap-4">
              {o.items.map((it) => {
                const rx = safeJson<Record<string, string>>(it.prescription, {});
                return (
                  <div key={it.id} className="border-b border-[var(--line)] pb-4 text-sm">
                    <div className="flex justify-between">
                      <div>
                        <b>{it.qty}× {it.name}</b> — {it.colorName} <span className="muted">SKU {it.sku}</span>
                        <div className="muted">{it.lensName}{it.coatings ? ` + ${it.coatings}` : ""}</div>
                      </div>
                      <b>{usd((it.unitPrice + it.lensPrice) * it.qty)}</b>
                    </div>
                    {rx.mode === "form" && (
                      <table className="mt-2 text-xs border border-[var(--line)] rounded">
                        <thead><tr className="bg-[var(--sky-2)]"><th className="px-2 py-1">Eye</th><th className="px-2">SPH</th><th className="px-2">CYL</th><th className="px-2">AXIS</th><th className="px-2">ADD</th><th className="px-2">PD</th></tr></thead>
                        <tbody>
                          <tr><td className="px-2 py-1 font-bold">OD (R)</td><td className="px-2">{rx.odSph}</td><td className="px-2">{rx.odCyl}</td><td className="px-2">{rx.odAxis}</td><td className="px-2">{rx.add}</td><td className="px-2" rowSpan={2}>{rx.pd || `${rx.pdRight} / ${rx.pdLeft}`}</td></tr>
                          <tr><td className="px-2 py-1 font-bold">OS (L)</td><td className="px-2">{rx.osSph}</td><td className="px-2">{rx.osCyl}</td><td className="px-2">{rx.osAxis}</td><td className="px-2">{rx.add}</td></tr>
                        </tbody>
                      </table>
                    )}
                    {rx.mode === "upload" && it.prescriptionFileId && <a href={`/api/files/${it.prescriptionFileId}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm mt-2">View prescription photo ↗</a>}
                    {rx.mode === "later" && <div className="tag tag-warn mt-2">Customer will send prescription later</div>}
                    {rx.mode === "none" && <div className="muted text-xs mt-1">Non-prescription lenses</div>}
                  </div>
                );
              })}
            </div>
            <div className="grid gap-1 text-sm mt-4 max-w-sm ml-auto">
              <div className="flex justify-between"><span>Frames</span><span>{usd(o.subtotal)}</span></div>
              {o.bundleDiscount > 0 && <div className="flex justify-between text-[var(--ok)]"><span>Bundle saving</span><span>−{usd(o.bundleDiscount)}</span></div>}
              <div className="flex justify-between"><span>Lenses</span><span>{usd(o.lensTotal)}</span></div>
              <div className="flex justify-between"><span>{o.dhlServiceName} ({o.dhlProductCode}){o.shippingEstimate ? " · estimate" : ""}</span><span>{usd(o.shipping)}</span></div>
              {o.adjustment !== 0 && <div className="flex justify-between text-[var(--ok)]"><span>{o.adjustment < 0 ? "Discount" : "Adjustment"}</span><span>{o.adjustment < 0 ? "−" : "+"}{usd(Math.abs(o.adjustment))}</span></div>}
              <div className="flex justify-between border-t border-[var(--line)] pt-1 text-base"><b>Total</b><b>{usd(o.total)}</b></div>
              {fx && <div className="text-xs muted text-right">{fx}</div>}
            </div>
          </div>
          {o.notes && <div className="card p-6 text-sm whitespace-pre-wrap"><b>Notes</b><br />{o.notes}</div>}
        </div>

        <div className="grid gap-6">
          <div className="card p-6 text-sm">
            <div className="font-bold mb-2">Customer & shipping</div>
            <div className="leading-relaxed">{o.name}<br />{o.email}<br />{o.phone}<br /><br />{o.line1}{o.line2 && <><br />{o.line2}</>}<br />{o.city} {o.state} {o.postcode}<br />{countryName(o.country)}</div>
            {o.customsId && <div className="mt-2"><b>Customs ID:</b> {o.customsId}</div>}
            {o.deliveryDaysMax > 0 && <div className="mt-1 muted">Promised delivery: {o.deliveryDaysMin}–{o.deliveryDaysMax} business days {o.paidAt ? `from ${o.paidAt.toLocaleDateString()}` : "after payment"}</div>}
            {o.conversationId && <Link href={`/admin/chat?c=${o.conversationId}`} className="btn btn-outline btn-sm mt-3 mr-2">Open customer chat</Link>}
            {o.trackingNumber && <a href={trackingUrl(o.trackingNumber)} target="_blank" rel="noopener" className="btn btn-outline btn-sm mt-3">DHL {o.trackingNumber} ↗</a>}
          </div>
          {o.proofUploadId && (
            <div className="card p-6 text-sm">
              <div className="font-bold mb-2">Bank transfer receipt</div>
              <a href={`/api/files/${o.proofUploadId}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm">Open receipt ↗</a>
              <p className="muted text-xs mt-2">Check the amount (USD {(o.total / 100).toFixed(2)}) and reference {o.number} in your XTransfer account before confirming.</p>
            </div>
          )}
          <OrderActions
            id={o.id}
            status={o.status}
            paymentStatus={o.paymentStatus}
            paymentMethod={o.paymentMethod}
            tracking={o.trackingNumber || ""}
            hasPaypal={!!o.paypalOrderId}
            edit={{ email: o.email, name: o.name, phone: o.phone, line1: o.line1, line2: o.line2, city: o.city, state: o.state, postcode: o.postcode, country: o.country, shipping: o.shipping, adjustment: o.adjustment }}
          />
        </div>
      </div>
    </div>
  );
}
