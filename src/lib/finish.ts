// How a frame colour is painted. Shared by swatches, generated artwork and the 3D frame.
//   solid    — one colour
//   twotone  — main colour + a second colour on the top bar (browline)
//   gradient — main colour at the top fading into the second colour at the bottom
export type Finish = "solid" | "twotone" | "gradient";
export const FINISHES: Finish[] = ["solid", "twotone", "gradient"];

type C = { colorHex: string; accentHex?: string | null; finish?: string | null };

export function finishOf(c: C): Finish {
  if (!c.accentHex) return "solid";
  return c.finish === "gradient" ? "gradient" : "twotone";
}

/** CSS background for a round colour swatch. */
export function swatchBg(c: C): string {
  const f = finishOf(c);
  if (f === "gradient") return `linear-gradient(180deg, ${c.colorHex} 15%, ${c.accentHex} 85%)`;
  if (f === "twotone") return `linear-gradient(135deg, ${c.accentHex} 50%, ${c.colorHex} 50%)`;
  return c.colorHex;
}

/** Ready-made colour ideas for the admin (top colour → bottom colour). */
export const FINISH_PRESETS: { name: string; finish: Finish; hex: string; accent: string | null }[] = [
  { name: "Black", finish: "solid", hex: "#16181d", accent: null },
  { name: "Tortoise", finish: "solid", hex: "#6b3f1f", accent: null },
  { name: "Crystal Clear", finish: "solid", hex: "#c9d6e3", accent: null },
  { name: "Black / Crystal fade", finish: "gradient", hex: "#16181d", accent: "#d7dde6" },
  { name: "Purple / Pink fade", finish: "gradient", hex: "#4a1d3f", accent: "#e7b7c8" },
  { name: "Wine / Rose fade", finish: "gradient", hex: "#5a1426", accent: "#e3a3b1" },
  { name: "Brown / Honey fade", finish: "gradient", hex: "#4a2a14", accent: "#d9a45b" },
  { name: "Navy / Sky fade", finish: "gradient", hex: "#1c2f5a", accent: "#9cc3ea" },
  { name: "Grey / Clear fade", finish: "gradient", hex: "#3d434c", accent: "#e4e8ee" },
  { name: "Black / White", finish: "twotone", hex: "#f2f2f2", accent: "#16181d" },
  { name: "White / Pink", finish: "twotone", hex: "#e9a9b8", accent: "#f4f1ee" },
  { name: "Black / Gold", finish: "twotone", hex: "#c9a14a", accent: "#1a1a1a" },
];
