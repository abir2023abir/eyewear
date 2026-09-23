import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { faceShapesFor } from "../src/lib/frame-geometry";
import { addPhotoFrames } from "./photo-frames";

const db = new PrismaClient();

const NAMES = [
  "Aster", "Blake", "Cove", "Dune", "Ember", "Fjord", "Grove", "Haven", "Iris", "Juno", "Kestrel", "Lark",
  "Mesa", "Nova", "Orion", "Pike", "Quill", "Rune", "Sable", "Tide", "Umber", "Vale", "Wren", "Xeno",
  "Yara", "Zephyr", "Atlas", "Briar", "Cedar", "Delta", "Echo", "Flint", "Gale", "Harbor", "Indigo",
  "Jasper", "Koda", "Lumen", "Maple", "North", "Onyx", "Pax", "Quartz", "Reef", "Solstice", "Tundra",
  "Ursa", "Vesper", "Willow", "Yuki", "Zion", "Alder", "Bay", "Cairn", "Drift", "Elm", "Fern", "Glen",
  "Heath", "Isle",
];

const SHAPES: { shape: string; w: number; h: number; blurb: string }[] = [
  { shape: "rectangle", w: 53, h: 36, blurb: "Clean rectangle with a slim profile" },
  { shape: "square", w: 51, h: 42, blurb: "Bold square with generous lens depth" },
  { shape: "round", w: 48, h: 45, blurb: "Classic round with a keyhole feel" },
  { shape: "oval", w: 51, h: 38, blurb: "Soft oval that suits nearly everyone" },
  { shape: "cat-eye", w: 53, h: 40, blurb: "Lifted cat-eye with a sharp outer sweep" },
  { shape: "aviator", w: 56, h: 46, blurb: "Teardrop aviator with a flat brow line" },
  { shape: "wayfarer", w: 52, h: 40, blurb: "Trapezoid wayfarer with a strong top" },
  { shape: "browline", w: 51, h: 39, blurb: "Retro browline with an accented top bar" },
  { shape: "geometric", w: 50, h: 44, blurb: "Hexagonal geometric for a modern edge" },
];

const MATERIALS = ["TR90", "TR90", "Acetate", "Metal", "Titanium"];
const GENDERS = ["unisex", "unisex", "men", "women", "unisex", "kids"];

// finish: "gradient" fades from hex (top) to accent (bottom); "twotone" = accent browline on top
const PALETTES: { name: string; hex: string; accent?: string; finish?: "solid" | "twotone" | "gradient" }[][] = [
  [{ name: "Jet Black", hex: "#16181d" }, { name: "Tortoise", hex: "#6b3f1f" }, { name: "Crystal Clear", hex: "#c9d6e3" }, { name: "Wine / Rose fade", hex: "#5a1426", accent: "#e3a3b1", finish: "gradient" }, { name: "Black / Crystal fade", hex: "#16181d", accent: "#d7dde6", finish: "gradient" }],
  [{ name: "Matte Black", hex: "#23252a" }, { name: "Navy / Sky fade", hex: "#1c2f5a", accent: "#9cc3ea", finish: "gradient" }, { name: "Honey", hex: "#b7792c" }, { name: "Rose", hex: "#c98796" }, { name: "Purple / Pink fade", hex: "#4a1d3f", accent: "#e7b7c8", finish: "gradient" }],
  [{ name: "Gold", hex: "#c9a14a" }, { name: "Silver", hex: "#aeb4bd" }, { name: "Gunmetal", hex: "#4a4f57" }, { name: "Rose Gold", hex: "#c99a86" }, { name: "Black", hex: "#1a1a1a" }],
  [{ name: "Black / Gold", hex: "#1a1a1a", accent: "#1a1a1a" }, { name: "Tortoise / Gold", hex: "#c9a14a", accent: "#6b3f1f" }, { name: "Navy / Silver", hex: "#aeb4bd", accent: "#1c2f5a" }, { name: "Wine / Gold", hex: "#c9a14a", accent: "#6d1f33" }, { name: "Grey / Silver", hex: "#aeb4bd", accent: "#5c636e" }],
];

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

