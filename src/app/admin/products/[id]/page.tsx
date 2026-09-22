import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { toDTO } from "@/lib/types";
import ProductEditor from "./ProductEditor";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "new") return <ProductEditor initial={null} />;
  const p = await db.product.findUnique({ where: { id }, include: { variants: { orderBy: { sortOrder: "asc" } } } });
  if (!p) notFound();
  return <ProductEditor initial={{ ...toDTO(p), active: p.active, isFeatured: p.isFeatured }} />;
}
