"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CustomerActions({ id, name, role, isSelf }: { id: string; name: string; role: string; isSelf: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pw, setPw] = useState("");
  const [nm, setNm] = useState(name);

  const act = async (body: Record<string, unknown>, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    setMsg(null);
    const r = await fetch(`/api/admin/customers/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setMsg({ ok: r.ok, text: r.ok ? j.message : j.error || "Failed" });
    if (r.ok && j.deleted) return router.push("/admin/customers");
    if (r.ok) router.refresh();
  };

  return (
    <div className="card p-6 grid gap-4 text-sm">
      <div className="font-bold">Account actions</div>
      {msg && <div className={`rounded-lg px-3 py-2 font-semibold ${msg.ok ? "bg-[#e3f7ec] text-[var(--ok)]" : "bg-[#fde8e8] text-[var(--bad)]"}`}>{msg.text}</div>}
      <div className="grid gap-2">
        <label className="label !mb-0">Name</label>
        <div className="flex gap-2">
          <input className="input" value={nm} onChange={(e) => setNm(e.target.value)} />
          <button className="btn btn-outline btn-sm" disabled={!nm.trim() || nm === name} onClick={() => act({ action: "rename", name: nm })}>Save</button>
        </div>
      </div>
      <div className="grid gap-2">
        <label className="label !mb-0">Access</label>
        {role === "admin" ? (
          <button className="btn btn-outline" disabled={isSelf} onClick={() => act({ action: "role", role: "customer" }, "Remove admin access from this account?")}>Remove admin access</button>
        ) : (
          <button className="btn btn-blue" onClick={() => act({ action: "role", role: "admin" }, "Give this person FULL admin access (orders, payments, settings)?")}>Make admin</button>
        )}
        {isSelf && <p className="text-xs muted">You can’t remove your own admin access.</p>}
      </div>
      <div className="grid gap-2">
        <label className="label !mb-0">Set a new password</label>
        <input className="input" type="password" autoComplete="new-password" placeholder="Min 10 characters" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="btn btn-outline" disabled={pw.length < 10} onClick={() => { act({ action: "password", password: pw }); setPw(""); }}>Set password</button>
        <p className="text-xs muted">Tell the customer their new password privately. They’ll be signed out everywhere.</p>
      </div>
      <button className="btn btn-outline" onClick={() => act({ action: "signout" }, "Sign this account out on all devices?")}>Sign out everywhere</button>
      {!isSelf && (
        <button className="btn btn-ghost !text-[var(--bad)]" onClick={() => act({ action: "delete", confirm: "DELETE" }, "Permanently delete this account? Their orders are kept.")}>Delete account</button>
      )}
    </div>
  );
}
