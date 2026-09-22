import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cap, toDTO } from "@/lib/types";
import { FACE_SHAPES, SHAPES } from "@/lib/frame-geometry";
import ProductCard from "@/components/ProductCard";

type SP = Record<string, string | string[] | undefined>;

const COLOR_FAMILIES: Record<string, { hex: string; words: string[] }> = {
  Black: { hex: "#16181d", words: ["Black", "Jet", "Onyx"] },
  Tortoise: { hex: "#6b3f1f", words: ["Tortoise", "Honey", "Brown"] },
  Blue: { hex: "#1f5fae", words: ["Blue", "Navy"] },
  Grey: { hex: "#5c636e", words: ["Grey", "Gray", "Smoke", "Gunmetal"] },
  Clear: { hex: "#c9d6e3", words: ["Clear", "Crystal"] },
  Gold: { hex: "#c9a14a", words: ["Gold"] },
  Silver: { hex: "#aeb4bd", words: ["Silver"] },
  Pink: { hex: "#c98796", words: ["Rose", "Pink", "Wine"] },
  Green: { hex: "#5e6b3a", words: ["Olive", "Green"] },
};

const PRICE_RANGES: [string, number, number][] = [
  ["Under US$35", 0, 3499],
  ["US$35 – 50", 3500, 5000],
  ["Over US$50", 5001, 1e9],
];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? v.split(",") : []).filter(Boolean);

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const cat = one(sp.category);
  const title = cat === "sunglasses" ? "Sunglasses" : cat === "optical" ? "Eyeglasses & Optical Frames" : "Shop All Frames";
  return { title, description: `${title} — try every frame on in 3D, prescription lenses available, DHL Express worldwide shipping.`, alternates: { canonical: cat ? `/shop?category=${cat}` : "/shop" } };
}

