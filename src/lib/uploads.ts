import "server-only";
import path from "path";
import { randomBytes } from "crypto";
import { db } from "./db";

/** Old uploads (before files moved into the database) may still be here on a local machine. */
export const STORAGE_DIR = path.join(process.cwd(), "storage");

// Vercel accepts request bodies up to ~4.5 MB, so every upload stays under 4 MB.
// Photos are shrunk in the browser before upload (see lib/shrink-image.ts).
const MB4 = 4 << 20;

const ALLOWED: Record<string, { mimes: string[]; max: number }> = {
  prescription: { mimes: ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"], max: MB4 },
  "payment-proof": { mimes: ["image/jpeg", "image/png", "image/webp", "application/pdf"], max: MB4 },
  image: { mimes: ["image/jpeg", "image/png", "image/webp"], max: MB4 },
  model: { mimes: ["model/gltf-binary", "application/octet-stream"], max: MB4 },
  label: { mimes: ["application/pdf"], max: MB4 },
};

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic",
  "application/pdf": "pdf", "model/gltf-binary": "glb", "application/octet-stream": "glb",
};

function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  if (buf.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (buf.subarray(0, 4).toString() === "glTF") return "model/gltf-binary";
  if (buf.subarray(4, 12).toString().includes("ftyphei")) return "image/heic";
  return null;
}

/** Validates by magic bytes (not the client-sent type) and stores the file under ./storage. */
export async function saveUpload(file: File, kind: keyof typeof ALLOWED, opts: { userId?: string | null; isPublic?: boolean } = {}) {
  const rule = ALLOWED[kind];
  if (!rule) throw new Error("Bad upload kind");
  if (file.size > rule.max) throw new Error(`File too large (max ${rule.max >> 20} MB)`);
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniff(buf);
  if (!mime || !rule.mimes.includes(mime)) throw new Error("Unsupported file type");
  const fileName = `${randomBytes(16).toString("hex")}.${EXT[mime]}`;
  return db.upload.create({
    data: { kind, fileName, mime, size: file.size, isPublic: !!opts.isPublic, userId: opts.userId ?? null, data: new Uint8Array(buf) },
    select: { id: true, kind: true, fileName: true, mime: true, size: true, isPublic: true, userId: true, createdAt: true },
  });
}

export async function saveBuffer(buf: Buffer, kind: string, mime: string, ext: string) {
  const fileName = `${randomBytes(16).toString("hex")}.${ext}`;
  return db.upload.create({
    data: { kind, fileName, mime, size: buf.length, isPublic: false, data: new Uint8Array(buf) },
    select: { id: true, kind: true, fileName: true, mime: true, size: true, isPublic: true, userId: true, createdAt: true },
  });
}

export const fileUrl = (id: string) => `/api/files/${id}`;
