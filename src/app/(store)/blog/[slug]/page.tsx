import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { site } from "@/lib/site";
import { getSettings } from "@/lib/settings";
import { jsonLd } from "@/lib/types";
import Markdown from "@/components/Markdown";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const post = await db.post.findUnique({ where: { slug: (await params).slug } });
  if (!post) return {};
  return { title: post.title, description: post.excerpt, alternates: { canonical: `/blog/${post.slug}` }, openGraph: { type: "article", title: post.title, description: post.excerpt } };
}

export default async function PostPage({ params }: P) {
  const post = await db.post.findUnique({ where: { slug: (await params).slug } });
  if (!post || !post.published) notFound();
  const { store } = await getSettings();
  return (
    <article className="container-x py-12 max-w-3xl">
      <Link href="/blog" className="text-sm text-[var(--blue)] font-bold">← Journal</Link>
      <h1 className="h-section mt-4">{post.title}</h1>
      <p className="muted mt-2">{post.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
      <p className="lead mt-6">{post.excerpt}</p>
      <div className="mt-8"><Markdown text={post.body} /></div>
      <div className="card p-6 mt-12 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="font-display text-xl font-semibold text-[var(--navy)]">See it on your face</div>
          <p className="muted text-sm">Try any frame in 3D with your camera.</p>
        </div>
        <Link href="/try-on" className="btn btn-primary">Open try-on</Link>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd({ "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.excerpt, datePublished: post.createdAt.toISOString(), publisher: { "@type": "Organization", name: store.name }, mainEntityOfPage: `${site.url}/blog/${post.slug}` }) }}
      />
    </article>
  );
}
