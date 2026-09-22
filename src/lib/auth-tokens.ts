import "server-only";
import { createHash, randomBytes } from "crypto";
import type { User } from "@prisma/client";
import { db } from "./db";
import { esc, layout, sendMail } from "./mail";
import { site } from "./site";
import { getSettings } from "./settings";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
const TTL = { reset: 60 * 60_000, verify: 7 * 24 * 60 * 60_000 } as const;
type Purpose = keyof typeof TTL;

async function createToken(userId: string, purpose: Purpose) {
  // one live link per purpose — older ones stop working
  await db.authToken.deleteMany({ where: { userId, purpose, usedAt: null } });
  const raw = randomBytes(32).toString("hex");
  await db.authToken.create({ data: { userId, purpose, tokenHash: hash(raw), expiresAt: new Date(Date.now() + TTL[purpose]) } });
  return raw;
}

/** Returns the user if the link is valid (right purpose, unused, not expired) and marks it used. */
export async function consumeToken(raw: string, purpose: Purpose) {
  if (!/^[a-f0-9]{64}$/.test(raw)) return null;
  const t = await db.authToken.findUnique({ where: { tokenHash: hash(raw) }, include: { user: true } });
  if (!t || t.purpose !== purpose || t.usedAt || t.expiresAt < new Date()) return null;
  const used = await db.authToken.updateMany({ where: { id: t.id, usedAt: null }, data: { usedAt: new Date() } });
  return used.count ? t.user : null;
}

/** Once the customer has proven they own the email, earlier guest orders with that email join their account. */
export async function linkGuestOrders(user: Pick<User, "id" | "email">) {
  const r = await db.order.updateMany({ where: { email: user.email, userId: null }, data: { userId: user.id } });
  return r.count;
}

export async function sendPasswordReset(user: User) {
  const raw = await createToken(user.id, "reset");
  const { store } = await getSettings();
  const link = `${site.url}/reset-password?token=${raw}`;
  return sendMail(user.email, `Reset your ${store.name} password`, await layout("Reset your password", `<p>Hi ${esc(user.name.split(" ")[0])},</p><p>We received a request to reset the password for your account. This link works for 1 hour.</p><p style="margin:24px 0"><a href="${esc(link)}" style="background:#1d5bd8;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Choose a new password</a></p><p style="font-size:12px;color:#5a6b8c">If you didn’t ask for this, you can ignore this email — your password won’t change.</p>`));
}

export async function sendVerifyEmail(user: User) {
  const raw = await createToken(user.id, "verify");
  const { store } = await getSettings();
  const link = `${site.url}/verify-email?token=${raw}`;
  return sendMail(user.email, `Welcome to ${store.name} — please confirm your email`, await layout(`Welcome, ${user.name.split(" ")[0]}!`, `<p>Thanks for creating your account. Please confirm your email address — this also adds any earlier orders you placed with this email to your account.</p><p style="margin:24px 0"><a href="${esc(link)}" style="background:#1d5bd8;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Confirm my email</a></p><p>In your account you can track orders, download invoices, save addresses and prescriptions, and keep a wishlist.</p>`));
}
