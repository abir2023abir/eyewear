import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { cap, jsonLd, toDTO } from "@/lib/types";
import { site } from "@/lib/site";
import { getSettings } from "@/lib/settings";
import ProductView from "@/components/ProductView";
import ProductCard from "@/components/ProductCard";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ v?: string }> };

async function load(slug: string) {
  return db.product.findUnique({ where: { slug }, include: { variants: { orderBy: { sortOrder: "asc" } } } });
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await load((await params).slug);
  if (!p) return {};
  const title = `${p.name} ${p.modelCode} — ${cap(p.shape)} ${p.category === "sunglasses" ? "Sunglasses" : "Eyeglasses"}`;
  return {
    title,
    description: `${p.description.slice(0, 150)} Try it on in 3D. Ships worldwide by DHL Express.`,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title, type: "website", url: `/product/${p.slug}` },
  };
}

export default async function ProductPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { v } = await searchParams;
  const p = await load(slug);
  if (!p || !p.active) notFound();
  const [lenses, related] = await Promise.all([
    db.lensOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { code: true, kind: true, name: true, description: true, price: true } }),
    db.product.findMany({ where: { active: true, shape: p.shape, NOT: { id: p.id } }, include: { variants: { orderBy: { sortOrder: "asc" } } }, take: 4 }),
  ]);
  const dto = toDTO(p);
  const { store } = await getSettings();

  const ld = {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    name: `${p.name} ${p.modelCode}`,
    description: p.description,
    brand: { "@type": "Brand", name: store.name },
    productGroupID: p.modelCode,
    variesBy: ["https://schema.org/color"],
    hasVariant: p.variants.map((x) => ({
      "@type": "Product",
      sku: x.sku,
      name: `${p.name} ${p.modelCode} ${x.colorName}`,
      color: x.colorName,
      offers: {
        "@type": "Offer",
        url: `${site.url}/product/${p.slug}?v=${x.id}`,
        priceCurrency: "USD",
        price: (p.price / 100).toFixed(2),
        availability: x.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      },
    })),
  };

  return (
    <div className="container-x py-8">
      <nav className="text-sm muted mb-6" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[var(--blue)]">Home</Link> /{" "}
        <Link href={`/shop?category=${p.category}`} className="hover:text-[var(--blue)]">{p.category === "sunglasses" ? "Sunglasses" : "Eyeglasses"}</Link> /{" "}
        <span className="text-[var(--ink)]">{p.name}</span>
      </nav>
      <ProductView p={dto} lenses={lenses} initialVariant={v} />
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="h-section mb-8">More {p.shape} frames</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((r) => <ProductCard key={r.id} p={toDTO(r)} />)}
          </div>
        </section>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(ld) }} />
    </div>
  );
}
