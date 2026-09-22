import "server-only";
import { db } from "./db";

const ONLINE_MS = 60_000;

/** The seller counts as online while the admin chat inbox is open (it pings every 20 s). */
export async function sellerOnline() {
  const s = await db.setting.findUnique({ where: { key: "sellerLastSeen" } });
  return !!s && Date.now() - Number(s.value) < ONLINE_MS;
}

export async function touchSeller() {
  const value = String(Date.now());
  await db.setting.upsert({ where: { key: "sellerLastSeen" }, update: { value }, create: { key: "sellerLastSeen", value } });
}

export function serializeMessage(m: { id: string; sender: string; kind: string; body: string; payload: string; createdAt: Date; updatedAt?: Date }) {
  let payload: unknown = null;
  try {
    payload = m.payload ? JSON.parse(m.payload) : null;
  } catch {}
  return { id: m.id, sender: m.sender, kind: m.kind, body: m.body, payload, createdAt: m.createdAt.toISOString(), updatedAt: (m.updatedAt || m.createdAt).toISOString() };
}
