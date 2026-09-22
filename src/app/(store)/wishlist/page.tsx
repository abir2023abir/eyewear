"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { useStore } from "@/components/Providers";
import type { ProductDTO } from "@/lib/types";

export default function WishlistPage() {
  const { wishlist, me } = useStore();
  const [items, setItems] = useState<ProductDTO[] | null>(null);

  useEffect(() => {
    if (!wishlist.length) return setItems([]);
    fetch(`/api/products?ids=${wishlist.join(",")}`).then((r) => r.json()).then((j) => setItems(j.items || []));
  }, [wishlist]);

  return (
    <div className="container-x py-12">
      <div className="eyebrow">Saved for later</div>
      <h1 className="h-section mt-1 mb-2">Wishlist</h1>
      {!me && <p className="muted mb-8">Saved on this device. <Link href="/login?next=/wishlist" className="text-[var(--blue)] font-bold">Sign in</Link> to keep it in your account.</p>}
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center mt-6">
          <p className="lead">Tap the heart on any frame to save it here.</p>
          <Link href="/shop" className="btn btn-primary mt-5">Browse frames</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          {items.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
