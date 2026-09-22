// Client-only: turns a product photo (frame on a plain light background, seen straight from the front)
// into a transparent PNG for the photo try-on.
//   1. the background is flood-filled from the image edges (so light parts *inside* the frame survive)
//   2. large enclosed light areas (the lens openings) become see-through, with a faint glass tint
//   3. the result is cropped tight to the frame, so its width = the frame's real width on the face
// Photos that already have a transparent background are only cropped.

export type CutoutResult = { blob: Blob; url: string; width: number; height: number };

const MAX_W = 1400;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("This file could not be opened as an image."));
    img.src = url;
  });
}

/** strength 0–100: how different from the background colour a pixel may be and still be removed. */
export async function cutoutFrame(file: Blob, strength = 45): Promise<CutoutResult> {
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_W / img.naturalWidth);
  const W = Math.round(img.naturalWidth * scale), H = Math.round(img.naturalHeight * scale);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  URL.revokeObjectURL(img.src);
  const data = ctx.getImageData(0, 0, W, H);
  const px = data.data;
  const N = W * H;

  // already transparent (e.g. a PNG cut out in another app)? then only crop
  let clearCorners = 0;
  for (const i of [0, W - 1, (H - 1) * W, N - 1]) if (px[i * 4 + 3] < 20) clearCorners++;

  if (clearCorners < 3) {
    // background colour = average of the border pixels
    let r = 0, g = 0, b = 0, n = 0;
    const addBorder = (i: number) => { r += px[i * 4]; g += px[i * 4 + 1]; b += px[i * 4 + 2]; n++; };
    for (let x = 0; x < W; x++) { addBorder(x); addBorder((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { addBorder(y * W); addBorder(y * W + W - 1); }
    const bg = [r / n, g / n, b / n];
    const tol = 12 + strength * 0.9; // colour distance that counts as background
    const feather = 22;
    const dist = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const dr = px[i * 4] - bg[0], dg = px[i * 4 + 1] - bg[1], db = px[i * 4 + 2] - bg[2];
      dist[i] = Math.sqrt(dr * dr + dg * dg + db * db);
    }

    // 1. flood fill the background from every edge pixel
    const outside = new Uint8Array(N);
    const stack = new Int32Array(N);
    let sp = 0;
    const seed = (i: number) => { if (!outside[i] && dist[i] <= tol + feather) { outside[i] = 1; stack[sp++] = i; } };
    for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
    while (sp) {
      const i = stack[--sp];
      if (dist[i] > tol) continue; // feather pixels are marked but don't spread further
      const x = i % W;
      if (x > 0) seed(i - 1);
      if (x < W - 1) seed(i + 1);
      if (i >= W) seed(i - W);
      if (i < N - W) seed(i + W);
    }

    // 2. enclosed light regions big enough to be lens openings
    const lens = new Uint8Array(N);
    const seen = new Uint8Array(N);
    const minArea = N * 0.012;
    const region: number[] = [];
    for (let s = 0; s < N; s++) {
      if (seen[s] || outside[s] || dist[s] > tol) continue;
      region.length = 0;
      seen[s] = 1;
      stack[0] = s;
      sp = 1;
      while (sp) {
        const i = stack[--sp];
        region.push(i);
        const x = i % W;
        const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1];
        for (const j of nb) if (j >= 0 && !seen[j] && !outside[j] && dist[j] <= tol) { seen[j] = 1; stack[sp++] = j; }
      }
      if (region.length >= minArea) for (const i of region) lens[i] = 1;
    }

    for (let i = 0; i < N; i++) {
      if (outside[i]) {
        const a = dist[i] <= tol ? 0 : Math.min(1, (dist[i] - tol) / feather);
        px[i * 4 + 3] = Math.round(px[i * 4 + 3] * a);
      } else if (lens[i]) {
        px[i * 4 + 3] = 28; // clear lens: a faint sheen, the face shows through
      }
    }
    ctx.putImageData(data, 0, 0);
  }

  // 3. crop to the visible frame
  const alpha = ctx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (alpha[(y * W + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) throw new Error("Nothing was left after removing the background — lower the strength, or use a photo with a plain light background.");
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  if (cw < W * 0.25) throw new Error("The frame looks very small in this photo. Please crop closer to the frame, or lower the strength.");
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  out.getContext("2d")!.drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
  const blob: Blob = await new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("Could not create the image."))), "image/png"));
  return { blob, url: URL.createObjectURL(blob), width: cw, height: ch };
}
