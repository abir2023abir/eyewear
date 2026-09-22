"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewUserForm() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "admin" as "admin" | "customer" });
  const [err, setErr] = useState("");
  const router = useRouter();
  const submit = async () => {
    setErr("");
    const r = await fetch("/api/admin/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error || "Could not create");
    setOpen(false);
    setF({ name: "", email: "", password: "", role: "admin" });
    router.push(`/admin/customers/${j.id}`);
  };
  if (!open) return <button className="btn btn-primary" onClick={() => setOpen(true)}>+ Add admin or customer</button>;
  return (
    <div className="card p-4 grid gap-2 w-full sm:w-[420px]">
      <input className="input" placeholder="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className="input" type="email" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input className="input" type="password" autoComplete="new-password" placeholder="Password (min 10 characters)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "admin" | "customer" })}>
        <option value="admin">Admin (full access to this panel)</option>
        <option value="customer">Customer</option>
      </select>
      {err && <p className="err">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary btn-sm" onClick={submit}>Create account</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
