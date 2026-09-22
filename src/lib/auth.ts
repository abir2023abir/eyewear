import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { db } from "./db";

const COOKIE = "session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");

export type Session = { uid: string; role: string; name: string; email: string };

export async function createSession(user: { id: string; role: string; name: string; email: string; tokenVersion?: number }) {
  const token = await new SignJWT({ role: user.role, name: user.name, email: user.email, v: user.tokenVersion ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !/^http:\/\/localhost/.test(process.env.NEXT_PUBLIC_SITE_URL || ""),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Verifies the token AND the account: deleted users, demoted admins and reset passwords lose access immediately. */
export async function verifyToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await db.user.findUnique({ where: { id: String(payload.sub) }, select: { id: true, role: true, name: true, email: true, tokenVersion: true } });
    if (!user || user.tokenVersion !== Number(payload.v ?? 0)) return null;
    return { uid: user.id, role: user.role, name: user.name, email: user.email };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  return verifyToken((await cookies()).get(COOKIE)?.value);
}

export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (!s || s.role !== "admin") throw new Error("Unauthorized");
  return s;
}

export const hashPassword = (p: string) => bcrypt.hash(p, 11);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);
