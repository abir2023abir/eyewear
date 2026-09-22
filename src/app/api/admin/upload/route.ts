import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fileUrl, saveUpload } from "@/lib/uploads";

/** Admin uploads: product photos and 3D try-on models (public files). */
export async function POST(req: Request) {
  let s;
  try {
    s = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  const kind = fd?.get("kind");
  if (!(file instanceof File) || (kind !== "image" && kind !== "model")) return NextResponse.json({ error: "Bad upload" }, { status: 400 });
  try {
    const u = await saveUpload(file, kind, { userId: s.uid, isPublic: true });
    return NextResponse.json({ id: u.id, url: fileUrl(u.id) });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Upload failed" }, { status: 400 });
  }
}
