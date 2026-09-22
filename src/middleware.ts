import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * 1. Blocks cross-site form/fetch posts to our API (CSRF defence in depth — cookies are also SameSite=Lax).
 *    Requests without an Origin header (PayPal webhooks, server-to-server) are allowed.
 * 2. Gates /admin and /account pages. Every API route re-checks the session against the database itself.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/") && UNSAFE.has(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
      let ok = false;
      try {
        ok = new URL(origin).host === host;
      } catch {}
      if (!ok) return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
    }
  }

  const needsRole = pathname.startsWith("/admin") || pathname.startsWith("/api/admin") || pathname.startsWith("/account");
  if (!needsRole) return NextResponse.next();

  const token = req.cookies.get("session")?.value;
  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      role = String(payload.role);
    } catch {}
  }
  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (isAdminArea && role !== "admin") {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, req.url));
  }
  if (pathname.startsWith("/account") && !role) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/account/:path*", "/api/:path*"] };
