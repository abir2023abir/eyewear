import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { priceCart, CartItemInput } from "@/lib/pricing";
import { safeJson } from "@/lib/types";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const q = await db.quote.findUnique({ where: { token } });
  if (!q) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (q.status !== "open") return NextResponse.json({ error: "This quote was already paid." }, { status: 410 });
  const priced = await priceCart(safeJson<CartItemInput[]>(q.items, []));
  return NextResponse.json({
    quote: {
      token: q.token,
      country: q.country,
      shipping: q.shipping,
      subtotal: priced.subtotal + priced.lensTotal,
      bundleDiscount: priced.bundleDiscount,
      total: priced.itemsTotal + q.shipping,
      lines: priced.lines.map((l) => ({ name: l.name, colorName: l.colorName, lensName: l.lensName, qty: l.input.qty, total: (l.unitPrice + l.lensPrice) * l.input.qty })),
    },
  });
}
