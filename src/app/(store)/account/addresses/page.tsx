import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import AccountClient from "../AccountClient";

export const dynamic = "force-dynamic";

export default async function AccountAddresses() {
  const s = await getSession();
  if (!s) redirect("/login?next=/account/addresses");
  const [addresses, prescriptions] = await Promise.all([
    db.address.findMany({ where: { userId: s.uid }, orderBy: { isDefault: "desc" } }),
    db.prescription.findMany({ where: { userId: s.uid }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <AccountClient
      addresses={addresses.map(({ userId: _u, ...a }) => a)}
      prescriptions={prescriptions.map(({ userId: _u, createdAt: _c, ...p }) => p)}
    />
  );
}
