import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { site } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // a database hiccup must never fail the build: fall back to the fixed pages
  const [products, posts] = await Promise.all([
    db.product.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }).catch(() => []),
    db.post.findMany({ where: { published: true }, select: { slug: true, createdAt: true } }).catch(() => []),
  ]);
  const staticPages = ["", "/shop", "/shop?category=optical", "/shop?category=sunglasses", "/try-on", "/lenses", "/blog", "/policies/shipping", "/policies/returns", "/policies/privacy", "/policies/terms"];
  return [
    ...staticPages.map((p) => ({ url: `${site.url}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...products.map((p) => ({ url: `${site.url}/product/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${site.url}/blog/${p.slug}`, lastModified: p.createdAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
