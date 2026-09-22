"use client";
import dynamic from "next/dynamic";
import type { ProductDTO } from "@/lib/types";

const TryOnStudio = dynamic(() => import("@/components/TryOnStudio"), {
  ssr: false,
  loading: () => <div className="aspect-[4/3] rounded-[26px] bg-[var(--sky)] grid place-items-center muted">Loading fitting room…</div>,
});

export default function TryOnLoader(props: { products: ProductDTO[]; initialSlug?: string; initialVariant?: string }) {
  return <TryOnStudio {...props} />;
}
