import Link from "next/link";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import NewUserForm from "./NewUserForm";

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const { q = "", role = "" } = await searchParams;
  const users = await db.user.findMany({
    where: {
      ...(role ? { role } : {}),
      ...(q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { orders: { select: { total: true, paymentStatus: true } }, _count: { select: { addresses: true, prescriptions: true, wishlist: true } } },
  });
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="h-section !text-3xl">Customers & admins</h1>
          <p className="muted text-sm">{users.length} account{users.length === 1 ? "" : "s"} shown. Guest orders appear in Orders.</p>
        </div>
        <NewUserForm />
      </div>
      <form className="flex gap-2 flex-wrap">
        <input name="q" defaultValue={q} placeholder="Search name or email…" className="input !w-72" />
        <select name="role" defaultValue={role} className="select !w-44">
          <option value="">Everyone</option>
          <option value="customer">Customers</option>
          <option value="admin">Admins</option>
        </select>
        <button className="btn btn-outline">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table min-w-[760px]">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Orders</th><th>Spent (paid)</th><th>Saved</th><th>Joined</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/customers/${u.id}`} className="font-bold text-[var(--blue)]">{u.name}</Link></td>
                <td>{u.email}</td>
                <td>{u.role === "admin" ? <span className="tag">Admin</span> : <span className="tag tag-light">Customer</span>}</td>
                <td>{u.orders.length}</td>
                <td className="font-semibold">{usd(u.orders.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.total, 0))}</td>
                <td className="text-xs muted">{u._count.addresses} addr · {u._count.prescriptions} Rx · {u._count.wishlist} ♥</td>
                <td className="text-sm">{u.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={7} className="muted">No accounts match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
