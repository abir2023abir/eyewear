// The key that signs login cookies. In production it MUST be a long random value: if it were missing
// or left as the example text, anyone could forge an admin login. Used by lib/auth.ts and middleware.ts.

const EXAMPLES = new Set(["", "change-me-to-a-long-random-string", "dev-secret-change-me", "changeme", "secret"]);

export function authSecretProblem(): string | null {
  const s = process.env.AUTH_SECRET || "";
  if (process.env.NODE_ENV !== "production") return null;
  if (EXAMPLES.has(s)) return "AUTH_SECRET is not set";
  if (s.length < 32) return "AUTH_SECRET is too short (use at least 32 random characters)";
  return null;
}

/** Signing key; throws in production when AUTH_SECRET is unsafe, so no login can be created or accepted. */
export function authKey(): Uint8Array {
  const problem = authSecretProblem();
  if (problem) throw new Error(`${problem}. Set it in your hosting environment variables and redeploy.`);
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
}
