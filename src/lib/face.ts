// Face measurement helpers for the try-on studio. Everything runs in the browser.
import { FaceShape } from "./frame-geometry";

export type LM = { x: number; y: number; z: number };

export const IRIS_MM = 11.7; // average human iris diameter — a very consistent "ruler"

export const L = {
  irisR: 468, irisRpts: [469, 470, 471, 472],
  irisL: 473, irisLpts: [474, 475, 476, 477],
  cheekR: 234, cheekL: 454,
  jawR: 172, jawL: 397,
  foreheadR: 54, foreheadL: 284,
  top: 10, chin: 152,
  noseBridge: 168,
};

/** 3D distance in source-video pixels (landmark z uses the same scale as x). */
export function dist(a: LM, b: LM, w: number, h: number) {
  return Math.hypot((a.x - b.x) * w, (a.y - b.y) * h, (a.z - b.z) * w);
}

export function irisDiameterPx(lm: LM[], w: number, h: number) {
  const d = (p: number[]) => (dist(lm[p[0]], lm[p[2]], w, h) + dist(lm[p[1]], lm[p[3]], w, h)) / 2;
  return (d(L.irisRpts) + d(L.irisLpts)) / 2;
}

export type Measure = { faceWidthMm: number; pdMm: number; faceShape: FaceShape; ratios: Record<string, number> };

/** Single-frame measurement. Callers should take a median over many frames. */
export function measure(lm: LM[], w: number, h: number): Measure | null {
  if (!lm || lm.length < 478) return null;
  const iris = irisDiameterPx(lm, w, h);
  if (iris < 4) return null;
  const mmPerPx = IRIS_MM / iris;
  const cheek = dist(lm[L.cheekR], lm[L.cheekL], w, h);
  const jaw = dist(lm[L.jawR], lm[L.jawL], w, h);
  const fore = dist(lm[L.foreheadR], lm[L.foreheadL], w, h);
  const len = dist(lm[L.top], lm[L.chin], w, h);
  const pd = dist(lm[L.irisR], lm[L.irisL], w, h) * mmPerPx;
  const r = { lengthToWidth: len / cheek, jaw: jaw / cheek, forehead: fore / cheek };
  return { faceWidthMm: cheek * mmPerPx, pdMm: pd, faceShape: classify(r), ratios: r };
}

export function classify(r: { lengthToWidth: number; jaw: number; forehead: number }): FaceShape {
  if (r.lengthToWidth >= 1.4) return "oblong";
  if (r.forehead - r.jaw >= 0.12) return "heart";
  if (r.forehead < 0.78 && r.jaw < 0.78) return "diamond";
  if (r.lengthToWidth < 1.22 && r.jaw >= 0.86) return "square";
  if (r.lengthToWidth < 1.22) return "round";
  if (r.jaw >= 0.88) return "square";
  return "oval";
}

/** Head yaw estimate from landmark symmetry (0 = frontal). Used to only measure on frontal frames. */
export function yawAmount(lm: LM[]) {
  const nose = lm[1];
  const l = Math.abs(nose.x - lm[L.cheekR].x);
  const r = Math.abs(lm[L.cheekL].x - nose.x);
  return Math.abs(l - r) / (l + r);
}

export const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

export function fitVerdict(frameWidth: number, faceWidthMm: number) {
  const ideal = faceWidthMm * 0.95;
  const d = frameWidth - ideal;
  if (Math.abs(d) <= 6) return { label: "Fits you", tone: "ok" as const, detail: "This frame width matches your face." };
  if (Math.abs(d) <= 10) return { label: d < 0 ? "Snug fit" : "Relaxed fit", tone: "warn" as const, detail: d < 0 ? "Slightly narrow — fine if you like a close fit." : "Slightly wide — a little room at the temples." };
  return { label: d < 0 ? "Too narrow" : "Too wide", tone: "bad" as const, detail: d < 0 ? "Look for a wider frame for comfort." : "Look for a narrower frame so it doesn’t slide." };
}
