import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { usd } from "@/lib/money";
import { countryName } from "@/lib/countries";
import PayTag from "../../PayTag";
import CustomerActions from "./CustomerActions";

export default async function Customer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [u, me] = await Promise.all([
    db.user.findUnique({
      where: { id },
      include: { orders: { orderBy: { createdAt: "desc" } }, addresses: true, prescriptions: { orderBy: { createdAt: "desc" } }, wishlist: { include: { product: { select: { name: true, modelCode: true, slug: true } } } } },
    }),
    getSession(),
  ]);
  if (!u) notFound();
  const spent = u.orders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.total, 0);

  return (
    <div className="grid gap-6 max-w-6xl">
      <div>
        <Link href="/admin/customers" className="text-sm text-[var(--blue)] font-bold">← Customers</Link>
        <h1 className="h-section !text-3xl mt-1">{u.name}</h1>
        <p className="muted text-sm">{u.email} · {u.role === "admin" ? "Admin" : "Customer"} · joined {u.createdAt.toLocaleDateString()} · {u.orders.length} orders · {usd(spent)} paid</p>
      </div>
      <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="grid gap-6">
          <div className="card overflow-x-auto">
            <div className="p-5 font-bold">Orders</div>
            <table className="table">
              <thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th></tr></thead>
              <tbody>
                {u.orders.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`} className="font-bold text-[var(--blue)]">{o.number}</Link></td>
                    <td className="text-sm">{o.createdAt.toLocaleDateString()}</td>
                    <td className="font-semibold">{usd(o.total)}</td>
                    <td><PayTag s={o.paymentStatus} /></td>
                    <td className="capitalize text-sm">{o.status.replace(/_/g, " ")}</td>
                  </tr>
                ))}
                {u.orders.length === 0 && <tr><td colSpan={5} className="muted">No orders yet.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card p-5 text-sm">
              <div className="font-bold mb-3">Saved addresses</div>
              {u.addresses.map((a) => (
                <div key={a.id} className="border-b border-[var(--line)] py-2 last:border-0">
                  <b>{a.label}</b>{a.isDefault && <span className="tag tag-light ml-2">Default</span>}
                  <div className="muted">{a.name}, {a.line1}{a.line2 && `, ${a.line2}`}, {a.city} {a.postcode}, {countryName(a.country)} · {a.phone}</div>
                </div>
              ))}
              {u.addresses.length === 0 && <p className="muted">None</p>}
            </div>
            <div className="card p-5 text-sm">
              <div className="font-bold mb-3">Saved prescriptions</div>
              {u.prescriptions.map((p) => (
                <div key={p.id} className="border-b border-[var(--line)] py-2 last:border-0">
                  <b>{p.label}</b>
                  <div className="muted">R {p.odSph}/{p.odCyl}×{p.odAxis || "—"} · L {p.osSph}/{p.osCyl}×{p.osAxis || "—"} · PD {p.pd || `${p.pdRight}/${p.pdLeft}`}{p.add && ` · ADD ${p.add}`}</div>
                  {p.uploadId && <a href={`/api/files/${p.uploadId}`} target="_blank" rel="noopener" className="text-[var(--blue)] text-xs font-bold">View photo ↗</a>}
                </div>
              ))}
              {u.prescriptions.length === 0 && <p className="muted">None</p>}
            </div>
          </div>
          {u.wishlist.length > 0 && (
            <div className="card p-5 text-sm">
              <div className="font-bold mb-2">Wishlist</div>
              <div className="flex flex-wrap gap-2">
                {u.wishlist.map((w) => <Link key={w.id} href={`/product/${w.product.slug}`} target="_blank" className="chip">{w.product.name} {w.product.modelCode}</Link>)}
              </div>
            </div>
          )}
        </div>
        <CustomerActions id={u.id} name={u.name} role={u.role} isSelf={me?.uid === u.id} />
      </div>
    </div>
  );
}
