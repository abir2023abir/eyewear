"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import FrameArt from "@/components/FrameArt";
import { FACE_SHAPES, SHAPES, faceShapesFor } from "@/lib/frame-geometry";
import { FINISH_PRESETS, swatchBg, type Finish } from "@/lib/finish";
import type { ProductDTO } from "@/lib/types";
import TryOnPhotoField from "./TryOnPhotoField";
import { prepareUpload } from "@/lib/shrink-image";
import { sourceFor } from "@/lib/frame-source";

const Viewer360 = dynamic(() => import("@/components/Viewer360"), { ssr: false });

type V = { id?: string; colorName: string; colorHex: string; accentHex: string | null; finish: string; sku: string; stock: number; images: string[]; modelUrl: string | null; tryOnImage: string | null };
type P = Omit<ProductDTO, "variants" | "id"> & { id?: string; active: boolean; isFeatured: boolean; variants: V[] };

const blank: P = {
  slug: "", name: "", modelCode: "", category: "optical", shape: "rectangle", material: "TR90", gender: "unisex", faceShapes: faceShapesFor("rectangle"),
  price: 2900, compareAt: null, description: "", lensWidth: 52, lensHeight: 38, bridge: 18, templeLength: 145, frameWidth: 134, weightGrams: 15,
  modelUrl: null, modelTint: true,
  isNew: true, isBestseller: false, isFeatured: false, active: true,
  variants: [{ colorName: "Black", colorHex: "#16181d", accentHex: null, finish: "solid", sku: "", stock: 10, images: [], modelUrl: null, tryOnImage: null }],
};

const GENDERS: [string, string][] = [["unisex", "Unisex"], ["men", "Men"], ["women", "Women"], ["kids", "Kids"]];
const FINISH_LABEL: Record<Finish, string> = { solid: "Solid", twotone: "Two-tone", gradient: "Gradient" };

