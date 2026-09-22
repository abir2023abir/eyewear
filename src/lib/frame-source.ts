"use client";
// Decides which 3D frame to show, in this order:
//   1. a .glb uploaded for that exact colour
//   2. the frame's shared .glb, painted in the colour of the swatch
//   3. a 3D frame traced from the colour's try-on photo (real outline + real photo on the front)
//   4. the 3D frame generated from the measurements
import { buildFrame, buildTracedFrame, loadGlbFrame, type BuiltFrame, type LensKind, type Tint } from "./frame3d";
import type { FrameSpec } from "./frame-geometry";

type P = { modelUrl?: string | null; modelTint?: boolean };
type V = { modelUrl?: string | null; tryOnImage?: string | null; colorHex: string; accentHex?: string | null; finish?: string };

export type FrameSource = { model?: string; tint?: Tint | null; traced?: string | null; color: Tint };

export function sourceFor(p: P, v: V): FrameSource {
  const color: Tint = { color: v.colorHex, accent: v.accentHex, finish: v.finish };
  if (v.modelUrl) return { model: v.modelUrl, tint: null, color }; // made for this colour already
  if (p.modelUrl) return { model: p.modelUrl, tint: p.modelTint === false ? null : color, color };
  return { traced: v.tryOnImage || null, color };
}

/** Builds the best available frame, falling back quietly if a model or photo can't be used. */
export async function buildAnyFrame(src: FrameSource, spec: FrameSpec, lens: LensKind): Promise<BuiltFrame> {
  const generated = () => buildFrame(spec, src.color.color, src.color.accent, lens, src.color.finish);
  if (src.model) {
    try {
      return await loadGlbFrame(src.model, spec, lens, src.tint);
    } catch {}
  }
  if (src.traced) {
    try {
      return await buildTracedFrame(src.traced, spec, lens);
    } catch {}
  }
  return generated();
}
