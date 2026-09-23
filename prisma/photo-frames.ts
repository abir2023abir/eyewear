// Demo frames with real product photos (free-licence photos from Pexels, in prisma/demo-photos).
// Added once; safe to run on every deploy. Replace them with photos of your own frames any time.
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { faceShapesFor } from "../src/lib/frame-geometry";

type Frame = {
  file: string; name: string; code: string; category: "optical" | "sunglasses"; shape: string; material: string; gender: string;
  color: string; hex: string; accent?: string; price: number; compareAt?: number;
  lens: [number, number, number]; temple: number; blurb: string; best?: boolean;
};

const FRAMES: Frame[] = [
  { file: "black-rectangle", name: "Carbon", code: "3002", category: "optical", shape: "rectangle", material: "Acetate", gender: "men", color: "Black", hex: "#111111", price: 3900, compareAt: 5400, lens: [54, 38, 18], temple: 145, blurb: "A clean, classic black rectangle that suits almost every face", best: true },
  { file: "red-rectangle", name: "Scarlet", code: "3001", category: "optical", shape: "rectangle", material: "Acetate", gender: "women", color: "Red / Navy", hex: "#d4202a", accent: "#1f2d52", price: 3900, lens: [53, 40, 17], temple: 140, blurb: "Bold red front with navy temples — a confident everyday statement" },
  { file: "tortoise", name: "Havana", code: "3003", category: "optical", shape: "square", material: "Acetate", gender: "unisex", color: "Tortoise", hex: "#7a4a25", price: 4200, lens: [52, 44, 19], temple: 145, blurb: "Warm tortoiseshell acetate in a soft square shape", best: true },
  { file: "black-square", name: "Ledger", code: "3004", category: "optical", shape: "square", material: "TR90", gender: "men", color: "Black", hex: "#151515", price: 2900, lens: [55, 40, 18], temple: 145, blurb: "Light, flexible and sharp — a slim square for all-day wear" },
  { file: "rose-gold-metal", name: "Rosa", code: "3005", category: "optical", shape: "geometric", material: "Metal", gender: "women", color: "Rose Gold", hex: "#b76e79", price: 3400, lens: [51, 42, 18], temple: 140, blurb: "Fine rose-gold metal with a modern geometric lens" },
  { file: "browline", name: "Clubman", code: "3006", category: "optical", shape: "browline", material: "Acetate", gender: "men", color: "Black / Silver", hex: "#111111", accent: "#c0c3c8", price: 3900, lens: [51, 40, 20], temple: 145, blurb: "The retro browline: black acetate brows over a silver metal rim", best: true },
  { file: "hexagon-metal", name: "Hexa", code: "3010", category: "optical", shape: "geometric", material: "Metal", gender: "unisex", color: "Gold", hex: "#c9a45c", price: 3400, lens: [50, 44, 20], temple: 145, blurb: "Thin gold metal hexagon — light, minimal and on trend" },
  { file: "black-wayfarer-sun", name: "Harbor", code: "3008", category: "sunglasses", shape: "wayfarer", material: "TR90", gender: "unisex", color: "Black", hex: "#111111", price: 3400, compareAt: 4900, lens: [52, 42, 20], temple: 145, blurb: "An everyday black sunglass with a timeless wayfarer shape", best: true },
  { file: "black-rectangle-sun", name: "Nova", code: "3009", category: "sunglasses", shape: "rectangle", material: "Acetate", gender: "unisex", color: "Black", hex: "#0d0d0d", price: 3400, lens: [52, 36, 20], temple: 140, blurb: "Chunky black rectangle sunglasses with a bold, fashion-forward look" },
  { file: "black-flat-top-sun", name: "Shield", code: "3011", category: "sunglasses", shape: "square", material: "TR90", gender: "men", color: "Black / Gradient", hex: "#111111", price: 3900, lens: [60, 50, 16], temple: 145, blurb: "Oversized flat-top sunglasses with gradient lenses" },
  { file: "round-metal-sun", name: "Luna", code: "3007", category: "sunglasses", shape: "round", material: "Metal", gender: "women", color: "Silver", hex: "#c9ccd1", price: 3900, lens: [48, 46, 21], temple: 140, blurb: "Small round silver-metal sunglasses with light mirror lenses" },
];