export default function ProductEditor({ initial }: { initial: (ProductDTO & { active: boolean; isFeatured: boolean }) | null }) {
  const router = useRouter();
  const [p, setP] = useState<P>(initial ? { ...initial } : blank);
  const [vi, setVi] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState("");
  const [guide, setGuide] = useState(!initial);
  const [sizeCode, setSizeCode] = useState("");
  const v = p.variants[vi] || p.variants[0];

  useEffect(() => {
    try {
      const g = localStorage.getItem("admin-product-guide");
      if (g) setGuide(g === "1");
    } catch {}
  }, []);
  const toggleGuide = () => {
    setGuide((g) => {
      try { localStorage.setItem("admin-product-guide", g ? "0" : "1"); } catch {}
      return !g;
    });
  };

  const set = <K extends keyof P>(k: K, val: P[K]) => setP((x) => ({ ...x, [k]: val }));
  const setV = (i: number, patch: Partial<V>) => setP((x) => ({ ...x, variants: x.variants.map((vv, j) => (j === i ? { ...vv, ...patch } : vv)) }));
  const num = (k: keyof P) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);

  const upload = async (original: File, kind: "image" | "model") => {
    let source = original;
    if (kind === "model") {
      if (original.size > 150 * 1024 * 1024) throw new Error("This 3D file is over 150 MB — please export a smaller version from Tripo or your designer.");
      const { optimizeGlb } = await import("@/lib/glb-optimize");
      const r = await optimizeGlb(original, (t) => setMsg({ ok: true, text: t }));
      if (r.after < r.before) setMsg({ ok: true, text: `Model made smaller for the website: ${(r.before / 1048576).toFixed(1)} MB → ${(r.after / 1048576).toFixed(1)} MB. Uploading…` });
      source = r.file;
    }
    const file = await prepareUpload(source); // shrinks big photos; refuses files over 4 MB
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Upload failed");
    return j.url as string;
  };

  const addPhotos = async (files: File[], at?: number) => {
    const i = vi;
    setMsg(null);
    setUploading(at === undefined ? "more" : `slot${at}`);
    try {
      const urls: string[] = [];
      for (const f of files) {
        urls.push(await upload(f, "image"));
      }
      setP((x) => ({
        ...x,
        variants: x.variants.map((vv, j) => {
          if (j !== i) return vv;
          const imgs = [...vv.images];
          if (at !== undefined && urls.length === 1 && at < imgs.length) imgs[at] = urls[0]; // replace that slot
          else imgs.push(...urls);
          return { ...vv, images: imgs.slice(0, 12) };
        }),
      }));
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
    setUploading("");
  };
  const movePhoto = (k: number, d: -1 | 1) => {
    const imgs = [...v.images];
    const t = k + d;
    if (t < 0 || t >= imgs.length) return;
    [imgs[k], imgs[t]] = [imgs[t], imgs[k]];
    setV(vi, { images: imgs });
  };

  // "52□18-145" printed inside the temple → lens width, bridge, temple length
  const applySizeCode = (s: string) => {
    setSizeCode(s);
    const m = s.match(/(\d{2})\D+(\d{2})\D+(\d{3})/);
    if (m) setP((x) => ({ ...x, lensWidth: +m[1], bridge: +m[2], templeLength: +m[3], frameWidth: x.frameWidth || +m[1] * 2 + +m[2] + 12 }));
  };

  const problems = (): string[] => {
    const e: string[] = [];
    if (!p.name.trim()) e.push("Enter the frame name (step 1).");
    if (!p.modelCode.trim()) e.push("Enter the model code, e.g. 2327 (step 1).");
    if (!(p.price > 0)) e.push("Enter a price above 0 (step 1).");
    p.variants.forEach((x, i) => { if (!x.colorName.trim()) e.push(`Colour ${i + 1} needs a name (step 4).`); });
    return e;
  };

  const save = async () => {
    const e = problems();
    if (e.length) return setMsg({ ok: false, text: e.join(" · ") });
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j.error || "Save failed" });
    if (Array.isArray(j.variantIds)) setP((x) => ({ ...x, slug: j.slug || x.slug, variants: x.variants.map((vv, k) => ({ ...vv, id: j.variantIds[k] || vv.id })) }));
    setMsg({ ok: true, text: "Saved ✓ — it is live in the store now." });
    if (!p.id) router.replace(`/admin/products/${j.id}`);
    else router.refresh();
  };

  const archive = async () => {
    if (!p.id || !confirm(p.active ? "Hide this frame from the store? (You can restore it later.)" : "Show this frame in the store again?")) return;
    await fetch("/api/admin/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...p, active: !p.active }) });
    set("active", !p.active);
    router.refresh();
  };

  const applyPreset = (name: string) => {
    const pr = FINISH_PRESETS.find((x) => x.name === name);
    if (pr) setV(vi, { colorName: pr.name, colorHex: pr.hex, accentHex: pr.accent, finish: pr.finish });
  };
  const setFinish = (f: Finish) =>
    setV(vi, { finish: f, accentHex: f === "solid" ? null : v.accentHex || (f === "gradient" ? "#e7b7c8" : "#f2f2f2") });
  const vFinish: Finish = !v?.accentHex ? "solid" : v.finish === "gradient" ? "gradient" : "twotone";

  return (
    <div className="grid gap-6 max-w-6xl">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <Link href="/admin/products" className="text-sm text-[var(--blue)] font-bold">← All frames</Link>
          <h1 className="h-section !text-3xl mt-1">{p.id ? `${p.name} ${p.modelCode}` : "Add a new frame"}</h1>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button className="btn btn-ghost btn-sm" onClick={toggleGuide}>{guide ? "Hide help" : "Show help"}</button>
          {p.id && p.slug && <Link href={`/product/${p.slug}`} target="_blank" className="btn btn-outline btn-sm">View in store ↗</Link>}
          {p.id && <button className="btn btn-outline btn-sm" onClick={archive}>{p.active ? "Hide from store" : "Show in store"}</button>}
          <button className="btn btn-primary" onClick={save} disabled={busy || !!uploading}>{busy ? "Saving…" : "Save frame"}</button>
        </div>
      </div>
      {msg && <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${msg.ok ? "bg-[#e3f7ec] text-[var(--ok)]" : "bg-[#fde8e8] text-[var(--bad)]"}`}>{msg.text}</div>}

      {guide && (
        <section className="card p-6 bg-[var(--sky-2)]">
          <div className="font-display text-xl font-semibold text-[var(--navy)]">How to add a frame</div>
          <ol className="grid md:grid-cols-5 gap-3 mt-4 text-sm">
            {[
              ["Basic info", "Name, model code, price, shape, men / women / unisex."],
              ["Size", "Copy the numbers printed inside the temple arm, e.g. 52□18-145."],
              ["Where it shows", "Tick “Featured” to show it on the homepage."],
              ["Colours & photos", "One row per colour. Photo 1 folded, photo 2 open, plus a front photo for the try-on."],
              ["Save", "Press “Save frame”. It appears in the store straight away. (Step 5 is only for 3D files.)"],
            ].map(([en, d], i) => (
              <li key={en} className="card-flat bg-white p-4">
                <div className="step-num !w-8 !h-8 !text-sm">{i + 1}</div>
                <div className="font-bold mt-2">{en}</div>
                <p className="muted text-xs mt-1 leading-relaxed">{d}</p>
              </li>
            ))}
          </ol>
          <p className="text-xs muted mt-3">The 3D view and the virtual try-on work automatically for every frame — they are built from the size and colours you enter.</p>
        </section>
      )}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="grid gap-6 min-w-0">
          {/* ---------- 1. basic ---------- */}
          <section className="card p-6">
            <Step n={1} en="Basic information" />
            <div className="grid sm:grid-cols-2 gap-4">
              <F l="Frame name *" hint="Shown big on the product card, e.g. Meridian"><input className="input" value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Meridian" /></F>
              <F l="Model code *" hint="Your factory model number, e.g. 2327"><input className="input" value={p.modelCode} onChange={(e) => set("modelCode", e.target.value)} placeholder="2327" /></F>
              <F l="Type">
                <select className="select" value={p.category} onChange={(e) => set("category", e.target.value)}><option value="optical">Optical / eyeglasses</option><option value="sunglasses">Sunglasses</option></select>
              </F>
              <F l="Made for" hint="Used by the Men / Women / Unisex menu">
                <select className="select" value={p.gender} onChange={(e) => set("gender", e.target.value)}>{GENDERS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </F>
              <F l="Shape">
                <select className="select capitalize" value={p.shape} onChange={(e) => setP((x) => ({ ...x, shape: e.target.value, faceShapes: faceShapesFor(e.target.value) }))}>{SHAPES.map((s) => <option key={s}>{s}</option>)}</select>
              </F>
              <F l="Material">
                <select className="select" value={p.material} onChange={(e) => set("material", e.target.value)}>{["TR90", "Acetate", "Metal", "Titanium"].map((m) => <option key={m}>{m}</option>)}</select>
              </F>
              <F l="Price in US$ *" hint="Price of one frame. Bundle discounts are added automatically.">
                <input className="input" type="number" step="0.01" min="0" value={p.price / 100} onChange={(e) => set("price", Math.round(Number(e.target.value) * 100))} />
              </F>
              <F l="Old price (optional)" hint="If filled, shows as crossed-out “Sale” price">
                <input className="input" type="number" step="0.01" min="0" value={p.compareAt ? p.compareAt / 100 : ""} onChange={(e) => set("compareAt", e.target.value ? Math.round(Number(e.target.value) * 100) : null)} />
              </F>
              <div className="sm:col-span-2"><F l="Description" hint="A few sentences for the product page. Leave empty if unsure."><textarea className="textarea" rows={3} value={p.description} onChange={(e) => set("description", e.target.value)} /></F></div>
            </div>
          </section>

          {/* ---------- 2. size ---------- */}
          <section className="card p-6">
            <Step n={2} en="Size (millimetres)" />
            <div className="grid md:grid-cols-[1fr_220px] gap-5 items-start">
              <div className="grid gap-4">
                <F l="Quick fill: size printed on the temple" hint="Type it like 52-18-145 and the boxes below fill in">
                  <input className="input" value={sizeCode} onChange={(e) => applySizeCode(e.target.value)} placeholder="52□18-145" />
                </F>
                <div className="grid grid-cols-3 gap-3">
                  <F l="Lens width"><input className="input" type="number" value={p.lensWidth} onChange={num("lensWidth")} /></F>
                  <F l="Bridge"><input className="input" type="number" value={p.bridge} onChange={num("bridge")} /></F>
                  <F l="Temple"><input className="input" type="number" value={p.templeLength} onChange={num("templeLength")} /></F>
                  <F l="Lens height"><input className="input" type="number" value={p.lensHeight} onChange={num("lensHeight")} /></F>
                  <F l="Total width"><input className="input" type="number" value={p.frameWidth} onChange={num("frameWidth")} /></F>
                  <F l="Weight (g)"><input className="input" type="number" value={p.weightGrams} onChange={num("weightGrams")} /></F>
                </div>
              </div>
              <div className="card-flat p-3 bg-[var(--sky-2)]">
                <FrameArt spec={p} color={v?.colorHex || "#16181d"} annotate className="w-full" />
                <p className="text-[11px] muted mt-2 text-center">The try-on uses these numbers to show the real size on the customer’s face.</p>
              </div>
            </div>
          </section>

          {/* ---------- 3. visibility ---------- */}
          <section className="card p-6">
            <Step n={3} en="Where it shows" />
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              {([
                ["active", "Visible in store", "Untick to hide the frame without deleting it."],
                ["isFeatured", "Featured on homepage", "Shows in “The collection” at the top of the homepage (first 8)."],
                ["isNew", "New arrival", "Shows in “New arrivals” on the homepage and gets a New badge."],
                ["isBestseller", "Bestseller", "Shows in “Bestsellers” on the homepage."],
              ] as const).map(([k, l, d]) => (
                <label key={k} className={`card-flat p-3 flex gap-3 cursor-pointer ${p[k] ? "!border-[var(--blue)] bg-[var(--sky-2)]" : ""}`}>
                  <input type="checkbox" className="mt-1" checked={p[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} />
                  <span><b>{l}</b><span className="block muted text-xs mt-0.5">{d}</span></span>
                </label>
              ))}
            </div>
            <div className="mt-4">
              <div className="label">Suits face shapes <span className="muted font-normal">(filled automatically from the shape — change only if you want)</span></div>
              <div className="flex flex-wrap gap-2">
                {FACE_SHAPES.map((f) => (
                  <label key={f} className={`chip cursor-pointer capitalize ${p.faceShapes.includes(f) ? "!border-[var(--blue)] !text-[var(--blue)]" : ""}`}>
                    <input type="checkbox" className="hidden" checked={p.faceShapes.includes(f)} onChange={(e) => set("faceShapes", e.target.checked ? [...p.faceShapes, f] : p.faceShapes.filter((x) => x !== f))} />{f}
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- 4. colours ---------- */}
          <section className="card p-6">
            <div className="flex flex-wrap justify-between items-start gap-3">
              <Step n={4} en="Colours, photos & stock" />
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setP((x) => ({ ...x, variants: [...x.variants, { colorName: "", colorHex: "#16181d", accentHex: null, finish: "solid", sku: "", stock: 10, images: [], modelUrl: null, tryOnImage: null }] }));
                  setVi(p.variants.length);
                }}
              >+ Add colour</button>
            </div>
            <p className="text-xs muted -mt-2 mb-4">Each colour is one swatch on the product card. Click a colour to edit it.</p>

            <div className="flex flex-wrap gap-2 mb-5">
              {p.variants.map((x, i) => (
                <button key={x.id || i} onClick={() => setVi(i)} className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm font-semibold ${i === vi ? "border-[var(--navy)] bg-[var(--sky)]" : "border-[var(--line)] bg-white"}`}>
                  <span className="w-6 h-6 rounded-full border border-black/10" style={{ background: swatchBg(x) }} />
                  {x.colorName || `Colour ${i + 1}`}
                  <span className={`text-[11px] ${x.stock > 0 ? "muted" : "text-[var(--bad)]"}`}>({x.stock})</span>
                  {!x.images.length && <span className="text-[10px] text-[var(--warn)]">no photo</span>}
                </button>
              ))}
            </div>

            {v && (
              <div className="rounded-2xl border border-[var(--line)] p-5 grid gap-5">
                <div className="grid sm:grid-cols-3 gap-4">
                  <F l="Colour name *" hint="Customers see this, e.g. White / Pink"><input className="input" value={v.colorName} onChange={(e) => setV(vi, { colorName: e.target.value })} placeholder="White / Pink" /></F>
                  <F l="Stock" hint="0 = shows “Out of stock”"><input className="input" type="number" min={0} value={v.stock} onChange={(e) => setV(vi, { stock: Math.max(0, Number(e.target.value)) })} /></F>
                  <F l="SKU (optional)" hint="Leave empty — made automatically"><input className="input" placeholder={`${p.modelCode || "2327"}-${(v.colorName || "COLOUR").toUpperCase().replace(/[^A-Z0-9]+/g, "")}`} value={v.sku} onChange={(e) => setV(vi, { sku: e.target.value.toUpperCase() })} /></F>
                </div>

                <div>
                  <div className="label">Colour style</div>
                  <div className="flex flex-wrap gap-2">
                    {(["solid", "twotone", "gradient"] as Finish[]).map((f) => (
                      <button key={f} onClick={() => setFinish(f)} className={`chip ${vFinish === f ? "!bg-[var(--navy)] !text-white !border-[var(--navy)]" : ""}`}>
                        <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: swatchBg({ colorHex: "#4a1d3f", accentHex: f === "solid" ? null : "#e7b7c8", finish: f }) }} />
                        {FINISH_LABEL[f]}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-end gap-5 mt-4">
                    <label className="grid gap-1 text-xs font-semibold">
                      {vFinish === "gradient" ? "Top colour" : vFinish === "twotone" ? "Main colour" : "Colour"}
                      <input type="color" value={v.colorHex} onChange={(e) => setV(vi, { colorHex: e.target.value })} className="w-16 h-11 rounded-lg cursor-pointer" />
                    </label>
                    {vFinish !== "solid" && (
                      <label className="grid gap-1 text-xs font-semibold">
                        {vFinish === "gradient" ? "Bottom colour" : "Top bar colour"}
                        <input type="color" value={v.accentHex || "#ffffff"} onChange={(e) => setV(vi, { accentHex: e.target.value })} className="w-16 h-11 rounded-lg cursor-pointer" />
                      </label>
                    )}
                    <div className="grid gap-1 text-xs font-semibold">
                      Swatch
                      <span className="w-11 h-11 rounded-full border-2 border-white shadow" style={{ background: swatchBg(v) }} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs muted mb-2">Or tap a ready-made colour:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {FINISH_PRESETS.map((pr) => (
                        <button key={pr.name} onClick={() => applyPreset(pr.name)} className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-[var(--line)] bg-white text-xs hover:border-[var(--blue)]">
                          <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: swatchBg({ colorHex: pr.hex, accentHex: pr.accent, finish: pr.finish }) }} />
                          {pr.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* photos */}
                <div>
                  <div className="label">Photos of “{v.colorName || "this colour"}”</div>
                  <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                    {[0, 1].map((k) => (
                      <PhotoSlot
                        key={k}
                        label={k === 0 ? "1 · Folded" : "2 · Open"}
                        src={v.images[k]}
                        busy={uploading === `slot${k}`}
                        onFile={(f) => addPhotos([f], k < v.images.length ? k : undefined)}
                        onRemove={() => setV(vi, { images: v.images.filter((_, j) => j !== k) })}
                        onLeft={k > 0 ? () => movePhoto(k, -1) : undefined}
                        onRight={k < v.images.length - 1 ? () => movePhoto(k, 1) : undefined}
                        disabled={k > v.images.length}
                      />
                    ))}
                    {v.images.slice(2).map((src, j) => (
                      <PhotoSlot key={src} label={`${j + 3} · Extra`} src={src} onRemove={() => setV(vi, { images: v.images.filter((_, x) => x !== j + 2) })} onLeft={() => movePhoto(j + 2, -1)} onRight={j + 2 < v.images.length - 1 ? () => movePhoto(j + 2, 1) : undefined} />
                    ))}
                    {v.images.length >= 2 && (
                      <label className="aspect-[4/3] rounded-xl border-2 border-dashed border-[var(--line)] grid place-items-center text-xs font-semibold cursor-pointer hover:border-[var(--blue)] text-center p-2">
                        {uploading === "more" ? "Uploading…" : "+ More photos"}
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) addPhotos(fs); }} />
                      </label>
                    )}
                  </div>
                  <div className="mt-3 rounded-xl bg-[var(--sky-2)] p-3 text-xs leading-relaxed">
                    <b>Photo tips:</b> JPG, PNG or WebP (big photos are made smaller automatically) · white or light background · frame in the middle · at least 1200 px wide · all photos the same size (4:3 looks best).
                    <br />Photo 1 = frame <b>folded</b> (shown first on the card). Photo 2 = frame <b>open</b> (the “Open” button). Use the ◀ ▶ arrows to change the order.
                    <br /><span className="muted">No photo yet? The store shows a drawing of the frame in this colour until you add one.</span>
                  </div>
                </div>

                {/* photo try-on */}
                <TryOnPhotoField key={v.id || vi} value={v.tryOnImage} photos={v.images} onChange={(url) => setV(vi, { tryOnImage: url })} upload={(file) => upload(file, "image")} />

                {/* 3D model */}
                <details className="rounded-xl border border-[var(--line)] p-4" open={!!v.modelUrl}>
                  <summary className="cursor-pointer font-semibold text-sm">Different 3D model for just this colour (optional)</summary>
                  <div className="grid gap-3 mt-3 text-sm">
                    <p className="text-xs leading-relaxed">
                      Only needed if this one colour was modelled separately. Normally you upload <b>one model for the whole frame</b> in step 5 below, and it is painted in each colour automatically.
                    </p>
                    {v.modelUrl ? (
                      <div className="flex items-center gap-3"><span className="tag tag-ok">3D file uploaded ✓</span><button className="text-[var(--bad)] text-xs font-bold" onClick={() => setV(vi, { modelUrl: null })}>Remove (use automatic 3D)</button></div>
                    ) : (
                      <label className="btn btn-outline btn-sm cursor-pointer w-fit">
                        {uploading === "model" ? "Uploading…" : "Upload .glb file"}
                        <input type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (!f) return;
                          if (!/\.glb$/i.test(f.name)) return setMsg({ ok: false, text: "Please choose a .glb file." });
                          const i = vi;
                          setUploading("model");
                          try { const url = await upload(f, "model"); setV(i, { modelUrl: url }); setMsg({ ok: true, text: "3D model uploaded ✓ — press “Save frame” to keep it." }); } catch (err: any) { setMsg({ ok: false, text: err.message }); }
                          setUploading("");
                        }} />
                      </label>
                    )}
                  </div>
                </details>

                {p.variants.length > 1 && (
                  <button className="text-[var(--bad)] font-bold text-xs w-fit" onClick={() => { if (!confirm(`Remove the colour “${v.colorName}”?`)) return; setP((y) => ({ ...y, variants: y.variants.filter((_, j) => j !== vi) })); setVi(0); }}>
                    Remove this colour
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ---------- 5. 3D model ---------- */}
          <section className="card p-6">
            <Step n={5} en="3D model for the try-on (optional)" />
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="text-sm leading-relaxed">
                <p><b>Nothing to do here unless you have a 3D file.</b> Every colour already gets a 3D frame automatically:</p>
                <ol className="list-decimal pl-5 mt-2 grid gap-1 text-xs muted">
                  <li>If you uploaded a <b>try-on photo</b>, the real outline of that photo is turned into a 3D frame with the real colours on the front.</li>
                  <li>If not, a 3D frame is built from the measurements in step 2.</li>
                </ol>
                <p className="mt-3">Upload a <b>.glb</b> here only if a 3D designer or your factory made a model of this frame. One model covers <b>all colours</b> — it is painted to match each swatch.</p>
                <ul className="text-xs muted list-disc pl-5 grid gap-0.5 mt-2">
                  <li><b>.glb</b> only (glTF binary). Big files (up to 150 MB) are made smaller automatically before upload, so they load fast for customers.</li>
                  <li>Front of the glasses facing forward, temple arms going backwards.</li>
                  <li>Any size is fine — it is resized to the “Total width” from step 2.</li>
                  <li>Name the lens parts “lens” so the lens colour previews still work.</li>
                  <li>From Blender: File → Export → glTF 2.0 → Format “glTF Binary (.glb)”.</li>
                </ul>
              </div>
              <div className="grid gap-3 content-start">
                {p.modelUrl ? (
                  <>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="tag tag-ok">3D model uploaded ✓</span>
                      <button className="text-[var(--bad)] text-xs font-bold" onClick={() => set("modelUrl", null)}>Remove</button>
                    </div>
                    <label className="card-flat p-3 flex gap-3 text-sm cursor-pointer">
                      <input type="checkbox" className="mt-1" checked={p.modelTint} onChange={(e) => set("modelTint", e.target.checked)} />
                      <span><b>Paint this model in each colour</b><span className="block muted text-xs mt-0.5">Leave ticked so one model covers every colour. Untick if the model already has the right colours and textures baked in.</span></span>
                    </label>
                    {p.modelTint ? (
                      <div className="text-xs">
                        <div className="muted mb-1.5">Customers will see the model in these colours (from step 4). If one looks wrong, fix that colour’s style and colours in step 4:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {p.variants.map((x, i) => (
                            <span key={i} className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white pl-1 pr-2 py-0.5">
                              <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: swatchBg(x) }} />
                              {x.colorName || `Colour ${i + 1}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs muted">Every colour will show the model exactly as it was made (its own colours and texture).</p>
                    )}
                  </>
                ) : (
                  <label className="btn btn-outline w-fit cursor-pointer">
                    {uploading === "pmodel" ? "Uploading…" : "Upload .glb for this frame"}
                    <input type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      if (!/\.glb$/i.test(file.name)) return setMsg({ ok: false, text: "Please choose a .glb file." });
                      setUploading("pmodel");
                      try { set("modelUrl", await upload(file, "model")); setMsg({ ok: true, text: "3D model uploaded ✓ — press “Save frame” to keep it." }); } catch (err: any) { setMsg({ ok: false, text: err.message }); }
                      setUploading("");
                    }} />
                  </label>
                )}
                <div className="rounded-xl bg-[var(--sky-2)] p-3 text-xs">
                  <b>Check it on a face:</b> save first, then open the try-on and switch to “3D model”.
                  {p.id && p.slug && <> <Link href={`/try-on?p=${p.slug}&v=${v?.id || ""}`} target="_blank" className="text-[var(--blue)] font-bold">Open try-on ↗</Link></>}
                </div>
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-2">
            <button className="btn btn-primary btn-lg" onClick={save} disabled={busy || !!uploading}>{busy ? "Saving…" : "Save frame"}</button>
          </div>
        </div>

        <aside className="card p-4 grid grid-cols-[minmax(0,1fr)] gap-3 xl:sticky xl:top-6 min-w-0">
          <div className="font-bold text-sm">Live preview · {v?.colorName}</div>
          <div className="aspect-[4/3] rounded-xl bg-[var(--sky-2)]">
            {v && <Viewer360 key={`${p.shape}-${p.lensWidth}-${p.lensHeight}-${p.bridge}-${p.material}-${v.colorHex}-${v.accentHex}-${vFinish}-${v.modelUrl}-${p.modelUrl}-${p.modelTint}-${v.tryOnImage}`} spec={p} source={sourceFor(p, { ...v, finish: vFinish })} lens={p.category === "sunglasses" ? "sun" : "clear"} />}
          </div>
          <p className="text-[11px] muted -mt-1">Drag to spin — this is the 3D frame customers see and try on.</p>
          <div className="rounded-xl bg-[var(--sky-2)] aspect-[4/3] grid place-items-center overflow-hidden">
            {v?.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.images[0]} alt="" className="w-full h-full object-contain" />
            ) : (
              v && <FrameArt spec={p} color={v.colorHex} accent={v.accentHex} finish={vFinish} sun={p.category === "sunglasses"} className="w-[85%]" />
            )}
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {p.variants.map((x, i) => <button key={i} onClick={() => setVi(i)} title={x.colorName} className={`swatch ${i === vi ? "on" : ""}`} style={{ background: swatchBg(x) }} />)}
          </div>
          <div className="text-sm"><b className="font-display text-lg">{p.name || "Frame name"}</b> <span className="code-pill ml-1">{p.modelCode || "0000"}</span></div>
          <div className="text-xs muted">How it looks on the product card.</div>
        </aside>
      </div>
    </div>
  );
}

function Step({ n, en }: { n: number; en: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="step-num !w-8 !h-8 !text-sm shrink-0">{n}</span>
      <div className="font-display text-xl font-semibold text-[var(--navy)]">{en}</div>
    </div>
  );
}

function F({ l, hint, children }: { l: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{l}</label>
      {children}
      {hint && <p className="text-[11px] muted mt-1">{hint}</p>}
    </div>
  );
}

function PhotoSlot({ label, src, busy, disabled, onFile, onRemove, onLeft, onRight }: {
  label: string; src?: string; busy?: boolean; disabled?: boolean; onFile?: (f: File) => void; onRemove: () => void; onLeft?: () => void; onRight?: () => void;
}) {
  return (
    <div className={disabled ? "opacity-50 pointer-events-none" : ""}>
      <div className="text-[11px] font-bold mb-1">{label}</div>
      {src ? (
        <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-[var(--line)] bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" className="w-full h-full object-contain" />
          <div className="absolute inset-x-1 bottom-1 flex justify-between">
            <span className="flex gap-1">
              {onLeft && <button onClick={onLeft} className="bg-white/95 rounded-md px-1.5 text-xs shadow" title="Move left">◀</button>}
              {onRight && <button onClick={onRight} className="bg-white/95 rounded-md px-1.5 text-xs shadow" title="Move right">▶</button>}
            </span>
            <span className="flex gap-1">
              {onFile && (
                <label className="bg-white/95 rounded-md px-1.5 text-xs shadow cursor-pointer" title="Replace">
                  ↻<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
                </label>
              )}
              <button onClick={onRemove} className="bg-white/95 rounded-md px-1.5 text-xs text-[var(--bad)] shadow" title="Remove">✕</button>
            </span>
          </div>
        </div>
      ) : (
        <label className="aspect-[4/3] rounded-xl border-2 border-dashed border-[var(--line)] grid place-items-center text-xs font-semibold cursor-pointer hover:border-[var(--blue)] text-center p-2 bg-white">
          {busy ? "Uploading…" : <span>+ Upload photo</span>}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && onFile) onFile(f); }} />
        </label>
      )}
    </div>
  );
}
