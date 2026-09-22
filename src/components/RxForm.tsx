"use client";
import { useEffect, useState } from "react";
import type { Rx } from "./Providers";
import { useStore } from "./Providers";
import Icon from "./Icon";
import { prepareUpload } from "@/lib/shrink-image";

const range = (from: number, to: number, step: number) => {
  const out: string[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push((v > 0 ? "+" : "") + v.toFixed(2));
  return out;
};
export const SPH = range(-20, 12, 0.25).map((v) => (v === "+0.00" || v === "-0.00" ? "0.00" : v));
export const CYL = range(-6, 6, 0.25).map((v) => (v === "+0.00" || v === "-0.00" ? "0.00" : v));
export const ADD = ["", ...range(0.75, 3.5, 0.25)];
const PD = Array.from({ length: 61 }, (_, i) => (50 + i * 0.5).toFixed(1));
const HALF_PD = Array.from({ length: 31 }, (_, i) => (25 + i * 0.5).toFixed(1));

export function validateRx(rx: Rx): string | null {
  for (const eye of ["od", "os"] as const) {
    const cyl = parseFloat(rx[`${eye}Cyl`] || "0");
    const axis = rx[`${eye}Axis`];
    if (cyl !== 0 && (!axis || +axis < 1 || +axis > 180)) return `${eye === "od" ? "Right" : "Left"} eye: AXIS (1–180) is required when CYL is set.`;
  }
  if (!rx.pd && !(rx.pdRight && rx.pdLeft)) return "Please enter your PD (or right + left PD).";
  return null;
}

type Props = {
  value: Rx;
  onChange: (rx: Rx) => void;
  estimatedPd?: number | null;
};

export default function RxForm({ value, onChange, estimatedPd }: Props) {
  const [dual, setDual] = useState(!!(value.pdLeft || value.pdRight));
  const set = (k: keyof Rx, v: string) => onChange({ ...value, [k]: v });
  const { me } = useStore();
  const [saved, setSaved] = useState<(Rx & { id: string; label: string })[]>([]);

  useEffect(() => {
    if (!me) return;
    fetch("/api/account/prescriptions").then((r) => r.json()).then((j) => setSaved(j.items || [])).catch(() => {});
  }, [me]);

  const Sel = ({ k, opts, placeholder }: { k: keyof Rx; opts: string[]; placeholder?: string }) => (
    <select className="select !px-2 !py-2 text-[13px]" value={value[k] || (placeholder ? "" : "0.00")} onChange={(e) => set(k, e.target.value)} aria-label={k}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div className="grid gap-3">
      {saved.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="muted">Use saved:</span>
          {saved.map((s) => (
            <button type="button" key={s.id} className="chip hover:border-[var(--blue)]" onClick={() => { const { id: _i, label: _l, ...rx } = s; onChange(rx); setDual(!!(rx.pdLeft || rx.pdRight)); }}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[440px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider muted">
              <th className="text-left font-bold py-1 w-24">Eye</th>
              <th className="font-bold">SPH</th>
              <th className="font-bold">CYL</th>
              <th className="font-bold">AXIS</th>
              <th className="font-bold">ADD</th>
            </tr>
          </thead>
          <tbody>
            {([["od", "Right (OD)"], ["os", "Left (OS)"]] as const).map(([e, label]) => (
              <tr key={e}>
                <td className="font-bold py-1.5">{label}</td>
                <td className="px-1"><Sel k={`${e}Sph`} opts={SPH} /></td>
                <td className="px-1"><Sel k={`${e}Cyl`} opts={CYL} /></td>
                <td className="px-1">
                  <input className="input !px-2 !py-2 text-[13px]" inputMode="numeric" placeholder="—" maxLength={3} value={value[`${e}Axis`] || ""} onChange={(ev) => set(`${e}Axis`, ev.target.value.replace(/\D/g, "").slice(0, 3))} aria-label={`${label} axis`} />
                </td>
                <td className="px-1">{e === "od" ? <Sel k="add" opts={ADD.slice(1)} placeholder="—" /> : <span className="muted text-xs">same</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {!dual ? (
          <div>
            <label className="label">PD (mm)</label>
            <select className="select !py-2 w-28" value={value.pd || ""} onChange={(e) => set("pd", e.target.value)}>
              <option value="">Select</option>
              {PD.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="label">Right PD</label>
              <select className="select !py-2 w-24" value={value.pdRight || ""} onChange={(e) => set("pdRight", e.target.value)}>
                <option value="">—</option>
                {HALF_PD.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Left PD</label>
              <select className="select !py-2 w-24" value={value.pdLeft || ""} onChange={(e) => set("pdLeft", e.target.value)}>
                <option value="">—</option>
                {HALF_PD.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          </>
        )}
        <label className="flex items-center gap-2 text-sm pb-2.5">
          <input type="checkbox" checked={dual} onChange={(e) => { setDual(e.target.checked); onChange({ ...value, pd: e.target.checked ? "" : value.pd, pdLeft: e.target.checked ? value.pdLeft : "", pdRight: e.target.checked ? value.pdRight : "" }); }} />
          Two PD numbers
        </label>
        {estimatedPd ? (
          <button type="button" className="btn btn-ghost btn-sm pb-2.5" onClick={() => set("pd", (Math.round(estimatedPd * 2) / 2).toFixed(1))}>
            <Icon name="ruler" size={14} /> Use try-on estimate ({estimatedPd.toFixed(1)} mm)
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Uploads a prescription photo and returns the upload id. */
export function RxUpload({ onDone, current }: { onDone: (id: string, name: string) => void; current?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr("");
    let file: File;
    try { file = await prepareUpload(f); } catch (e: any) { setBusy(false); return setErr(e.message); }
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "prescription");
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Upload failed");
    onDone(j.id, f.name);
  };
  return (
    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[var(--line)] rounded-2xl p-6 cursor-pointer hover:border-[var(--blue)] text-center">
      <Icon name="upload" size={26} className="text-[var(--blue)]" />
      <span className="font-bold text-sm">{busy ? "Uploading…" : current ? `Uploaded: ${current}` : "Upload a photo or PDF of your prescription"}</span>
      <span className="text-xs muted">JPG, PNG, WEBP, HEIC or PDF · max 4 MB · our optician checks it before cutting</span>
      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {err && <span className="err">{err}</span>}
    </label>
  );
}
