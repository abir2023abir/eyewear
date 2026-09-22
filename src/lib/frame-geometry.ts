// Parametric eyewear geometry, shared by the SVG product artwork, the 360° viewer
// and the virtual try-on. Units are millimetres. Origin is the lens centre,
// +x toward the temple (outer side), +y up.

export type FrameShape =
  | "rectangle" | "square" | "round" | "oval" | "cat-eye"
  | "aviator" | "wayfarer" | "browline" | "geometric";

export const SHAPES: FrameShape[] = [
  "rectangle", "square", "round", "oval", "cat-eye", "aviator", "wayfarer", "browline", "geometric",
];

export interface FrameSpec {
  shape: FrameShape | string;
  lensWidth: number;
  lensHeight: number;
  bridge: number;
  templeLength: number;
  frameWidth: number;
  material?: string;
}

type Pt = [number, number];

function superellipse(a: number, b: number, n: number, steps = 96): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t), s = Math.sin(t);
    pts.push([a * Math.sign(c) * Math.abs(c) ** (2 / n), b * Math.sign(s) * Math.abs(s) ** (2 / n)]);
  }
  return pts;
}

function roundedPolygon(a: number, b: number, sides: number, rot: number, steps = 96): Pt[] {
  // polygon with softened corners via a mild superellipse blend
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const seg = (Math.PI * 2) / sides;
    const local = ((t - rot) % seg + seg) % seg - seg / 2;
    const r = Math.cos(seg / 2) / Math.cos(local);
    const soft = 0.82 + 0.18 * (1 / r); // pull corners in a touch
    pts.push([a * Math.cos(t) * r * soft, b * Math.sin(t) * r * soft]);
  }
  return pts;
}

/** Lens outline for the wearer's LEFT lens (drawn on the viewer's right), +x = outer/temple side. */
export function lensOutline(spec: FrameSpec, steps = 96): Pt[] {
  const a = spec.lensWidth / 2;
  const b = spec.lensHeight / 2;
  switch (spec.shape) {
    case "round":
      return superellipse(a, Math.max(b, a * 0.92), 2, steps);
    case "oval":
      return superellipse(a, b, 2.3, steps);
    case "square":
      return superellipse(a, b, 5, steps);
    case "cat-eye":
      return superellipse(a, b, 2.8, steps).map(([x, y]) => {
        const lift = y > 0 ? Math.max(0, x / a) ** 3 * b * 0.45 : 0;
        const pinch = y < 0 ? 1 - 0.18 * Math.max(0, -x / a) : 1;
        return [x * pinch + (y > 0 ? Math.max(0, x / a) ** 2 * a * 0.12 : 0), y + lift];
      });
    case "aviator":
      return superellipse(a, b, 2.6, steps).map(([x, y]) => {
        if (y > 0) return [x, Math.min(y * 1.15, b * 0.92)]; // flat-ish brow
        // teardrop: the bottom sags toward the inner (nose) side
        const inner = Math.max(0, -x / a);
        return [x * (1 - 0.1 * inner), y * (1 + 0.28 * (1 - Math.abs(x / a) * 0.6))];
      });
    case "wayfarer":
      return superellipse(a, b, 4, steps).map(([x, y]) => {
        const k = 1 + 0.12 * (y / b); // top wider than bottom
        const lift = y > 0 ? Math.max(0, x / a) * b * 0.12 : 0;
        return [x * k, y + lift];
      });
    case "browline":
      return superellipse(a, b, 3.4, steps).map(([x, y]) => [x, y < 0 ? y * 1.05 : Math.min(y, b * 0.95)]);
    case "geometric":
      return roundedPolygon(a * 1.02, b * 1.08, 6, Math.PI / 6, steps);
    case "rectangle":
    default:
      return superellipse(a, b * 0.92, 4.2, steps);
  }
}

/** Offset a closed outline outward along its normals (rim thickness). */
export function offsetOutline(pts: Pt[], d: number | ((p: Pt) => number)): Pt[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const tx = next[0] - prev[0], ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    // outward normal for counter-clockwise outline
    const nx = ty / len, ny = -tx / len;
    const dd = typeof d === "number" ? d : d(p);
    return [p[0] + nx * dd, p[1] + ny * dd];
  });
}

export function rimThickness(spec: FrameSpec) {
  const metal = spec.material === "Metal" || spec.material === "Titanium";
  const base = metal ? 1.4 : 3.2;
  return (p: Pt) => {
    if (spec.shape === "browline") return p[1] > spec.lensHeight * 0.15 ? base * 2.2 : metal ? 0.8 : 1.4;
    if (spec.shape === "wayfarer") return p[1] > 0 ? base * 1.35 : base;
    return base;
  };
}

/** Distance from face centre to each lens centre. */
export const lensCenterX = (spec: FrameSpec) => spec.bridge / 2 + spec.lensWidth / 2 + 1;

export function toPath(pts: Pt[], ox = 0, oy = 0, flipX = false, scale = 1) {
  return (
    pts
      .map(([x, y], i) => `${i ? "L" : "M"}${((flipX ? -x : x) * scale + ox).toFixed(2)},${(-y * scale + oy).toFixed(2)}`)
      .join(" ") + " Z"
  );
}

export const FACE_SHAPES = ["oval", "round", "square", "heart", "oblong", "diamond"] as const;
export type FaceShape = (typeof FACE_SHAPES)[number];

/** Frame shapes that flatter each face shape. */
export const FACE_SHAPE_MATCH: Record<FaceShape, FrameShape[]> = {
  oval: ["rectangle", "square", "round", "wayfarer", "aviator", "geometric", "cat-eye", "browline", "oval"],
  round: ["rectangle", "square", "wayfarer", "geometric", "browline"],
  square: ["round", "oval", "aviator", "cat-eye"],
  heart: ["oval", "round", "aviator", "rectangle"],
  oblong: ["square", "wayfarer", "aviator", "geometric", "browline"],
  diamond: ["cat-eye", "oval", "browline", "round"],
};

export const FACE_SHAPE_TIPS: Record<FaceShape, string> = {
  oval: "Balanced proportions — almost every frame shape works. Pick the one that matches your style.",
  round: "Soft curves and similar width/length. Angular frames add definition.",
  square: "Strong jaw and broad forehead. Rounded frames soften the angles.",
  heart: "Wider forehead, narrow chin. Light, bottom-heavy or rounded frames balance it.",
  oblong: "Longer than wide. Deep frames with strong tops shorten the face visually.",
  diamond: "Cheekbones are the widest point. Cat-eye and browline frames highlight them.",
};

/** Face shapes a frame suits (inverse of FACE_SHAPE_MATCH). */
export function faceShapesFor(shape: string): FaceShape[] {
  return FACE_SHAPES.filter((f) => FACE_SHAPE_MATCH[f].includes(shape as FrameShape));
}
