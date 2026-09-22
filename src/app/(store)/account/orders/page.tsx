import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { usd } from "@/lib/money";
import { trackingUrl } from "@/lib/shipping";
import Icon from "@/components/Icon";
import { orderState, orderLink, invoiceLink } from "../status";

export const dynamic = "force-dynamic";

export default async function AccountOrders() {
  const s = await getSession();
  if (!s) redirect("/login?next=/account/orders");
  const orders = await db.order.findMany({ where: { userId: s.uid }, include: { items: true }, orderBy: { createdAt: "desc" } });

  return (
    <section className="grid gap-4">
      <h2 className="font-display text-2xl font-semibold text-[var(--navy)]">My orders</h2>
      {orders.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="muted">No orders yet. Orders you place while signed in — or with this email before you had an account — show up here.</p>
          <Link href="/shop" className="btn btn-primary mt-5">Browse frames</Link>
        </div>
      ) : (
        orders.map((o) => {
          const st = orderState(o);
          return (
            <article key={o.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={orderLink(o)} className="font-bold text-lg text-[var(--blue)]">{o.number}</Link>
                  <div className="muted text-sm">
                    Placed {o.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    {o.paidAt && <> · paid {o.paidAt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</>}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`tag tag-${st.tone}`}>{st.label}</span>
                  <div className="font-display text-xl font-semibold mt-1">{usd(o.total)}</div>
                </div>
              </div>
              <ul className="mt-3 text-sm grid gap-1">
                {o.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-3">
                    <span>{i.qty} × {i.name} <span className="muted">({i.colorName}{i.lensName && i.lensName !== "Frame only" ? ` · ${i.lensName}` : ""}{i.coatings ? ` · ${i.coatings}` : ""})</span></span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--line)]">
                <Link href={orderLink(o)} className={`btn btn-sm ${st.next ? "btn-primary" : "btn-outline"}`}>{st.next === "Pay now" || st.next === "Finish in chat" ? st.next : "Order details"}</Link>
                <a href={invoiceLink(o)} target="_blank" rel="noopener" className="btn btn-outline btn-sm"><Icon name="doc" size={14} /> Invoice INV-{o.number}</a>
                {o.trackingNumber && (
                  <a href={trackingUrl(o.trackingNumber)} target="_blank" rel="noopener" className="btn btn-outline btn-sm"><Icon name="truck" size={14} /> Track {o.trackingNumber}</a>
                )}
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
