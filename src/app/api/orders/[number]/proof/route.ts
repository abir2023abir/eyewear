import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { saveUpload } from "@/lib/uploads";
import { alertSeller } from "@/lib/notify";
import { rateLimit } from "@/lib/ratelimit";
import { usd } from "@/lib/money";
import { onReceiptUploaded } from "@/lib/chat-checkout";
import { emailReceiptUploaded } from "@/lib/emails";

/** XTransfer: customer uploads their bank-transfer receipt; seller verifies in the admin panel. */
export async function POST(req: Request, { params }: { params: Promise<{ number: string }> }) {
  if (!(await rateLimit("proof", 10, 60 * 60_000))) return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  const { number } = await params;
  const fd = await req.formData().catch(() => null);
  const token = fd?.get("token");
  const file = fd?.get("file");
  const reference = String(fd?.get("reference") || "").slice(0, 80);
  const order = await db.order.findUnique({ where: { number } });
  if (!order || typeof token !== "string" || token !== order.accessToken) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.paymentStatus === "paid") return NextResponse.json({ error: "This order is already paid." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  try {
    const up = await saveUpload(file, "payment-proof", { userId: order.userId });
    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        proofUploadId: up.id,
        paymentMethod: "xtransfer",
        paymentStatus: "awaiting_verification",
        notes: reference ? `${order.notes}\nBank ref: ${reference}`.trim() : order.notes,
      },
      include: { items: true },
    });
    await emailReceiptUploaded(updated);
    await onReceiptUploaded(updated).catch((e) => console.error("[chat] receipt message failed", e));
    await alertSeller(`Bank transfer receipt — ${order.number}`, `${order.name} uploaded a transfer receipt for ${usd(order.total)}${reference ? ` (ref ${reference})` : ""}. Please verify.`, `/admin/orders/${order.id}`);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Upload failed" }, { status: 400 });
  }
}