export default async function Shop({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 80);
  const category = one(sp.category);
  const shapes = many(sp.shape);
  const colors = many(sp.color);
  const materials = many(sp.material);
  const genders = many(sp.gender);
  const face = one(sp.face);
  const price = one(sp.price);
  const sort = one(sp.sort) || "featured";
  const page = Math.max(1, parseInt(one(sp.page) || "1") || 1);
  const PER = 24;

  const and: Prisma.ProductWhereInput[] = [{ active: true }];
  if (q) and.push({ OR: [{ name: { contains: q } }, { modelCode: { contains: q } }, { shape: { contains: q } }, { material: { contains: q } }, { description: { contains: q } }, { variants: { some: { OR: [{ colorName: { contains: q } }, { sku: { contains: q } }] } } }] });
  if (category) and.push({ category });
  if (shapes.length) and.push({ shape: { in: shapes } });
  if (materials.length) and.push({ material: { in: materials } });
  if (genders.length) and.push({ gender: { in: [...genders, ...(genders.includes("men") || genders.includes("women") ? ["unisex"] : [])] } });
  if (face) and.push({ faceShapes: { contains: face } });
  const pr = PRICE_RANGES.find((r) => r[0] === price);
  if (pr) and.push({ price: { gte: pr[1], lte: pr[2] } });
  if (colors.length) {
    const words = colors.flatMap((c) => COLOR_FAMILIES[c]?.words || []);
    if (words.length) and.push({ variants: { some: { OR: words.map((w) => ({ colorName: { contains: w } })) } } });
  }
  const where: Prisma.ProductWhereInput = { AND: and };
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "price-asc" ? [{ price: "asc" }] : sort === "price-desc" ? [{ price: "desc" }] : sort === "new" ? [{ isNew: "desc" }, { createdAt: "desc" }] : sort === "best" ? [{ isBestseller: "desc" }, { name: "asc" }] : [{ isFeatured: "desc" }, { isBestseller: "desc" }, { name: "asc" }];

  const [total, products, materialsAll] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({ where, orderBy, include: { variants: { orderBy: { sortOrder: "asc" } } }, skip: (page - 1) * PER, take: PER }),
    db.product.findMany({ where: { active: true }, select: { material: true }, distinct: ["material"] }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER));

  const href = (patch: Record<string, string | string[] | null>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | string[]> = { q, category, shape: shapes, color: colors, material: materials, gender: genders, face, price, sort };
    for (const [k, v] of Object.entries({ ...cur, ...patch })) {
      if (v == null) continue;
      const s = Array.isArray(v) ? v.join(",") : v;
      if (s && !(k === "sort" && s === "featured")) p.set(k, s);
    }
    const s = p.toString();
    return `/shop${s ? "?" + s : ""}`;
  };
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const heading = category === "sunglasses" ? "Sunglasses" : category === "optical" ? "Eyeglasses" : q ? `Results for “${q}”` : "All frames";

  return (
    <div className="container-x py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="eyebrow">Shop</div>
          <h1 className="h-section mt-1">{heading}</h1>
          <p className="muted mt-1">{total} frame{total === 1 ? "" : "s"} · {total * 5}+ colour options</p>
        </div>
        <form action="/shop" className="flex gap-2 w-full sm:w-auto">
          {category && <input type="hidden" name="category" value={category} />}
          <input name="q" defaultValue={q} placeholder="Search model, colour, shape…" className="input sm:w-72" aria-label="Search" />
          <button className="btn btn-primary">Search</button>
        </form>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-8">
        <aside className="grid gap-6 content-start lg:sticky lg:top-24 self-start">
          <Filter title="Category">
            {[["", "All"], ["optical", "Eyeglasses"], ["sunglasses", "Sunglasses"]].map(([v, l]) => (
              <Opt key={v} href={href({ category: v, page: null })} on={category === v}>{l}</Opt>
            ))}
          </Filter>
          <Filter title="Frame shape">
            <div className="flex flex-wrap gap-2">
              {SHAPES.map((s) => (
                <Link key={s} href={href({ shape: toggle(shapes, s), page: null })} className={`chip ${shapes.includes(s) ? "!bg-[var(--navy)] !text-white !border-[var(--navy)]" : ""}`}>{cap(s)}</Link>
              ))}
            </div>
          </Filter>
          <Filter title="Colour">
            <div className="flex flex-wrap gap-2.5">
              {Object.entries(COLOR_FAMILIES).map(([name, c]) => (
                <Link key={name} href={href({ color: toggle(colors, name), page: null })} title={name} aria-label={name} className={`swatch ${colors.includes(name) ? "on" : ""}`} style={{ background: c.hex }} />
              ))}
            </div>
          </Filter>
          <Filter title="Material">
            {materialsAll.map(({ material: m }) => (
              <Opt key={m} href={href({ material: toggle(materials, m), page: null })} on={materials.includes(m)} box>{m}</Opt>
            ))}
          </Filter>
          <Filter title="Gender">
            {["men", "women", "unisex", "kids"].map((g) => (
              <Opt key={g} href={href({ gender: toggle(genders, g), page: null })} on={genders.includes(g)} box>{cap(g)}</Opt>
            ))}
          </Filter>
          <Filter title="Price">
            {PRICE_RANGES.map(([l]) => (
              <Opt key={l} href={href({ price: price === l ? "" : l, page: null })} on={price === l}>{l}</Opt>
            ))}
          </Filter>
          <Filter title="Face shape">
            <div className="flex flex-wrap gap-2">
              {FACE_SHAPES.map((f) => (
                <Link key={f} href={href({ face: face === f ? "" : f, page: null })} className={`chip ${face === f ? "!bg-[var(--navy)] !text-white !border-[var(--navy)]" : ""}`}>{cap(f)}</Link>
              ))}
            </div>
            <Link href="/try-on" className="text-[13px] text-[var(--blue)] font-bold mt-2 inline-block">Not sure? Detect it with the camera →</Link>
          </Filter>
          <Link href="/shop" className="btn btn-outline btn-sm">Clear all filters</Link>
        </aside>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex flex-wrap gap-2">
              {[...shapes, ...colors, ...materials, ...genders, face, price].filter(Boolean).map((f) => (
                <span key={f} className="tag tag-light">{f}</span>
              ))}
            </div>
            <div className="flex gap-1.5 text-sm flex-wrap">
              {[["featured", "Featured"], ["new", "Newest"], ["best", "Bestsellers"], ["price-asc", "Price ↑"], ["price-desc", "Price ↓"]].map(([v, l]) => (
                <Link key={v} href={href({ sort: v, page: null })} className={`px-3 py-1.5 rounded-full font-semibold ${sort === v ? "bg-[var(--navy)] text-white" : "hover:bg-[var(--sky)]"}`}>{l}</Link>
              ))}
            </div>
          </div>
          {products.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="lead">No frames match those filters.</p>
              <Link href="/shop" className="btn btn-primary mt-4">Reset filters</Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {products.map((p) => <ProductCard key={p.id} p={toDTO(p)} />)}
            </div>
          )}
          {pages > 1 && (
            <nav className="flex justify-center gap-2 mt-10" aria-label="Pagination">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link key={n} href={href({ page: String(n) })} className={`w-10 h-10 grid place-items-center rounded-full font-bold ${n === page ? "bg-[var(--navy)] text-white" : "border border-[var(--line)] hover:border-[var(--blue)]"}`}>{n}</Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}

function Filter({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--line)] pb-5">
      <div className="text-[12px] font-extrabold tracking-[.14em] uppercase text-[var(--navy)] mb-3">{title}</div>
      <div className="grid gap-1.5">{children}</div>
    </div>
  );
}
function Opt({ href, on, box, children }: { href: string; on: boolean; box?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`flex items-center gap-2.5 text-sm py-1 ${on ? "font-bold text-[var(--blue)]" : "hover:text-[var(--blue)]"}`} scroll={false}>
      <span className={`w-4 h-4 ${box ? "rounded" : "rounded-full"} border-2 grid place-items-center ${on ? "border-[var(--blue)] bg-[var(--blue)]" : "border-[var(--line)]"}`}>
        {on && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
      </span>
      {children}
    </Link>
  );
}
