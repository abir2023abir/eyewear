import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import { countryName } from "@/lib/countries";
import PayTag from "../PayTag";

type SP = Promise<{ q?: string; payment?: string; status?: string; page?: string }>;

export default async function Orders({ searchParams }: { searchParams: SP }) {
  const { q = "", payment = "", status = "", page = "1" } = await searchParams;
  const where: Prisma.OrderWhereInput = {
    ...(payment ? { paymentStatus: payment } : {}),
    ...(status ? { status } : {}),
    ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { trackingNumber: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const p = Math.max(1, Number(page) || 1);
  const [orders, total] = await Promise.all([
    db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (p - 1) * 30, take: 30, include: { items: { select: { qty: true, prescription: true } } } }),
    db.order.count({ where }),
  ]);
  const qs = (patch: Record<string, string>) => "?" + new URLSearchParams({ q, payment, status, ...patch }).toString();

  return (
    <div className="grid gap-5">
      <h1 className="h-section !text-3xl">Orders & payments</h1>
      <form className="flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Order no., email, name, tracking…" className="input !w-72" />
        <select name="payment" defaultValue={payment} className="select !w-52">
          <option value="">All payments</option>
          <option value="unpaid">Unpaid</option>
          <option value="awaiting_verification">Transfer to verify</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
        <select name="status" defaultValue={status} className="select !w-52">
          <option value="">All statuses</option>
          {["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <button className="btn btn-primary">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table min-w-[860px]">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Frames</th><th>Total</th><th>Method</th><th>Payment</th><th>Status</th><th>Rx</th></tr></thead>
          <tbody>
            {orders.map((o) => {
              const rxLater = o.items.some((i) => i.prescription.includes('"mode":"later"'));
              return (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-bold text-[var(--blue)]">{o.number}</Link></td>
                  <td className="text-xs">{o.createdAt.toLocaleString()}</td>
                  <td>{o.name}<div className="text-xs muted">{o.email} · {countryName(o.country)}</div></td>
                  <td>{o.items.reduce((s, i) => s + i.qty, 0)}</td>
                  <td className="font-semibold">{usd(o.total)}</td>
                  <td className="capitalize">{o.paymentMethod}</td>
                  <td><PayTag s={o.paymentStatus} /></td>
                  <td className="capitalize text-sm">{o.status.replace(/_/g, " ")}</td>
                  <td>{rxLater ? <span className="tag tag-warn">Awaiting Rx</span> : ""}</td>
                </tr>
              );
            })}
            {orders.length === 0 && <tr><td colSpan={9} className="muted">No orders match.</td></tr>}
          </tbody>
        </table>
      </div>
      {total > 30 && (
        <div className="flex gap-2">
          {p > 1 && <Link className="btn btn-outline btn-sm" href={qs({ page: String(p - 1) })}>← Newer</Link>}
          {p * 30 < total && <Link className="btn btn-outline btn-sm" href={qs({ page: String(p + 1) })}>Older →</Link>}
        </div>
      )}
    </div>
  );
}
