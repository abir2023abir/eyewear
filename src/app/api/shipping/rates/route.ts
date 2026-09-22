import { NextResponse } from "next/server";
import { z } from "zod";
import { quoteShipping } from "@/lib/shipping";
import { rateLimit } from "@/lib/ratelimit";

const schema = z.object({
  country: z.string().length(2),
  frames: z.number().int().min(1).max(50),
  itemsTotal: z.number().int().min(0).max(100_000_000).optional(),
  hasLenses: z.boolean().optional(),
});

/** Shipping estimate for checkout (price + estimated delivery window). Final price is set on the order. */
export async function POST(req: Request) {
  if (!(await rateLimit("rates", 60, 10 * 60_000))) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const q = await quoteShipping(p.data.country, p.data.frames, p.data.itemsTotal, p.data.hasLenses);
  return NextResponse.json({ quote: q });
}
