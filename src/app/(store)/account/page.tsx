import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { usd } from "@/lib/money";
import { trackingUrl } from "@/lib/shipping";
import Icon from "@/components/Icon";
import { orderState, orderLink, invoiceLink } from "./status";

export const dynamic = "force-dynamic";

export default async function AccountOverview() {
  const s = await getSession();
  if (!s) redirect("/login?next=/account");
  const [orders, addresses, prescriptions, wish, unread] = await Promise.all([
    db.order.findMany({ where: { userId: s.uid }, include: { items: true }, orderBy: { createdAt: "desc" } }),
    db.address.count({ where: { userId: s.uid } }),
    db.prescription.count({ where: { userId: s.uid } }),
    db.wishlistItem.count({ where: { userId: s.uid } }),
    db.conversation.aggregate({ where: { userId: s.uid }, _sum: { unreadForCustomer: true } }),
  ]);
  const latest = orders[0];
  const spent = orders.filter((o) => o.paymentStatus === "paid").reduce((n, o) => n + o.total, 0);
  const toPay = orders.filter((o) => o.paymentStatus === "unpaid" && o.status !== "cancelled");
  const unreadN = unread._sum.unreadForCustomer || 0;

  const stats: [string, string, string, string][] = [
    ["Orders", String(orders.length), "/account/orders", "box"],
    ["Paid so far", usd(spent), "/account/orders", "tag"],
    ["Saved frames", String(wish), "/account/wishlist", "heart"],
    ["Unread messages", String(unreadN), "/account/messages", "chat"],
  ];

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(([l, v, h, i]) => (
          <Link key={l} href={h} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 muted text-xs font-bold uppercase tracking-wide"><Icon name={i} size={14} /> {l}</div>
            <div className="font-display text-2xl font-semibold mt-2 text-[var(--navy)]">{v}</div>
          </Link>
        ))}
      </div>

      {toPay.length > 0 && (
        <div className="rounded-2xl bg-[#fff8e6] border border-[#f5dfa6] px-5 py-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span><b>{toPay.length === 1 ? "1 order is" : `${toPay.length} orders are`} waiting for payment.</b> We start making your glasses as soon as it’s paid.</span>
          <Link href={orderLink(toPay[0])} className="btn btn-primary btn-sm">Pay order {toPay[0].number}</Link>
        </div>
      )}

      <section className="card p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-display text-xl font-semibold text-[var(--navy)]">Latest order</h2>
          {orders.length > 1 && <Link href="/account/orders" className="text-sm font-bold text-[var(--blue)]">All orders →</Link>}
        </div>
        {!latest ? (
          <div className="text-center py-6">
            <p className="muted">You haven’t ordered yet.</p>
            <Link href="/shop" className="btn btn-primary mt-4">Browse frames</Link>
          </div>
        ) : (
          <LatestOrder o={latest} />
        )}
      </section>

      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/account/addresses" className="card p-5 hover:shadow-md transition-shadow">
          <Icon name="truck" size={20} />
          <div className="font-bold mt-2">Addresses</div>
          <p className="muted text-sm">{addresses ? `${addresses} saved — checkout fills in faster.` : "Save an address for faster checkout."}</p>
        </Link>
        <Link href="/account/addresses" className="card p-5 hover:shadow-md transition-shadow">
          <Icon name="doc" size={20} />
          <div className="font-bold mt-2">Prescriptions</div>
          <p className="muted text-sm">{prescriptions ? `${prescriptions} saved — pick one when you buy lenses.` : "Save your prescription once, reuse it every order."}</p>
        </Link>
        <Link href="/account/profile" className="card p-5 hover:shadow-md transition-shadow">
          <Icon name="lock" size={20} />
          <div className="font-bold mt-2">Profile & security</div>
          <p className="muted text-sm">Change your name or password, sign out other devices.</p>
        </Link>
      </div>
    </div>
  );
}

function LatestOrder({ o }: { o: { number: string; accessToken: string; createdAt: Date; total: number; status: string; paymentStatus: string; paymentMethod: string; trackingNumber: string | null; items: { name: string; colorName: string; qty: number }[] } }) {
  const st = orderState(o);
  const steps = ["Ordered", "Paid", "Being made", "Shipped", "Delivered"];
  const at = o.status === "delivered" ? 4 : o.status === "shipped" ? 3 : o.status === "processing" ? 2 : o.paymentStatus === "paid" ? 1 : 0;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div>
          <div className="font-bold text-lg">{o.number}</div>
          <div className="muted text-sm">{o.createdAt.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · {o.items.reduce((n, i) => n + i.qty, 0)} item(s) · <b className="text-[var(--ink)]">{usd(o.total)}</b></div>
        </div>
        <span className={`tag tag-${st.tone}`}>{st.label}</span>
      </div>
      <p className="text-sm mt-3">{o.items.map((i) => `${i.name} (${i.colorName})${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ")}</p>
      {o.status !== "cancelled" && (
        <ol className="grid grid-cols-5 gap-1 mt-5" aria-label="Order progress">
          {steps.map((l, i) => (
            <li key={l} className="text-center">
              <div className={`h-1.5 rounded-full ${i <= at ? "bg-[var(--blue)]" : "bg-[var(--line)]"}`} />
              <div className={`text-[11px] mt-1.5 font-semibold ${i <= at ? "text-[var(--blue)]" : "muted"}`}>{l}</div>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-2 mt-5">
        <Link href={orderLink(o)} className="btn btn-primary btn-sm">{st.next === "Pay now" || st.next === "Finish in chat" ? st.next : "View order"}</Link>
        <a href={invoiceLink(o)} className="btn btn-outline btn-sm" target="_blank" rel="noopener"><Icon name="doc" size={14} /> Invoice (PDF)</a>
        {o.trackingNumber && <a href={trackingUrl(o.trackingNumber)} className="btn btn-outline btn-sm" target="_blank" rel="noopener"><Icon name="truck" size={14} /> Track {o.trackingNumber}</a>}
      </div>
    </div>
  );
}
