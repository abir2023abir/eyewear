"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import RxForm, { RxUpload, validateRx } from "@/components/RxForm";
import type { Rx } from "@/components/Providers";
import { COUNTRIES, countryName } from "@/lib/countries";

type Address = { id: string; label: string; name: string; phone: string; line1: string; line2: string; city: string; state: string; postcode: string; country: string; isDefault: boolean };
type Prescription = Rx & { id: string; label: string; uploadId: string | null };

const emptyAddr: Omit<Address, "id"> = { label: "Home", name: "", phone: "", line1: "", line2: "", city: "", state: "", postcode: "", country: "", isDefault: false };

export default function AccountClient({ addresses, prescriptions }: { addresses: Address[]; prescriptions: Prescription[] }) {
  const router = useRouter();
  const [addr, setAddr] = useState<(Omit<Address, "id"> & { id?: string }) | null>(null);
  const [rx, setRx] = useState<(Prescription & { uploadName?: string }) | null>(null);
  const [err, setErr] = useState("");

  const saveAddr = async () => {
    setErr("");
    const r = await fetch("/api/account/addresses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(addr) });
    if (!r.ok) return setErr((await r.json()).error || "Could not save");
    setAddr(null);
    router.refresh();
  };
  const delAddr = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    await fetch("/api/account/addresses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
  };
  const saveRx = async () => {
    setErr("");
    if (!rx) return;
    if (!rx.uploadId) {
      const e = validateRx(rx);
      if (e) return setErr(e);
    }
    const { uploadName: _n, ...body } = rx;
    const r = await fetch("/api/account/prescriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) return setErr((await r.json()).error || "Could not save");
    setRx(null);
    router.refresh();
  };
  const delRx = async (id: string) => {
    if (!confirm("Delete this prescription?")) return;
    await fetch("/api/account/prescriptions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
  };

  const setA = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setAddr((a) => ({ ...a!, [k]: e.target.value }));

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <section className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Saved addresses</h2>
          <button className="btn btn-outline btn-sm" onClick={() => setAddr({ ...emptyAddr })}>+ Add</button>
        </div>
        <div className="grid gap-3">
          {addresses.length === 0 && !addr && <p className="muted text-sm">No saved addresses yet — they’re saved automatically at checkout.</p>}
          {addresses.map((a) => (
            <div key={a.id} className="card-flat p-4 text-sm flex justify-between gap-3">
              <div>
                <div className="font-bold">{a.label} {a.isDefault && <span className="tag tag-light ml-1">Default</span>}</div>
                <div className="muted">{a.name}, {a.line1}{a.line2 && `, ${a.line2}`}, {a.city} {a.postcode}, {countryName(a.country)} · {a.phone}</div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="text-[var(--blue)] font-bold" onClick={() => setAddr(a)}>Edit</button>
                <button className="text-[var(--bad)] font-bold" onClick={() => delAddr(a.id)}>Delete</button>
              </div>
            </div>
          ))}
          {addr && (
            <div className="card-flat p-4 grid sm:grid-cols-2 gap-3">
              <input className="input" placeholder="Label (Home, Work…)" value={addr.label} onChange={setA("label")} />
              <input className="input" placeholder="Full name" value={addr.name} onChange={setA("name")} />
              <input className="input sm:col-span-2" placeholder="Address line 1" value={addr.line1} onChange={setA("line1")} />
              <input className="input sm:col-span-2" placeholder="Address line 2" value={addr.line2} onChange={setA("line2")} />
              <input className="input" placeholder="City" value={addr.city} onChange={setA("city")} />
              <input className="input" placeholder="State / region" value={addr.state} onChange={setA("state")} />
              <input className="input" placeholder="Postcode" value={addr.postcode} onChange={setA("postcode")} />
              <select className="select" value={addr.country} onChange={setA("country")}>
                <option value="">Country</option>
                {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
              <input className="input" placeholder="Phone" value={addr.phone} onChange={setA("phone")} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={addr.isDefault} onChange={(e) => setAddr({ ...addr, isDefault: e.target.checked })} /> Default address</label>
              <div className="sm:col-span-2 flex gap-2">
                <button className="btn btn-primary btn-sm" onClick={saveAddr}>Save address</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setAddr(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Saved prescriptions</h2>
          <button className="btn btn-outline btn-sm" onClick={() => setRx({ id: "", label: "My prescription", uploadId: null })}>+ Add</button>
        </div>
        <div className="grid gap-3">
          {prescriptions.length === 0 && !rx && <p className="muted text-sm">Save your prescription once and reuse it on every order.</p>}
          {prescriptions.map((p) => (
            <div key={p.id} className="card-flat p-4 text-sm flex justify-between gap-3">
              <div>
                <div className="font-bold">{p.label}</div>
                <div className="muted">R {p.odSph} / {p.odCyl} × {p.odAxis || "—"} · L {p.osSph} / {p.osCyl} × {p.osAxis || "—"} · PD {p.pd || `${p.pdRight}/${p.pdLeft}`}</div>
                {p.uploadId && <a href={`/api/files/${p.uploadId}`} target="_blank" rel="noopener" className="text-[var(--blue)] text-xs font-bold">View photo</a>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="text-[var(--blue)] font-bold" onClick={() => setRx(p)}>Edit</button>
                <button className="text-[var(--bad)] font-bold" onClick={() => delRx(p.id)}>Delete</button>
              </div>
            </div>
          ))}
          {rx && (
            <div className="card-flat p-4 grid gap-3">
              <input className="input" placeholder="Name, e.g. Reading glasses 2026" value={rx.label} onChange={(e) => setRx({ ...rx, label: e.target.value })} />
              <RxForm value={rx} onChange={(v) => setRx({ ...rx, ...v })} />
              <RxUpload current={rx.uploadName} onDone={(id, name) => setRx({ ...rx, uploadId: id, uploadName: name })} />
              <div className="flex gap-2">
                <button className="btn btn-primary btn-sm" onClick={saveRx}>Save prescription</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setRx(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>
      {err && <p className="err lg:col-span-2">{err}</p>}
    </div>
  );
}
