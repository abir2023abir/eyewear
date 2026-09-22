"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { useStore } from "@/components/Providers";
import type { ProductDTO } from "@/lib/types";

export default function AccountWishlist() {
  const { wishlist } = useStore();
  const [items, setItems] = useState<ProductDTO[] | null>(null);
  useEffect(() => {
    if (!wishlist.length) return setItems([]);
    fetch(`/api/products?ids=${wishlist.join(",")}`).then((r) => r.json()).then((j) => setItems(j.items || [])).catch(() => setItems([]));
  }, [wishlist]);

  return (
    <section>
      <h2 className="font-display text-2xl font-semibold text-[var(--navy)] mb-4">Wishlist</h2>
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="muted">Tap the heart on any frame to save it here.</p>
          <Link href="/shop" className="btn btn-primary mt-5">Browse frames</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {items.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </section>
  );
}
