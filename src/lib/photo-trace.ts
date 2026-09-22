// Client-only: turns a cut-out front photo (transparent background) into outlines —
// the frame's outer shape plus the lens openings — so a real 3D frame can be built from it.
// Coordinates come back in millimetres, centred on the frame, y up.

export type Pt = [number, number];
export type Traced = { outer: Pt[]; holes: Pt[][]; widthPx: number; heightPx: number };

const WORK_W = 700; // tracing runs on a small copy; the shape is smooth enough and it stays fast

/** Square-tracing of a mask boundary, starting at a known edge pixel. */
function traceBoundary(mask: Uint8Array, W: number, H: number, startIdx: number, visited: Uint8Array): Pt[] {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : mask[y * W + x]);
  const dirs: Pt[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const sx = startIdx % W, sy = (startIdx / W) | 0;
  const pts: Pt[] = [];
  let cx = sx, cy = sy, dir = 6; // start looking up
  for (let guard = 0; guard < W * H * 4; guard++) {
    pts.push([cx, cy]);
    visited[cy * W + cx] = 1;
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8; // turn left, then scan clockwise
      const [dx, dy] = dirs[d];
      if (at(cx + dx, cy + dy)) {
        cx += dx; cy += dy; dir = d; found = true;
        break;
      }
    }
    if (!found) break;
    if (cx === sx && cy === sy) break;
  }
  return pts;
}

/** Ramer–Douglas–Peucker: drops points that don't change the shape. */
function simplify(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let worst = -1, wi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (d > worst) { worst = d; wi = i; }
    }
    if (worst > eps && wi > 0) {
      keep[wi] = 1;
      stack.push([a, wi], [wi, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

function area(pts: Pt[]) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  return Math.abs(a) / 2;
}

/** Traces the frame and its lens openings from a transparent PNG. */
export async function traceFrame(url: string): Promise<Traced> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Could not read the try-on photo."));
    i.src = url;
  });
  const scale = Math.min(1, WORK_W / img.naturalWidth);
  const W = Math.max(8, Math.round(img.naturalWidth * scale));
  const H = Math.max(8, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  const N = W * H;

  // solid = the frame itself (lens openings are semi-transparent, background is clear)
  const solid = new Uint8Array(N);
  for (let i = 0; i < N; i++) solid[i] = px[i * 4 + 3] > 120 ? 1 : 0;
  if (!solid.some(Boolean)) throw new Error("This photo has no frame left after background removal.");

  // outer shape: boundary of the biggest solid piece
  const seen = new Uint8Array(N);
  let best: number[] = [];
  const stack = new Int32Array(N);
  for (let s = 0; s < N; s++) {
    if (seen[s] || !solid[s]) continue;
    const comp: number[] = [];
    seen[s] = 1;
    stack[0] = s;
    let sp = 1;
    while (sp) {
      const i = stack[--sp];
      comp.push(i);
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1])
        if (j >= 0 && !seen[j] && solid[j]) { seen[j] = 1; stack[sp++] = j; }
    }
    if (comp.length > best.length) best = comp;
  }
  const main = new Uint8Array(N);
  for (const i of best) main[i] = 1;
  const start = best.reduce((a, b) => (b < a ? b : a), best[0]); // top-most, left-most pixel
  const outer = simplify(traceBoundary(main, W, H, start, new Uint8Array(N)), 1.1);

  // lens openings: clear areas enclosed by the frame (not reachable from the border)
  const outside = new Uint8Array(N);
  let sp = 0;
  const seed = (i: number) => { if (!outside[i] && !main[i]) { outside[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (sp) {
    const i = stack[--sp];
    const x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1])
      if (j >= 0) seed(j);
  }
  const holes: Pt[][] = [];
  const seen2 = new Uint8Array(N);
  for (let s = 0; s < N; s++) {
    if (seen2[s] || main[s] || outside[s]) continue;
    const comp: number[] = [];
    seen2[s] = 1;
    stack[0] = s;
    let sp2 = 1;
    while (sp2) {
      const i = stack[--sp2];
      comp.push(i);
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i >= W ? i - W : -1, i < N - W ? i + W : -1])
        if (j >= 0 && !seen2[j] && !main[j] && !outside[j]) { seen2[j] = 1; stack[sp2++] = j; }
    }
    if (comp.length < N * 0.01) continue; // ignore specks; a lens opening is large
    const hm = new Uint8Array(N);
    for (const i of comp) hm[i] = 1;
    const h = simplify(traceBoundary(hm, W, H, Math.min(...comp), new Uint8Array(N)), 1.1);
    if (h.length > 8 && area(h) > 50) holes.push(h);
  }
  return { outer, holes: holes.slice(0, 4), widthPx: W, heightPx: H };
}

/** Pixel outline → millimetres, centred on the frame, y pointing up. */
export function toMillimetres(t: Traced, frameWidthMm: number): { outer: Pt[]; holes: Pt[][]; heightMm: number } {
  const k = frameWidthMm / t.widthPx;
  const cx = t.widthPx / 2, cy = t.heightPx / 2;
  const map = (p: Pt): Pt => [(p[0] - cx) * k, (cy - p[1]) * k];
  return { outer: t.outer.map(map), holes: t.holes.map((h) => h.map(map)), heightMm: t.heightPx * k };
}
