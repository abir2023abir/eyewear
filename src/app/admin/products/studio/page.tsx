import Link from "next/link";
import { db } from "@/lib/db";
import { toDTO } from "@/lib/types";
import StudioPhotos from "./StudioPhotos";

export default async function Studio() {
  const rows = await db.product.findMany({
    where: { variants: { some: {} } },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  const products = rows.map(toDTO);
  return (
    <div className="grid gap-5 max-w-3xl">
      <div>
        <Link href="/admin/products" className="text-sm text-[var(--blue)] font-semibold">← Frames & stock</Link>
        <h1 className="h-section !text-3xl mt-1">Create studio photos</h1>
        <p className="muted text-sm mt-1">
          One click makes two realistic product photos for every colour — <b>folded</b> and <b>open</b> — in the exact colour, with studio
          light and a soft shadow. They are made from each frame’s 3D model (your uploaded .glb when there is one).
        </p>
      </div>
      <div className="card p-4 text-sm grid gap-1">
        <b>Good to know</b>
        <span>• Colours that already have photos are skipped, so your real photos are never replaced.</span>
        <span>• Keep this tab open until it says “Done”. About 2 seconds per colour.</span>
        <span>• Later you can replace any photo with a real one in the frame’s page, Step 3.</span>
      </div>
      <StudioPhotos products={products} />
    </div>
  );
}
