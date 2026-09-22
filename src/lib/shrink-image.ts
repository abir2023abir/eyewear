// Client-only: makes photos small enough to upload (the server accepts up to 4 MB per file).
// Large photos are resized to at most 2400 px on the long side and re-encoded (WebP keeps transparency).
// PDFs, 3D files and images the browser can't open (e.g. some HEIC) are passed through unchanged.

export const MAX_UPLOAD = 4 * 1024 * 1024;
const MAX_SIDE = 2400;

function load(file: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("unreadable")); };
    img.src = url;
  });
}

function encode(c: HTMLCanvasElement, type: string, q: number): Promise<Blob | null> {
  return new Promise((res) => c.toBlob((b) => res(b), type, q));
}

export async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  let img: HTMLImageElement;
  try {
    img = await load(file);
  } catch {
    return file;
  }
  const big = Math.max(img.naturalWidth, img.naturalHeight);
  if (file.size <= 1.5 * 1024 * 1024 && big <= MAX_SIDE) return file; // already fine
  const scale = Math.min(1, MAX_SIDE / big);
  const c = document.createElement("canvas");
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  let best: Blob | null = null;
  for (const q of [0.88, 0.8, 0.7, 0.6]) {
    let b = await encode(c, "image/webp", q);
    if (!b || b.type !== "image/webp") b = await encode(c, "image/jpeg", q); // older Safari: no WebP encoder
    if (!b) break;
    best = b;
    if (b.size <= MAX_UPLOAD * 0.9) break;
  }
  if (!best || best.size >= file.size) return file;
  const ext = best.type === "image/webp" ? "webp" : "jpg";
  return new File([best], file.name.replace(/\.[^.]+$/, "") + "." + ext, { type: best.type });
}

/** Shrinks if possible, then refuses anything still too big with a clear message. */
export async function prepareUpload(file: File): Promise<File> {
  const f = await shrinkImage(file);
  if (f.size > MAX_UPLOAD) throw new Error(`${file.name} is too large (max 4 MB). Please use a smaller file.`);
  return f;
}
