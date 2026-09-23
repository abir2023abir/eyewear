// Client-only (admin): makes a big .glb small enough to upload (the server accepts up to 4 MB, which
// Vercel requires) and fast to load for customers — without visibly changing it at try-on size.
//   1. texture images are resized (most of a Tripo/AI model's size is a 2–4K texture)
//   2. geometry is cleaned up and, only if still needed, simplified
//   3. geometry is packed with meshopt compression (the store's 3D loader decodes it)
// Each attempt starts again from the original file and gets a little stronger until it fits.

export const MODEL_LIMIT = 4 * 1024 * 1024;
const TARGET = 3.7 * 1024 * 1024; // leave room under the server limit

type Step = { texture: number; ratio: number; error: number };
const STEPS: Step[] = [
  { texture: 2048, ratio: 1, error: 0.0001 },
  { texture: 1536, ratio: 1, error: 0.0005 },
  { texture: 1024, ratio: 0.6, error: 0.001 },
  { texture: 1024, ratio: 0.35, error: 0.002 },
  { texture: 768, ratio: 0.2, error: 0.004 },
  { texture: 512, ratio: 0.1, error: 0.008 },
];

export type OptimizeResult = { file: File; before: number; after: number };

async function encodeCanvas(c: HTMLCanvasElement, alpha: boolean): Promise<Blob> {
  const type = alpha ? "image/png" : "image/jpeg"; // only PNG/JPEG are core glTF image types
  const b = await new Promise<Blob | null>((res) => c.toBlob(res, type, 0.86));
  if (!b) throw new Error("This browser could not re-encode the model's textures.");
  return b;
}

/** Downsizes every texture to at most `max` px on its long side. */
async function resizeTextures(doc: import("@gltf-transform/core").Document, max: number) {
  for (const tex of doc.getRoot().listTextures()) {
    const img = tex.getImage();
    const mime = tex.getMimeType();
    if (!img || !/^image\/(png|jpeg|webp)$/.test(mime)) continue;
    let bmp: ImageBitmap;
    try {
      bmp = await createImageBitmap(new Blob([img], { type: mime }));
    } catch {
      continue; // leave textures the browser can't read untouched
    }
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (s >= 1 && img.byteLength < 400 * 1024) continue; // already small
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * s));
    c.height = Math.max(1, Math.round(bmp.height * s));
    const ctx = c.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    // keep PNG only when the texture really uses transparency
    let alpha = false;
    if (mime !== "image/jpeg") {
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < px.length; i += 4 * 7) if (px[i] < 250) { alpha = true; break; }
    }
    const out = await encodeCanvas(c, alpha);
    tex.setImage(new Uint8Array(await out.arrayBuffer())).setMimeType(out.type);
  }
}

/** Returns the original file when it already fits; otherwise a smaller optimized copy. */
export async function optimizeGlb(file: File, onProgress?: (text: string) => void): Promise<OptimizeResult> {
  if (file.size <= TARGET) return { file, before: file.size, after: file.size };

  const [{ WebIO }, { ALL_EXTENSIONS }, fn, mo] = await Promise.all([
    import("@gltf-transform/core"),
    import("@gltf-transform/extensions"),
    import("@gltf-transform/functions"),
    import("meshoptimizer"),
  ]);
  await Promise.all([mo.MeshoptSimplifier.ready, mo.MeshoptEncoder.ready, mo.MeshoptDecoder.ready]);
  const io = new WebIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": mo.MeshoptEncoder, "meshopt.decoder": mo.MeshoptDecoder });
  const original = new Uint8Array(await file.arrayBuffer());

  let best: Uint8Array | null = null;
  for (const [i, step] of STEPS.entries()) {
    onProgress?.(`Making the model smaller… (try ${i + 1} of ${STEPS.length})`);
    const doc = await io.readBinary(original);
    await doc.transform(
      fn.dedup(),
      fn.prune(),
      fn.weld(),
      ...(step.ratio < 1 ? [fn.simplify({ simplifier: mo.MeshoptSimplifier, ratio: step.ratio, error: step.error })] : []),
    );
    await resizeTextures(doc, step.texture);
    await doc.transform(fn.meshopt({ encoder: mo.MeshoptEncoder, level: "medium" }));
    const out = await io.writeBinary(doc);
    if (!best || out.byteLength < best.byteLength) best = out;
    if (out.byteLength <= TARGET) break;
  }
  if (!best || best.byteLength > MODEL_LIMIT) {
    throw new Error("This model is too detailed to shrink below 4 MB automatically. Ask for a “low-poly” export (or 1K textures) from Tripo or your designer.");
  }
  const name = file.name.replace(/\.glb$/i, "") + "-web.glb";
  return { file: new File([new Uint8Array(best)], name, { type: "model/gltf-binary" }), before: file.size, after: best.byteLength };
}
