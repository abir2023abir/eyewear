"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usd } from "@/lib/money";

type L = { id: string; kind: string; code: string; name: string; description: string; price: number; sortOrder: number; active: boolean };

const GROUPS = [
  {
    kind: "type",
    en: "Lens types",
    help: "The customer picks ONE of these (or “Frame only”). Untick “Show” to hide a lens type from the website.",
  },
  {
    kind: "coating",
    en: "Optional upgrades & coatings",
    help: "The customer can tick SEVERAL of these. Each price is added to every frame they order.",
  },
] as const;

export default function LensEditor({ lenses }: { lenses: L[] }) {
  const [rows, setRows] = useState(lenses);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [nw, setNw] = useState({ kind: "coating" as "type" | "coating", name: "", description: "", price: "" });
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => setRows(lenses), [lenses]);
  const set = (id: string, patch: Partial<L>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const dirty = JSON.stringify(rows) !== JSON.stringify(lenses);
  const post = async (body: unknown, ok: string) => {
    setBusy(true);
    const r = await fetch("/api/admin/lenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg({ ok: r.ok, text: r.ok ? ok : j.error || "Failed" });
    if (r.ok) router.refresh();
    return r.ok;
  };

  const shownTypes = rows.filter((r) => r.kind === "type" && r.code !== "none" && r.active);
  const shownCoats = rows.filter((r) => r.kind === "coating" && r.active);
  const exFrame = 2900;
  const exUp = shownTypes[0] || shownCoats[0];

  return (
    <div className="grid gap-5">
      <div className="card p-5 bg-[var(--sky-2)] text-sm leading-relaxed">
        <b>How lens prices work</b>
        <p className="mt-1">Prices are in US$ <b>per frame</b>. Whatever the customer chooses is added on top of the frame price.
          {exUp && <> Example: a {usd(exFrame)} frame + “{exUp.name}” ({usd(exUp.price)}) = <b>{usd(exFrame + exUp.price)}</b>.</>}
        </p>
        <p className="mt-2">Right now customers see: <b>{shownTypes.length ? `${shownTypes.length} lens type(s)` : "no lens types (frames sold on their own)"}</b> and <b>{shownCoats.length} upgrade(s)</b>.</p>
      </div>

      {msg && <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${msg.ok ? "bg-[#e3f7ec] text-[var(--ok)]" : "bg-[#fde8e8] text-[var(--bad)]"}`}>{msg.text}</div>}

      {GROUPS.map((g) => {
        const list = rows.filter((r) => r.kind === g.kind && r.code !== "none");
        return (
          <section key={g.kind} className="card p-6 grid gap-4">
            <div>
              <div className="font-display text-xl font-semibold text-[var(--navy)]">{g.en}</div>
              <p className="text-xs muted mt-1">{g.help}</p>
            </div>
            {list.length === 0 && <p className="text-sm muted">None yet — add one below.</p>}
            {list.map((l) => (
              <div key={l.id} className={`grid sm:grid-cols-[1fr_130px_120px] gap-3 items-start rounded-xl border p-4 ${l.active ? "border-[var(--line)]" : "border-dashed border-[var(--line)] opacity-70"}`}>
                <div className="grid gap-2">
                  <input className="input !py-2 font-bold" value={l.name} onChange={(e) => set(l.id, { name: e.target.value })} aria-label="Name" />
                  <textarea className="textarea !py-2 text-sm" rows={2} value={l.description} onChange={(e) => set(l.id, { description: e.target.value })} aria-label="Description" placeholder="Short explanation for customers" />
                </div>
                <div>
                  <label className="label">Price per frame (US$)</label>
                  <input className="input !py-2" type="number" step="0.01" min="0" value={l.price / 100} onChange={(e) => set(l.id, { price: Math.round(Number(e.target.value) * 100) })} />
                </div>
                <div className="grid gap-2 sm:mt-6">
                  <label className={`flex items-center gap-2 text-sm font-semibold ${l.active ? "text-[var(--ok)]" : "muted"}`}>
                    <input type="checkbox" checked={l.active} onChange={(e) => set(l.id, { active: e.target.checked })} /> {l.active ? "Shown" : "Hidden"}
                  </label>
                  <button className="text-xs text-[var(--bad)] font-bold text-left" onClick={() => confirm(`Delete “${l.name}” permanently?\n(Tip: untick “Shown” to just hide it.)`) && post({ remove: l.id }, "Deleted.")}>Delete</button>
                </div>
              </div>
            ))}
          </section>
        );
      })}

      <div className="sticky bottom-3 z-10 flex items-center gap-3">
        <button className="btn btn-primary btn-lg shadow-lg" disabled={busy || !dirty} onClick={() => post({ items: rows }, "Saved ✓ — prices updated on the website.")}>
          {busy ? "Saving…" : "Save prices"}
        </button>
        {dirty && <span className="text-sm font-semibold text-[var(--warn)] bg-white rounded-full px-3 py-1 shadow">Unsaved changes</span>}
      </div>

      <section className="card p-6 grid gap-3">
        <div className="font-bold">Add a new option</div>
        <div className="grid sm:grid-cols-[220px_1fr_140px] gap-3">
          <select className="select" value={nw.kind} onChange={(e) => setNw({ ...nw, kind: e.target.value as "type" | "coating" })}>
            <option value="coating">Upgrade / coating (pick several)</option>
            <option value="type">Lens type (pick one)</option>
          </select>
          <input className="input" placeholder="Name, e.g. Blue-light filter" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} />
          <input className="input" placeholder="Price US$" inputMode="decimal" value={nw.price} onChange={(e) => setNw({ ...nw, price: e.target.value.replace(/[^0-9.]/g, "") })} />
          <textarea className="textarea sm:col-span-3" rows={2} placeholder="Short description shown to customers" value={nw.description} onChange={(e) => setNw({ ...nw, description: e.target.value })} />
        </div>
        <button
          className="btn btn-outline w-fit"
          disabled={!nw.name.trim() || busy}
          onClick={async () => {
            if (await post({ create: { kind: nw.kind, name: nw.name, description: nw.description, price: Math.round((parseFloat(nw.price) || 0) * 100) } }, "Added — it is shown on the website now.")) setNw({ kind: nw.kind, name: "", description: "", price: "" });
          }}
        >
          + Add
        </button>
      </section>
    </div>
  );
}
