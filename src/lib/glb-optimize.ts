// Client-only (admin): makes a big .glb small enough to upload (the server accepts up to 4 MB, which
// Vercel requires) and fast to load for customers — without visibly changing it at try-on size.
//   1. textures are kept at 2K (2048 px on the long side — never upscaled, never below 2K)
//      and re-encoded (JPEG, or WebP when they use transparency)
//   2. geometry is cleaned up and, only if still needed, simplified
//   3. geometry is packed with meshopt compression (the store's 3D loader decodes it)
// Each attempt starts again from the original file; later attempts lower the image compression
// quality and simplify the shape a little more — the texture size always stays 2K.

export const MODEL_LIMIT = 4 * 1024 * 1024;
const TARGET = 3.7 * 1024 * 1024; // leave room under the server limit

export const TEXTURE_SIZE = 2048; // 2K

type Step = { quality: number; ratio: number; error: number };
const STEPS: Step[] = [
  { quality: 0.9, ratio: 1, error: 0.0001 },
  { quality: 0.85, ratio: 1, error: 0.0005 },
  { quality: 0.8, ratio: 0.6, error: 0.001 },
  { quality: 0.75, ratio: 0.35, error: 0.002 },
  { quality: 0.7, ratio: 0.2, error: 0.004 },
  { quality: 0.65, ratio: 0.1, error: 0.008 },
];

export type OptimizeResult = { file: File; before: number; after: number };

async function encodeCanvas(c: HTMLCanvasElement, alpha: boolean, quality: number): Promise<Blob> {
  const enc = (type: string) => new Promise<Blob | null>((res) => c.toBlob(res, type, quality));
  // transparent textures: WebP keeps transparency at a fraction of PNG's size (glTF EXT_texture_webp)
  if (alpha) {
    const webp = await enc("image/webp");
    if (webp && webp.type === "image/webp") return webp;
    const png = await enc("image/png");
    if (png) return png;
  } else {
    const jpg = await enc("image/jpeg");
    if (jpg) return jpg;
  }
  throw new Error("This browser could not re-encode the model's textures.");
}

/** Keeps every texture at 2K (or smaller if it already was) and re-encodes it at `quality`. */
async function resizeTextures(
  doc: import("@gltf-transform/core").Document,
  quality: number,
  webpExt: { new (doc: import("@gltf-transform/core").Document): unknown } | null,
) {
  const max = TEXTURE_SIZE;
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
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height)); // shrink to 2K, never upscale
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
    const out = await encodeCanvas(c, alpha, quality);
    if (out.type === "image/webp" && webpExt) {
      // declare WebP so viewers know how to read it
      const has = doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === "EXT_texture_webp");
      if (!has) (doc as unknown as { createExtension: (c: unknown) => { setRequired: (v: boolean) => void } }).createExtension(webpExt).setRequired(true);
    }
    tex.setImage(new Uint8Array(await out.arrayBuffer())).setMimeType(out.type);
  }
}

/** Returns the original file when it already fits; otherwise a smaller optimized copy. */
export async function optimizeGlb(file: File, onProgress?: (text: string) => void): Promise<OptimizeResult> {
  if (file.size <= TARGET) return { file, before: file.size, after: file.size };

  const [{ WebIO }, { ALL_EXTENSIONS, EXTTextureWebP }, fn, mo] = await Promise.all([
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
    await resizeTextures(doc, step.quality, EXTTextureWebP as never);
    await doc.transform(fn.meshopt({ encoder: mo.MeshoptEncoder, level: "medium" }));
    const out = await io.writeBinary(doc);
    if (!best || out.byteLength < best.byteLength) best = out;
    if (out.byteLength <= TARGET) break;
  }
  if (!best || best.byteLength > MODEL_LIMIT) {
    throw new Error("This model is too detailed to fit in 4 MB even with 2K textures. Ask Tripo or your designer for a “low-poly” export (fewer polygons), then upload it again.");
  }
  const name = file.name.replace(/\.glb$/i, "") + "-web.glb";
  return { file: new File([new Uint8Array(best)], name, { type: "model/gltf-binary" }), before: file.size, after: best.byteLength };
}
