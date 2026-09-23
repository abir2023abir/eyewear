"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductDTO } from "@/lib/types";

type Job = { p: ProductDTO; v: ProductDTO["variants"][number] };

async function upload(blob: Blob, name: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", new File([blob], name, { type: blob.type }));
  fd.append("kind", "image");
  const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(j.error || "Upload failed");
  return j.url as string;
}

export default function StudioPhotos({ products }: { products: ProductDTO[] }) {
  const router = useRouter();
  const [redo, setRedo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [log, setLog] = useState<{ ok: boolean; text: string }[]>([]);
  const [preview, setPreview] = useState<string[]>([]);

  const jobs: Job[] = products.flatMap((p) => p.variants.filter((v) => redo || v.images.length === 0).map((v) => ({ p, v })));

  const run = async () => {
    setBusy(true);
    setDone(0);
    setTotal(jobs.length);
    setLog([]);
    setPreview([]);
    const { renderStudioShots } = await import("@/lib/studio-render");
    for (const [i, { p, v }] of jobs.entries()) {
      const label = `${p.name} ${p.modelCode} — ${v.colorName}`;
      try {
        const [folded, open] = await renderStudioShots(p, v);
        const ext = folded.type === "image/webp" ? "webp" : "png";
        const urls = [await upload(folded, `${v.sku}-folded.${ext}`), await upload(open, `${v.sku}-open.${ext}`)];
        const r = await fetch(`/api/admin/products/${p.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "images", variantId: v.id, images: urls }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Could not save");
        setPreview((x) => [...x.slice(-7), urls[0]]);
        setLog((l) => [...l, { ok: true, text: label }]);
      } catch (e: any) {
        setLog((l) => [...l, { ok: false, text: `${label}: ${e?.message || "failed"}` }]);
      }
      setDone(i + 1);
    }
    setBusy(false);
    router.refresh();
  };

  const failed = log.filter((l) => !l.ok);
  return (
    <div className="card p-5 grid gap-4">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={redo} disabled={busy} onChange={(e) => setRedo(e.target.checked)} className="mt-1" />
        <span>Also redo colours that already have photos <span className="muted">(replaces their photos — only tick this if they are studio photos made here)</span></span>
      </label>
      <button className="btn btn-primary justify-self-start" disabled={busy || jobs.length === 0} onClick={run}>
        {busy ? `Creating… ${done} / ${total}` : jobs.length ? `Create photos for ${jobs.length} colour${jobs.length === 1 ? "" : "s"}` : "All colours already have photos"}
      </button>
      {total > 0 && (
        <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden">
          <div className="h-full bg-[var(--blue)] transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}
      {preview.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {preview.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" className="w-full aspect-[4/3] object-contain rounded-lg bg-[#f4f7fc]" />
          ))}
        </div>
      )}
      {!busy && total > 0 && (
        <p className={`text-sm font-semibold ${failed.length ? "text-[var(--bad)]" : "text-[var(--ok,#16a34a)]"}`}>
          Done — {total - failed.length} colour(s) now have studio photos{failed.length ? `, ${failed.length} failed` : ""}.
        </p>
      )}
      {failed.map((l) => (
        <div key={l.text} className="text-xs text-[var(--bad)]">✕ {l.text}</div>
      ))}
    </div>
  );
}