// Lens types are switched off by default (products sell as frame + optional upgrades); turn them on in Admin → Lens pricing.
const LENSES = [
  { kind: "type", code: "none", name: "Frame only", description: "No lenses — use your own or fit locally.", price: 0, sortOrder: 0 },
  { kind: "type", code: "clear", name: "Clear (single vision)", description: "1.56 index clear lens with hard scratch coat. Cut to your prescription.", price: 1500, sortOrder: 1, active: false },
  { kind: "type", code: "ar", name: "Anti-Reflection", description: "Multi-layer coating that cuts glare from screens and headlights.", price: 2500, sortOrder: 2, active: false },
  { kind: "type", code: "bluecut", name: "Bluecut + UV400", description: "Filters high-energy blue light and blocks 100% UV. Best for long screen days.", price: 3500, sortOrder: 3, active: false },
  { kind: "type", code: "photosun", name: "Bluecut + Photosun", description: "Clear indoors, darkens automatically outdoors. Blue-light and UV protection built in.", price: 4900, sortOrder: 4, active: false },
  { kind: "coating", code: "thin167", name: "Ultra-thin 1.67 index", description: "Recommended for SPH beyond ±4.00 — thinner, lighter edges.", price: 3000, sortOrder: 10 },
  { kind: "coating", code: "hydro", name: "Hydrophobic + oil repellent", description: "Water and fingerprints wipe straight off.", price: 800, sortOrder: 11 },
  { kind: "coating", code: "scratch", name: "Premium scratch guard", description: "Extra-hard top coat for active wear.", price: 600, sortOrder: 12 },
];

const POSTS = [
  {
    slug: "how-to-choose-frames-for-your-face-shape",
    title: "How to choose frames for your face shape",
    excerpt: "Round, square, heart or oval — a quick guide to frames that balance your features.",
    body: `Your face shape is the easiest shortcut to frames that look right the first time.

## Find your face shape
Look straight into a mirror and compare the width of your forehead, cheekbones and jaw, then the overall length of your face. Our virtual try-on does this automatically and suggests frames for you.

## Quick matches
- Round faces: rectangle, square and wayfarer frames add definition.
- Square faces: round, oval and aviator frames soften strong angles.
- Heart faces: light oval or round frames balance a wider forehead.
- Oblong faces: deep frames with a strong top shorten the face visually.
- Oval faces: almost anything works — go with your style.

## Size matters more than shape
A frame that is too wide slides down your nose; too narrow and it pinches your temples. Look for the "Fits you" badge in the try-on studio, which compares the frame width with your measured face width.`,
  },
  {
    slug: "reading-your-eyeglass-prescription",
    title: "Reading your eyeglass prescription: SPH, CYL, AXIS and PD",
    excerpt: "What every number on your prescription means, and how to enter it at checkout.",
    body: `Prescriptions look cryptic, but only a few numbers matter when ordering glasses online.

## OD and OS
OD is your right eye, OS is your left eye. Some prescriptions write R and L instead.

## SPH (sphere)
The main lens power. A minus sign means short-sighted, a plus sign means long-sighted.

## CYL and AXIS
CYL corrects astigmatism. AXIS (0–180) tells the lab which direction to orient that correction. If CYL is blank, leave AXIS blank too.

## PD (pupillary distance)
The distance between your pupils in millimetres, usually 54–74. If your prescription has two numbers, enter them as right and left PD.

## Not sure?
Upload a photo of your prescription at checkout and our opticians will check it before your lenses are cut.`,
  },
  {
    slug: "bluecut-vs-photosun-lenses",
    title: "Bluecut vs Photosun lenses: which should you pick?",
    excerpt: "Screen-heavy days or outdoor commutes? How our two most popular lens upgrades compare.",
    body: `Both lenses filter blue light and block UV. The difference is what happens outdoors.

## Bluecut + UV400
Stays clear everywhere. Ideal if you spend most of the day at a computer or phone.

## Bluecut + Photosun
Clear indoors and darkens to sunglass level in sunlight within about a minute. One pair for everything.

## Try both before you buy
Switch lens previews in the virtual try-on studio to see how each looks on your face.`,
  },
];

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD || "";
  const exists = await db.user.findUnique({ where: { email: adminEmail } });
  if (exists) {
    if (exists.role !== "admin") await db.user.update({ where: { id: exists.id }, data: { role: "admin" } });
  } else if (!adminPass || adminPass === "ChangeMe123!" || adminPass.length < 8) {
    console.warn("⚠ No admin created: set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters, not the example) and deploy again.");
  } else {
    await db.user.create({ data: { email: adminEmail, name: "Store Admin", role: "admin", passwordHash: await bcrypt.hash(adminPass, 11) } });
    console.log(`Admin account created for ${adminEmail}.`);
  }

  for (const l of LENSES) await db.lensOption.upsert({ where: { code: l.code }, update: l, create: l });
  for (const p of POSTS) await db.post.upsert({ where: { slug: p.slug }, update: p, create: p });

  const existing = await db.product.count();
  if (existing > 0) {
    console.log(`Products already present (${existing}) — skipping catalogue seed.`);
  } else {
    await seedCatalogue();
  }
  await addPhotoFrames(db);
}

