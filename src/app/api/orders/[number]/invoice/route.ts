import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buildInvoicePdf, invoiceNumber } from "@/lib/invoice";

/** Invoice PDF download — for the customer (order link or their account) and admins. */
export async function GET(req: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const t = new URL(req.url).searchParams.get("t");
  const order = await db.order.findUnique({ where: { number }, include: { items: true } });
  if (!order) return new Response("Not found", { status: 404 });
  const s = await getSession();
  const allowed = (t && t === order.accessToken) || (s && (s.role === "admin" || s.uid === order.userId));
  if (!allowed) return new Response("Not found", { status: 404 });
  const pdf = await buildInvoicePdf(order);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoiceNumber(order)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
