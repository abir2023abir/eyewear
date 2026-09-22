import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Journal — Eyewear Guides & Advice",
  description: "Guides on choosing frames for your face shape, reading your prescription, and picking the right lenses.",
  alternates: { canonical: "/blog" },
};
export const revalidate = 600;

export default async function Blog() {
  const posts = await db.post.findMany({ where: { published: true }, orderBy: { createdAt: "desc" } });
  return (
    <div className="container-x py-12">
      <div className="eyebrow">Journal</div>
      <h1 className="h-section mt-1 mb-10">Guides & advice</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((p, i) => (
          <Link key={p.id} href={`/blog/${p.slug}`} className="p-card">
            <div className="aspect-[16/9] grid place-items-end p-5" style={{ background: `linear-gradient(135deg, ${["#1d5bd8", "#0a2463", "#3b82f6"][i % 3]}, ${["#0a2463", "#3b82f6", "#1d5bd8"][i % 3]})` }}>
              <span className="tag !bg-white/20">{p.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            <div className="p-5">
              <h2 className="font-display text-xl font-semibold text-[var(--navy)]">{p.title}</h2>
              <p className="muted text-sm mt-2">{p.excerpt}</p>
              <span className="text-[var(--blue)] font-bold text-sm mt-3 inline-block">Read →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