const MATERIAL_TEXT: Record<string, string> = {
  Acetate: "Hand-polished acetate with a deep, rich finish and reinforced temples.",
  TR90: "Flexible TR90 with spring hinges — it bends instead of snapping and weighs next to nothing.",
  Metal: "Slim metal frame with adjustable nose pads for a precise fit.",
};

export async function addPhotoFrames(db: PrismaClient) {
  const dir = path.join(process.cwd(), "prisma", "demo-photos");
  const firstRun = !(await db.product.findUnique({ where: { slug: "carbon-3002" } }));
  let added = 0;
  let heroUrl = "";
  for (const [i, f] of FRAMES.entries()) {
    const slug = `${f.name.toLowerCase()}-${f.code}`;
    const file = path.join(dir, `${f.file}.jpg`);
    if (!fs.existsSync(file)) continue;
    const found = await db.product.findUnique({ where: { slug }, include: { variants: true } });
    if (found) {
      if (i === 0) heroUrl = JSON.parse(found.variants[0]?.images || "[]")[0] || "";
      continue;
    }
    const data = fs.readFileSync(file);
    const up = await db.upload.create({ data: { kind: "image", fileName: `${f.file}.jpg`, mime: "image/jpeg", size: data.length, isPublic: true, data } });
    const url = `/api/files/${up.id}`;
    if (i === 0) heroUrl = url;
    const [lensWidth, lensHeight, bridge] = f.lens;
    const sun = f.category === "sunglasses";
    await db.product.create({
      data: {
        slug, name: f.name, modelCode: f.code, category: f.category, shape: f.shape, material: f.material, gender: f.gender,
        faceShapes: faceShapesFor(f.shape as never).join(","),
        price: f.price, compareAt: f.compareAt ?? null,
        description: `${f.blurb}. ${MATERIAL_TEXT[f.material] || ""} ${sun ? "Supplied with UV400 sun lenses; prescription sun lenses available." : "Ready for any prescription lens."}`,
        lensWidth, lensHeight, bridge, templeLength: f.temple,
        frameWidth: lensWidth * 2 + bridge + (f.material === "Metal" ? 8 : 12),
        weightGrams: f.material === "Metal" ? 16 : f.material === "TR90" ? 14 : 24,
        isNew: true, isFeatured: true, isBestseller: !!f.best,
        // newest first, in the order above
        createdAt: new Date(Date.now() - i * 1000),
        variants: {
          create: [{
            colorName: f.color, colorHex: f.hex, accentHex: f.accent ?? null, finish: f.accent ? "twotone" : "solid",
            sku: `${f.code}-${f.color.toUpperCase().replace(/[^A-Z]+/g, "")}`, stock: 25, sortOrder: 0, images: JSON.stringify([url]),
          }],
        },
      },
    });
    added++;
  }
  if (firstRun && added) {
    // photo frames lead the homepage and shop; drawn demo frames stay in the shop below them
    await db.product.updateMany({ where: { isFeatured: true, variants: { every: { images: "[]" } } }, data: { isFeatured: false } });
    // hero photo, unless one was already uploaded in Store settings
    const row = await db.setting.findUnique({ where: { key: "storeSettings" } });
    const s = row ? JSON.parse(row.value) : {};
    if (heroUrl && !s?.home?.heroImage) {
      s.home = { ...(s.home || {}), heroImage: heroUrl };
      await db.setting.upsert({ where: { key: "storeSettings" }, update: { value: JSON.stringify(s) }, create: { key: "storeSettings", value: JSON.stringify(s) } });
    }
  }
  if (added) console.log(`Added ${added} frames with real photos.`);
}
