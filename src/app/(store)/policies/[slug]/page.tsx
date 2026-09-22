import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Markdown from "@/components/Markdown";
import { getSettings } from "@/lib/settings";
import { POLICY_META_AND_BODY } from "@/lib/policies-default";

type Slug = "shipping" | "returns" | "privacy" | "terms";
const SLUGS: Slug[] = ["shipping", "returns", "privacy", "terms"];
type P = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const meta = POLICY_META_AND_BODY[slug];
  return meta ? { title: meta.title, description: meta.description, alternates: { canonical: `/policies/${slug}` } } : {};
}

export default async function Policy({ params }: P) {
  const { slug } = await params;
  if (!SLUGS.includes(slug as Slug)) notFound();
  const { policies, store } = await getSettings();
  const body = (policies[slug as Slug] || POLICY_META_AND_BODY[slug].body).replace(/\{store\}/g, store.name);
  return (
    <div className="container-x py-12 grid lg:grid-cols-[220px_1fr] gap-10">
      <nav className="grid gap-1 content-start">
        {SLUGS.map((k) => (
          <Link key={k} href={`/policies/${k}`} className={`nav-link ${k === slug ? "!text-[var(--blue)] !bg-[var(--sky)]" : ""}`}>{POLICY_META_AND_BODY[k].title}</Link>
        ))}
      </nav>
      <article className="max-w-3xl">
        <h1 className="h-section mb-6">{POLICY_META_AND_BODY[slug].title}</h1>
        <Markdown text={body} />
      </article>
    </div>
  );
}