async function seedCatalogue() {

  let skuCount = 0;
  for (let i = 0; i < NAMES.length; i++) {
    const sh = pick(SHAPES, i);
    const material = pick(MATERIALS, i * 3 + (i >> 2));
    const gender = pick(GENDERS, i * 5 + 1);
    const sun = i % 4 === 3;
    const kids = gender === "kids";
    const scale = kids ? 0.84 : 1;
    const lensWidth = Math.round((sh.w + ((i * 7) % 5) - 2) * scale);
    const lensHeight = Math.round((sh.h + ((i * 3) % 4) - 1) * scale);
    const bridge = Math.round((17 + (i % 5)) * (kids ? 0.9 : 1));
    const frameWidth = lensWidth * 2 + bridge + (material === "Metal" || material === "Titanium" ? 8 : 12);
    const metal = material === "Metal" || material === "Titanium";
    const palette = sh.shape === "browline" ? PALETTES[3] : metal ? PALETTES[2] : pick([PALETTES[0], PALETTES[1]], i);
    const basePrice = (sun ? 3400 : 2900) + (material === "Acetate" ? 1000 : 0) + (material === "Titanium" ? 3000 : 0) + (metal ? 500 : 0);
    const name = NAMES[i];
    const modelCode = String(1700 + i * 17);

    await db.product.create({
      data: {
        slug: `${name.toLowerCase()}-${modelCode}`,
        name,
        modelCode,
        category: sun ? "sunglasses" : "optical",
        shape: sh.shape,
        material,
        gender,
        faceShapes: faceShapesFor(sh.shape).join(","),
        price: basePrice,
        compareAt: i % 6 === 0 ? basePrice + 1500 : null,
        description: `${sh.blurb}. ${material === "TR90" ? "Made from flexible TR90 memory polymer with spring hinges — it bends instead of snapping and weighs next to nothing." : material === "Acetate" ? "Hand-polished cellulose acetate with a deep, rich finish and reinforced core wire temples." : material === "Titanium" ? "Pure titanium: hypoallergenic, corrosion-proof and remarkably light." : "Slim stainless-steel frame with adjustable nose pads for a precise fit."} ${sun ? "Supplied with UV400 polarised sun lenses; prescription sun lenses available." : "Ready for any prescription lens."}`,
        lensWidth, lensHeight, bridge,
        templeLength: kids ? 130 : 140 + (i % 3) * 5,
        frameWidth,
        weightGrams: metal ? 16 : material === "TR90" ? 14 : 24,
        isNew: i >= NAMES.length - 12,
        isBestseller: i % 7 === 2 || i % 11 === 0,
        isFeatured: i < 8,
        variants: {
          create: palette.map((c, k) => ({
            colorName: c.name,
            colorHex: c.hex,
            accentHex: c.accent ?? null,
            finish: c.finish ?? (c.accent ? "twotone" : "solid"),
            sku: `${modelCode}-${c.name.toUpperCase().replace(/[^A-Z]+/g, "")}`,
            stock: ((i + 3) * (k + 5)) % 40,
            sortOrder: k,
          })),
        },
      },
    });
    skuCount += palette.length;
  }
  console.log(`Seeded ${NAMES.length} frames / ${skuCount} SKUs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
