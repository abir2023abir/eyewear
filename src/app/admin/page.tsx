import Link from "next/link";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import { countryName } from "@/lib/countries";
import { paypalConfigured } from "@/lib/paypal";
import { getSettings } from "@/lib/settings";
import { bankDetailsReal, bankReady, paypalReady } from "@/lib/settings-shared";
import { site } from "@/lib/site";
import RevenueChart from "./RevenueChart";
import PayTag from "./PayTag";

export default async function Dashboard() {
  const since = new Date(Date.now() - 30 * 86400_000);
  const prevSince = new Date(Date.now() - 60 * 86400_000);
  const [paid, prevPaid, awaiting, unpaid, lowStock, recent, openChats, topItems, byCountry] = await Promise.all([
    db.order.findMany({ where: { paymentStatus: "paid", createdAt: { gte: since } }, select: { total: true, createdAt: true } }),
    db.order.aggregate({ where: { paymentStatus: "paid", createdAt: { gte: prevSince, lt: since } }, _sum: { total: true }, _count: true }),
    db.order.count({ where: { paymentStatus: "awaiting_verification" } }),
    db.order.count({ where: { paymentStatus: "unpaid", status: { not: "cancelled" } } }),
    db.variant.findMany({ where: { stock: { lte: 3 } }, include: { product: { select: { name: true, modelCode: true, id: true } } }, orderBy: { stock: "asc" }, take: 8 }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    db.conversation.count({ where: { unreadForSeller: { gt: 0 } } }),
    db.orderItem.groupBy({ by: ["name"], where: { order: { paymentStatus: "paid", createdAt: { gte: since } } }, _sum: { qty: true }, orderBy: { _sum: { qty: "desc" } }, take: 5 }),
    db.order.groupBy({ by: ["country"], where: { paymentStatus: "paid", createdAt: { gte: since } }, _sum: { total: true }, orderBy: { _sum: { total: "desc" } }, take: 5 }),
  ]);
  const ppOk = await paypalConfigured();
  const cfg = await getSettings();
  const noPayment = !paypalReady(cfg.payments) && !bankReady(cfg.payments);
  // things that must be filled in before real customers arrive
  const setup: { ok: boolean; bad?: boolean; label: string; help: string; href: string }[] = [
    { ok: !noPayment, bad: true, label: "A payment method", help: "Customers can’t pay until PayPal or bank transfer is set up.", href: "/admin/settings#payments" },
    { ok: paypalReady(cfg.payments), label: "PayPal & cards", help: "Add your PayPal Client ID and Secret, then press “Test connection”.", href: "/admin/settings#payments" },
    { ok: !cfg.payments.xtransferEnabled || bankDetailsReal(cfg.payments), bad: true, label: "Real bank details", help: "Bank transfer is on but the account number / SWIFT are still examples, so it is hidden from customers.", href: "/admin/settings#payments" },
    { ok: !!cfg.email.smtpHost, bad: true, label: "Email sending (SMTP)", help: "Order confirmations, invoices and password emails are NOT sent until this is filled in.", href: "/admin/settings#email" },
    { ok: !!cfg.shipping.fromAddress && !/^TODO/i.test(cfg.shipping.fromAddress), label: "Ship-from address", help: "Your warehouse street address (shown on invoices and packing slips).", href: "/admin/settings#shipping" },
    { ok: process.env.NODE_ENV !== "production" || !/localhost/.test(site.url), bad: true, label: "Website address", help: "NEXT_PUBLIC_SITE_URL is still localhost — links in emails won’t work. Set it to your real domain.", href: "/admin/settings" },
  ];
  const todo = setup.filter((x) => !x.ok);
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const prevRevenue = prevPaid._sum.total || 0;
  const aov = paid.length ? Math.round(revenue / paid.length) : 0;
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400_000);
    const key = d.toISOString().slice(0, 10);
    return { date: key, value: paid.filter((o) => o.createdAt.toISOString().slice(0, 10) === key).reduce((s, o) => s + o.total, 0) };
  });
  const delta = prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;

  return (
    <div className="grid gap-6">
      {todo.length > 0 && (
        <section className={`rounded-2xl border p-5 ${todo.some((x) => x.bad) ? "bg-[#fff4f4] border-[#f3c9c9]" : "bg-[#fff8e6] border-[#f5dfa6]"}`}>
          <div className="font-display text-xl font-semibold text-[var(--navy)]">Before you go live — {todo.length} thing{todo.length > 1 ? "s" : ""} to finish</div>
          <ul className="grid gap-2 mt-3 text-sm">
            {todo.map((x) => (
              <li key={x.label} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`tag ${x.bad ? "tag-bad" : "tag-warn"}`}>{x.bad ? "Needed" : "Recommended"}</span>
                <b>{x.label}</b>
                <span className="muted">{x.help}</span>
                <Link href={x.href} className="text-[var(--blue)] font-bold">Fix →</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="h-section !text-3xl">Sales overview</h1>
          <p className="muted text-sm">Last 30 days · paid orders · USD</p>
        </div>
        <div className="flex gap-2 text-xs">
          <a href="/admin/settings#payments" className={`tag ${ppOk ? "tag-ok" : "tag-warn"}`}>PayPal {ppOk ? "connected" : "not configured"}</a>
          <a href="/admin/settings#shipping" className="tag tag-light">Shipping prices & delivery days</a>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Tile label="Revenue" value={usd(revenue)} sub={delta === null ? "No previous period" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs previous 30 days`} />
        <Tile label="Paid orders" value={String(paid.length)} sub={`Avg. order ${usd(aov)}`} />
        <Tile label="Transfers to verify" value={String(awaiting)} sub={<Link href="/admin/orders?payment=awaiting_verification" className="text-[var(--blue)] font-bold">Review →</Link>} />
        <Tile label="Unread chats" value={String(openChats)} sub={<Link href="/admin/chat" className="text-[var(--blue)] font-bold">Open inbox →</Link>} />
      </div>

      <div className="card p-6">
        <div className="font-bold">Daily revenue (USD)</div>
        <RevenueChart data={days} />
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="card p-6 xl:col-span-2">
          <div className="flex justify-between items-center mb-3"><div className="font-bold">Recent orders</div><Link href="/admin/orders" className="text-sm text-[var(--blue)] font-bold">All orders →</Link></div>
          <table className="table">
            <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-bold text-[var(--blue)]">{o.number}</Link></td>
                  <td>{o.name}<div className="text-xs muted">{countryName(o.country)}</div></td>
                  <td className="font-semibold">{usd(o.total)}</td>
                  <td><PayTag s={o.paymentStatus} /></td>
                  <td className="capitalize">{o.status.replace(/_/g, " ")}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={5} className="muted">No orders yet.</td></tr>}
            </tbody>
          </table>
          {unpaid > 0 && <p className="text-xs muted mt-3">{unpaid} order(s) are waiting for customer payment.</p>}
        </div>
        <div className="grid gap-6 content-start">
          <div className="card p-6">
            <div className="font-bold mb-3">Top frames (units)</div>
            {topItems.length ? topItems.map((t) => <Row key={t.name} l={t.name} r={String(t._sum.qty)} />) : <p className="muted text-sm">No sales yet.</p>}
          </div>
          <div className="card p-6">
            <div className="font-bold mb-3">Top countries</div>
            {byCountry.length ? byCountry.map((c) => <Row key={c.country} l={countryName(c.country)} r={usd(c._sum.total || 0)} />) : <p className="muted text-sm">No sales yet.</p>}
          </div>
          <div className="card p-6">
            <div className="font-bold mb-3">Low stock</div>
            {lowStock.map((v) => (
              <Row key={v.id} l={<Link href={`/admin/products/${v.product.id}`} className="hover:text-[var(--blue)]">{v.product.name} {v.product.modelCode} · {v.colorName}</Link>} r={<span className={v.stock === 0 ? "text-[var(--bad)] font-bold" : "font-bold"}>{v.stock === 0 ? "⚠ Out" : v.stock}</span>} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-bold uppercase tracking-wider muted">{label}</div>
      <div className="font-display text-3xl font-semibold mt-1 text-[var(--navy)]">{value}</div>
      <div className="text-xs muted mt-1">{sub}</div>
    </div>
  );
}
function Row({ l, r }: { l: React.ReactNode; r: React.ReactNode }) {
  return <div className="flex justify-between gap-3 text-sm py-1.5 border-b border-[var(--line)] last:border-0"><span className="truncate">{l}</span><span>{r}</span></div>;
}
