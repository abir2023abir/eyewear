import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { rateLimit } from "@/lib/ratelimit";

// Customer uploads (prescription photos). Admin uploads go through /api/admin/upload.
export async function POST(req: Request) {
  if (!(await rateLimit("upload", 20, 60 * 60_000))) return NextResponse.json({ error: "Too many uploads" }, { status: 429 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (fd?.get("kind") !== "prescription") return NextResponse.json({ error: "Bad upload kind" }, { status: 400 });
  const s = await getSession();
  try {
    const u = await saveUpload(file, "prescription", { userId: s?.uid });
    return NextResponse.json({ id: u.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Upload failed" }, { status: 400 });
  }
}
