import Link from "next/link";
import { db } from "@/lib/db";
import ManualOrderForm from "./ManualOrderForm";

export default async function NewOrder() {
  const lenses = await db.lensOption.findMany({ where: { active: true, kind: "type" }, orderBy: { sortOrder: "asc" }, select: { code: true, name: true, price: true } });
  return (
    <div className="grid gap-5 max-w-5xl">
      <div>
        <Link href="/admin/orders" className="text-sm text-[var(--blue)] font-bold">← Orders</Link>
        <h1 className="h-section !text-3xl mt-1">Create manual order</h1>
        <p className="muted text-sm">For WhatsApp, phone or in-person customers. You can override prices, set shipping by hand, and send the customer a payment link.</p>
      </div>
      <ManualOrderForm lenses={lenses} />
    </div>
  );
}
