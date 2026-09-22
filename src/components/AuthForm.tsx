"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useStore } from "./Providers";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const sp = useSearchParams();
  const router = useRouter();
  const { refreshMe } = useStore();
  const [form, setForm] = useState({ name: "", email: sp.get("email") || "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const rawNext = sp.get("next") || "";
  // only allow same-site relative redirects
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const r = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error || "Something went wrong");
    await refreshMe();
    router.push(next || (j.role === "admin" ? "/admin" : "/account"));
    router.refresh();
  };

  return (
    <div className="container-x py-16 grid place-items-center">
      <form onSubmit={submit} className="card p-8 w-full max-w-md grid gap-4">
        <div>
          <h1 className="h-section !text-3xl">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p className="muted mt-1 text-sm">{mode === "login" ? "Track orders, reuse prescriptions and addresses." : "Save prescriptions, addresses and your wishlist."}</p>
        </div>
        {mode === "register" && (
          <div>
            <label className="label">Full name</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
        </div>
        <div>
          <div className="flex justify-between items-baseline">
            <label className="label">Password</label>
            {mode === "login" && <Link href={`/forgot-password${form.email ? `?email=${encodeURIComponent(form.email)}` : ""}`} className="text-xs font-bold text-[var(--blue)]">Forgot password?</Link>}
          </div>
          <input className="input" type="password" required minLength={mode === "register" ? 8 : 1} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
        <p className="text-sm text-center muted">
          {mode === "login" ? (
            <>New here? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-[var(--blue)] font-bold">Create an account</Link></>
          ) : (
            <>Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-[var(--blue)] font-bold">Sign in</Link></>
          )}
        </p>
      </form>
    </div>
  );
}
