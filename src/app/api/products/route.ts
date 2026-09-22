import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toDTO } from "@/lib/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 100);
  const q = (url.searchParams.get("q") || "").slice(0, 60);
  const items = await db.product.findMany({
    where: {
      active: true,
      ...(ids.length ? { id: { in: ids } } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { modelCode: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
    take: ids.length ? 100 : 20,
  });
  return NextResponse.json({ items: items.map(toDTO) });
}
