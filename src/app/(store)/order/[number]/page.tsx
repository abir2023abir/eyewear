import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { usd } from "@/lib/money";
import { countryName } from "@/lib/countries";
import { trackingUrl } from "@/lib/shipping";
import { safeJson } from "@/lib/types";
import PaymentPanel from "@/components/PaymentPanel";
import Icon from "@/components/Icon";
import OpenChatButton from "@/components/OpenChatButton";
import { formatEta, addBusinessDays } from "@/lib/shipping";
import { purchaseEventScript } from "@/components/Analytics";
import { getSettings } from "@/lib/settings";
import { bankReady, paypalReady } from "@/lib/settings-shared";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };
export const dynamic = "force-dynamic";

const STEPS = [
  ["pending_payment", "Order placed"],
  ["paid", "Payment confirmed"],
  ["processing", "Lenses & quality check"],
  ["shipped", "Shipped with DHL"],
  ["delivered", "Delivered"],
];

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; chat?: string }> }) {
  const { number } = await params;
  const { t, chat } = await searchParams;
  const [order, session] = await Promise.all([db.order.findUnique({ where: { number }, include: { items: true } }), getSession()]);
  if (!order) notFound();
  const allowed = (t && t === order.accessToken) || (session && (session.uid === order.userId || session.role === "admin"));
  if (!allowed) notFound();
  const settings = await getSettings();
  const pay = settings.payments;
  const stepIdx = order.status === "cancelled" ? -1 : STEPS.findIndex(([s]) => s === order.status);

  return (
    <div className="container-x py-10 max-w-5xl">
      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div>
          <div className="eyebrow">Order {order.number}</div>
          <h1 className="h-section mt-1">{order.paymentStatus === "paid" ? "Thank you — your order is confirmed!" : order.paymentStatus === "awaiting_verification" ? "Thank you — we’re verifying your payment" : "Your order is reserved"}</h1>
          <p className="muted mt-1">A confirmation has been sent to {order.email}.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`tag ${order.paymentStatus === "paid" ? "tag-ok" : order.paymentStatus === "awaiting_verification" ? "tag-warn" : "tag-light"}`}>{order.paymentStatus.replace(/_/g, " ")}</span>
          <a href={`/api/orders/${order.number}/invoice?t=${order.accessToken}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm">Download invoice (PDF)</a>
        </div>
      </div>

      {order.status === "cancelled" ? (
        <div className="card p-5 mb-6 text-[var(--bad)] font-bold">This order was cancelled.</div>
      ) : (
        <ol className="grid grid-cols-5 gap-2 mb-8">
          {STEPS.map(([k, l], i) => (
            <li key={k} className="text-center">
              <div className={`h-1.5 rounded-full ${i <= stepIdx ? "bg-[var(--blue)]" : "bg-[var(--line)]"}`} />
              <div className={`text-[12px] mt-2 font-semibold ${i <= stepIdx ? "text-[var(--navy)]" : "muted"}`}>{l}</div>
            </li>
          ))}
        </ol>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="grid gap-6">
          {order.paymentStatus === "paid" && (
            <div className="card p-6 border-2 !border-[#bfe8d2] bg-gradient-to-b from-[#effaf4] to-white flex gap-4 items-start">
              <span className="w-12 h-12 rounded-full bg-[var(--ok)] text-white grid place-items-center shrink-0"><Icon name="check" size={24} /></span>
              <div>
                <div className="font-display text-2xl font-semibold text-[var(--navy)]">Thank you for shopping with us!</div>
                <p className="muted mt-1">We’ve received your payment{order.paidAt ? ` on ${order.paidAt.toLocaleDateString()}` : ""} and emailed your receipt. Your frames are now being prepared in Wenzhou.</p>
                {order.deliveryDaysMax > 0 && <p className="mt-2 font-semibold">Estimated delivery: {formatEta(addBusinessDays(order.paidAt || new Date(), order.deliveryDaysMin).toISOString(), addBusinessDays(order.paidAt || new Date(), order.deliveryDaysMax).toISOString())}</p>}
              </div>
            </div>
          )}
          {order.paymentStatus !== "paid" && order.status !== "cancelled" && order.conversationId && (
            <div className="card p-5 flex flex-wrap items-center justify-between gap-4 bg-[var(--sky-2)]">
              <div className="text-sm"><b className="block text-[15px]">Finish in the chat</b><span className="muted">Your order assistant is waiting with delivery details and payment.</span></div>
              <OpenChatButton autoOpen={chat === "1"} />
            </div>
          )}
          {order.status !== "cancelled" && order.paymentStatus === "unpaid" && order.conversationId && (
            <details className="card p-5 text-sm">
              <summary className="cursor-pointer font-bold text-[var(--blue)]">Prefer to pay on this page instead?</summary>
              <div className="mt-4">
                <PaymentPanel
                  number={order.number}
                  token={order.accessToken}
                  total={order.total}
                  method={order.paymentMethod}
                  paymentStatus={order.paymentStatus}
                  paypalEnabled={paypalReady(pay)}
                  xtransferEnabled={bankReady(pay)}
                  bank={{ beneficiary: pay.xtransferBeneficiary, bank: pay.xtransferBank, account: pay.xtransferAccount, swift: pay.xtransferSwift, note: pay.xtransferNote }}
                />
              </div>
            </details>
          )}
          {order.status !== "cancelled" && !(order.paymentStatus === "unpaid" && order.conversationId) && (
            <PaymentPanel
              number={order.number}
              token={order.accessToken}
              total={order.total}
              method={order.paymentMethod}
              paymentStatus={order.paymentStatus}
              paypalEnabled={paypalReady(pay)}
              xtransferEnabled={bankReady(pay)}
              bank={{
                beneficiary: pay.xtransferBeneficiary,
                bank: pay.xtransferBank,
                account: pay.xtransferAccount,
                swift: pay.xtransferSwift,
                note: pay.xtransferNote,
              }}
            />
          )}

          {order.trackingNumber && (
            <div className="card p-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div className="font-display text-xl font-semibold flex items-center gap-2 text-[var(--navy)]"><Icon name="truck" /> DHL tracking</div>
                <a href={trackingUrl(order.trackingNumber)} target="_blank" rel="noopener" className="btn btn-outline btn-sm">{order.trackingNumber} ↗</a>
              </div>
              <p className="text-sm muted mt-2">Your parcel is on its way with DHL Express. Tap the tracking number to follow it on dhl.com.</p>
            </div>
          )}

          <div className="card p-6">
            <div className="font-display text-xl font-semibold mb-4 text-[var(--navy)]">Items</div>
            <div className="grid gap-4">
              {order.items.map((it) => {
                const rx = safeJson<Record<string, string>>(it.prescription, {});
                return (
                  <div key={it.id} className="flex justify-between gap-4 text-sm border-b border-[var(--line)] pb-3">
                    <div>
                      <div className="font-bold">{it.qty}× {it.name} — {it.colorName}</div>
                      <div className="muted">{it.lensName}{it.coatings ? ` + ${it.coatings}` : ""} · SKU {it.sku}</div>
                      {rx.mode === "form" && <div className="text-xs text-[var(--blue)] mt-1">Rx R {rx.odSph}/{rx.odCyl}×{rx.odAxis || "—"} · L {rx.osSph}/{rx.osCyl}×{rx.osAxis || "—"} · PD {rx.pd || `${rx.pdRight}/${rx.pdLeft}`}</div>}
                      {rx.mode === "upload" && <div className="text-xs text-[var(--blue)] mt-1">Prescription photo received</div>}
                      {rx.mode === "later" && <div className="text-xs text-[var(--warn)] mt-1 font-semibold">Prescription needed — reply to your confirmation email or chat with us</div>}
                    </div>
                    <div className="font-bold whitespace-nowrap">{usd((it.unitPrice + it.lensPrice) * it.qty)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="card p-6 grid gap-2 text-sm">
          <div className="font-display text-lg font-semibold text-[var(--navy)]">Summary</div>
          <div className="flex justify-between"><span>Frames</span><span>{usd(order.subtotal)}</span></div>
          {order.bundleDiscount > 0 && <div className="flex justify-between text-[var(--ok)]"><span>Bundle saving</span><span>−{usd(order.bundleDiscount)}</span></div>}
          {order.lensTotal > 0 && <div className="flex justify-between"><span>Lenses</span><span>{usd(order.lensTotal)}</span></div>}
          <div className="flex justify-between"><span>{order.dhlServiceName}</span><span>{order.shipping ? usd(order.shipping) : "Free"}</span></div>
          {order.adjustment !== 0 && <div className={`flex justify-between ${order.adjustment < 0 ? "text-[var(--ok)]" : ""}`}><span>{order.adjustment < 0 ? "Discount" : "Adjustment"}</span><span>{order.adjustment < 0 ? "−" : "+"}{usd(Math.abs(order.adjustment))}</span></div>}
          <div className="flex justify-between border-t border-[var(--line)] pt-2 text-base"><b>Total</b><b>{usd(order.total)}</b></div>
          <div className="border-t border-[var(--line)] pt-3 mt-2">
            <div className="font-bold mb-1">Ship to</div>
            <div className="muted leading-relaxed">{order.name}<br />{order.line1}{order.line2 && <>, {order.line2}</>}<br />{order.city} {order.state} {order.postcode}<br />{countryName(order.country)}<br />{order.phone}</div>
          </div>
          <p className="text-xs muted mt-2">Import duties may be collected by DHL on delivery.</p>
          {session ? <Link href="/account" className="btn btn-outline btn-sm mt-2">All my orders</Link> : <Link href={`/register?email=${encodeURIComponent(order.email)}`} className="btn btn-outline btn-sm mt-2">Create an account to track orders</Link>}
        </aside>
      </div>
      {order.paymentStatus === "paid" && (
        <script dangerouslySetInnerHTML={{ __html: purchaseEventScript(order.number, order.total / 100, order.items.map((i) => ({ id: i.sku, name: i.name, price: (i.unitPrice + i.lensPrice) / 100, qty: i.qty })), settings.marketing.adsId, settings.marketing.adsPurchaseLabel).replace(/</g, "\\u003c") }} />
      )}
    </div>
  );
}
