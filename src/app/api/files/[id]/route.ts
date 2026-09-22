import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { STORAGE_DIR } from "@/lib/uploads";

/** Serves stored files. Private files (prescriptions, receipts, labels) only to admins or their owner. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await db.upload.findUnique({ where: { id } });
  if (!u) return new Response("Not found", { status: 404 });
  if (!u.isPublic) {
    const s = await getSession();
    if (!s || (s.role !== "admin" && (!u.userId || s.uid !== u.userId))) return new Response("Not found", { status: 404 });
  }
  const buf = u.data ?? (await readFile(path.join(STORAGE_DIR, path.basename(u.fileName))).catch(() => null));
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": u.mime,
      "Cache-Control": u.isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
      "Content-Disposition": u.mime === "application/pdf" ? `inline; filename="${u.kind}.pdf"` : "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
