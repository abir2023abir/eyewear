"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/Providers";

async function post(url: string, body: object) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, j: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, j: { error: "Network error — please try again." } };
  }
}

function Shell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="container-x py-16 grid place-items-center">
      <div className="card p-8 w-full max-w-md grid gap-4">
        <div>
          <h1 className="h-section !text-3xl">{title}</h1>
          {sub && <p className="muted mt-1 text-sm">{sub}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function ForgotForm() {
  const sp = useSearchParams();
  const [email, setEmail] = useState(sp.get("email") || "");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await post("/api/auth/forgot", { email });
    setBusy(false);
    if (!r.ok) return setErr(r.j.error || "Something went wrong");
    setSent(true);
  };
  if (sent)
    return (
      <Shell title="Check your inbox" sub={`If an account exists for ${email}, we’ve sent a link to choose a new password. It works for 1 hour.`}>
        <p className="text-sm muted">No email after a few minutes? Check spam, or message us in the chat.</p>
        <Link href="/login" className="btn btn-outline">Back to sign in</Link>
      </Shell>
    );
  return (
    <Shell title="Forgot your password?" sub="Enter your email and we’ll send you a link to choose a new one.">
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
        <p className="text-sm text-center muted">Remembered it? <Link href="/login" className="text-[var(--blue)] font-bold">Sign in</Link></p>
      </form>
    </Shell>
  );
}

export function ResetForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const { refreshMe } = useStore();
  const token = sp.get("token") || "";
  const [pw, setPw] = useState({ a: "", b: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.a !== pw.b) return setErr("The two passwords don’t match.");
    setBusy(true);
    setErr("");
    const r = await post("/api/auth/reset", { token, password: pw.a });
    setBusy(false);
    if (!r.ok) return setErr(r.j.error || "Something went wrong");
    await refreshMe();
    router.push(r.j.role === "admin" ? "/admin" : "/account");
    router.refresh();
  };
  if (!token)
    return (
      <Shell title="Link incomplete" sub="This reset link is missing its code. Please open the link from the email again, or request a new one.">
        <Link href="/forgot-password" className="btn btn-primary">Request a new link</Link>
      </Shell>
    );
  return (
    <Shell title="Choose a new password" sub="You’ll be signed in straight after.">
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label className="label">New password</label>
          <input className="input" type="password" required minLength={8} value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} autoComplete="new-password" />
          <p className="text-xs muted mt-1">At least 8 characters.</p>
        </div>
        <div>
          <label className="label">Repeat new password</label>
          <input className="input" type="password" required minLength={8} value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} autoComplete="new-password" />
        </div>
        {err && (
          <p className="err">
            {err} {/expired|used/.test(err) && <Link href="/forgot-password" className="font-bold underline">Get a new link</Link>}
          </p>
        )}
        <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "Saving…" : "Save password & sign in"}</button>
      </form>
    </Shell>
  );
}

export function VerifyEmail() {
  const sp = useSearchParams();
  const router = useRouter();
  const token = sp.get("token") || "";
  const [state, setState] = useState<"working" | "ok" | "bad">(token ? "working" : "bad");
  const [linked, setLinked] = useState(0);
  const ran = useRef(false);
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true; // tokens are single-use: don't send twice in dev strict mode
    post("/api/auth/verify", { token }).then((r) => {
      setState(r.ok ? "ok" : "bad");
      setLinked(r.j.linked || 0);
      if (r.ok) router.refresh();
    });
  }, [token, router]);
  if (state === "working") return <Shell title="Confirming your email…"><p className="muted">One moment.</p></Shell>;
  if (state === "ok")
    return (
      <Shell title="Email confirmed ✓" sub={linked ? `We also added ${linked} earlier order${linked > 1 ? "s" : ""} placed with this email to your account.` : "Thanks — your account is all set."}>
        <Link href="/account" className="btn btn-primary">Go to my account</Link>
      </Shell>
    );
  return (
    <Shell title="Link expired" sub="This confirmation link has expired or was already used. Sign in and use “Resend link” on your account page.">
      <Link href="/account" className="btn btn-primary">Go to my account</Link>
    </Shell>
  );
}
