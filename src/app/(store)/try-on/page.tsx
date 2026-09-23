import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { toDTO } from "@/lib/types";
import TryOnLoader from "./TryOnLoader";

export const metadata: Metadata = {
  title: "3D Virtual Try-On — See Glasses on Your Face",
  description: "Try on every frame live with your camera or a selfie. Automatic face tracking, true-size fit check, face-shape suggestions. Runs 100% on your device.",
  alternates: { canonical: "/try-on" },
};

export default async function TryOnPage({ searchParams }: { searchParams: Promise<{ p?: string; v?: string }> }) {
  const { p, v } = await searchParams;
  const products = await db.product.findMany({
    where: { active: true, variants: { some: {} } },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ isFeatured: "desc" }, { isBestseller: "desc" }, { name: "asc" }],
  });
  return (
    <div className="container-x py-8">
      <div className="mb-6">
        <div className="eyebrow">3D virtual try-on</div>
        <h1 className="h-section mt-1">Your fitting room</h1>
        <p className="muted mt-1">Real 3D frames, automatic face tracking, true-size fit. Nothing leaves your device.</p>
      </div>
      {products.length ? (
        <TryOnLoader products={products.map(toDTO)} initialSlug={p} initialVariant={v} />
      ) : (
        <div className="card p-10 text-center">
          <p className="lead">New frames are on their way — please check back soon.</p>
          <Link href="/" className="btn btn-primary mt-5">Back to the shop</Link>
        </div>
      )}
    </div>
  );
}
