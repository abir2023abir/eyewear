export type VariantDTO = {
  id: string;
  colorName: string;
  colorHex: string;
  accentHex: string | null;
  finish: string;
  sku: string;
  stock: number;
  images: string[];
  modelUrl: string | null;
  tryOnImage: string | null;
};

export type ProductDTO = {
  id: string;
  slug: string;
  name: string;
  modelCode: string;
  category: string;
  shape: string;
  material: string;
  gender: string;
  faceShapes: string[];
  price: number;
  compareAt: number | null;
  description: string;
  lensWidth: number;
  lensHeight: number;
  bridge: number;
  templeLength: number;
  frameWidth: number;
  weightGrams: number;
  isNew: boolean;
  isBestseller: boolean;
  variants: VariantDTO[];
};

export function toDTO(p: any): ProductDTO {
  return {
    id: p.id, slug: p.slug, name: p.name, modelCode: p.modelCode, category: p.category, shape: p.shape,
    material: p.material, gender: p.gender, faceShapes: p.faceShapes ? p.faceShapes.split(",") : [],
    price: p.price, compareAt: p.compareAt, description: p.description, lensWidth: p.lensWidth,
    lensHeight: p.lensHeight, bridge: p.bridge, templeLength: p.templeLength, frameWidth: p.frameWidth,
    weightGrams: p.weightGrams, isNew: p.isNew, isBestseller: p.isBestseller,
    variants: (p.variants || []).map((v: any) => ({
      id: v.id, colorName: v.colorName, colorHex: v.colorHex, accentHex: v.accentHex, finish: v.finish ?? "solid", sku: v.sku, stock: v.stock,
      images: safeJson(v.images, []), modelUrl: v.modelUrl, tryOnImage: v.tryOnImage ?? null,
    })),
  };
}

export function safeJson<T>(s: string | null | undefined, fb: T): T {
  try {
    return s ? JSON.parse(s) : fb;
  } catch {
    return fb;
  }
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Safe JSON for <script type="application/ld+json"> — escapes "<" so content can't close the tag. */
export const jsonLd = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");
