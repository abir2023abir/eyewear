import "server-only";
import { headers } from "next/headers";

// Simple in-memory fixed-window limiter. For multi-instance deployments, back this with Redis.
const buckets = new Map<string, { n: number; reset: number }>();

/**
 * Client IP. The LAST X-Forwarded-For entry is the one added by our own reverse proxy / host,
 * so visitors can't dodge rate limits by sending a fake X-Forwarded-For header.
 */
export async function clientIp() {
  const h = await headers();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",").map((s) => s.trim()).filter(Boolean).pop() || "local";
  return "local";
}

export async function rateLimit(key: string, limit: number, windowMs: number) {
  const k = `${key}:${await clientIp()}`;
  const now = Date.now();
  const b = buckets.get(k);
  if (!b || b.reset < now) {
    buckets.set(k, { n: 1, reset: now + windowMs });
    if (buckets.size > 10000) for (const [kk, v] of buckets) if (v.reset < now) buckets.delete(kk);
    return true;
  }
  b.n++;
  return b.n <= limit;
}
