"use client";
import { useEffect, useRef, useState } from "react";
import { cutoutFrame, type CutoutResult } from "@/lib/photo-cutout";

const CHECKER = "repeating-conic-gradient(#e6ebf3 0% 25%, #ffffff 0% 50%) 50% / 18px 18px";

/**
 * Admin: the "Try-on photo" for one colour. The owner picks a straight-on front photo, the background is
 * removed in the browser, they check the preview (and adjust the strength if needed), then save it.
 */
export default function TryOnPhotoField({
  value, photos, onChange, upload,
}: {
  value: string | null;
  photos: string[];
  onChange: (url: string | null) => void;
  upload: (file: File) => Promise<string>;
}) {
  const [source, setSource] = useState<Blob | null>(null);
  const [strength, setStrength] = useState(45);
  const [result, setResult] = useState<CutoutResult | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const job = useRef(0);

  // re-run the background removal when the photo or strength changes
  useEffect(() => {
    if (!source) return;
    const id = ++job.current;
    setBusy("Removing the background…");
    setErr("");
    const t = setTimeout(() => {
      cutoutFrame(source, strength)
        .then((r) => {
          if (id !== job.current) return URL.revokeObjectURL(r.url);
          setResult((old) => {
            if (old) URL.revokeObjectURL(old.url);
            return r;
          });
        })
        .catch((e) => id === job.current && setErr(e.message || "Could not process this photo."))
        .finally(() => id === job.current && setBusy(""));
    }, 150);
    return () => clearTimeout(t);
  }, [source, strength]);

  const start = (b: Blob) => {
    setResult(null);
    setStrength(45);
    setSource(b);
  };
  const fromExisting = async (url: string) => {
    try {
      setBusy("Loading photo…");
      start(await fetch(url).then((r) => r.blob()));
    } catch {
      setErr("Could not load that photo.");
      setBusy("");
    }
  };
  const cancel = () => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setSource(null);
    setErr("");
  };
  const save = async () => {
    if (!result) return;
    setBusy("Saving…");
    try {
      const url = await upload(new File([result.blob], "try-on.png", { type: "image/png" }));
      onChange(url);
      cancel();
    } catch (e: any) {
      setErr(e.message || "Upload failed");
    }
    setBusy("");
  };

  return (
    <div className="rounded-xl border border-[var(--line)] p-4 grid gap-3">
      <div>
        <div className="font-semibold text-sm">Try-on photo (recommended)</div>
        <p className="text-xs muted mt-1 leading-relaxed">
          Customers see this real photo on their face in the virtual try-on. Take the frame <b>open</b>, <b>straight from the front</b> (like looking at someone wearing it),
          on a <b>plain white or light background</b>, filling most of the picture. The background is removed automatically.
          Without it, the try-on shows the 3D frame instead.
        </p>
      </div>

      {source ? (
        <div className="grid gap-3">
          <div className="rounded-xl overflow-hidden border border-[var(--line)] grid place-items-center min-h-[160px] p-3" style={{ background: CHECKER }}>
            {result ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.url} alt="Try-on photo preview" className="max-h-56 w-auto" />
            ) : (
              <span className="text-sm muted">{busy || "…"}</span>
            )}
          </div>
          <p className="text-xs muted">The checked pattern shows what is see-through. The lens openings should be see-through and the frame should be complete.</p>
          <label className="grid gap-1 text-xs font-semibold">
            Background removal strength: {strength}
            <input type="range" min={0} max={100} value={strength} onChange={(e) => setStrength(+e.target.value)} />
            <span className="font-normal muted">Parts of the frame missing? Move left. Background still showing? Move right.</span>
          </label>
          {err && <p className="err">{err}</p>}
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-primary btn-sm" onClick={save} disabled={!result || !!busy}>{busy === "Saving…" ? "Saving…" : "Use this try-on photo"}</button>
            <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={busy === "Saving…"}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {value && (
            <div className="rounded-xl overflow-hidden border border-[var(--line)] grid place-items-center p-3" style={{ background: CHECKER }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Current try-on photo" className="max-h-44 w-auto" />
            </div>
          )}
          <div className="flex gap-2 flex-wrap items-center">
            {value && <span className="tag tag-ok">Try-on photo ready ✓</span>}
            <label className="btn btn-outline btn-sm cursor-pointer">
              {busy || (value ? "Replace photo" : "Upload front photo")}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) start(f); }} />
            </label>
            {photos.map((u, i) => (
              <button key={u} className="btn btn-ghost btn-sm" onClick={() => fromExisting(u)} disabled={!!busy}>Use photo {i + 1}</button>
            ))}
            {value && <button className="text-[var(--bad)] text-xs font-bold" onClick={() => onChange(null)}>Remove</button>}
          </div>
          {err && <p className="err">{err}</p>}
        </div>
      )}
    </div>
  );
}
