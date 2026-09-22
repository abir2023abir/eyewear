"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/components/Providers";

type Msg = { ok: boolean; text: string } | null;

async function call(body: object): Promise<Msg> {
  try {
    const r = await fetch("/api/account/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    return r.ok ? { ok: true, text: j.message } : { ok: false, text: j.error || "Something went wrong" };
  } catch {
    return { ok: false, text: "Network error — please try again." };
  }
}

function Note({ m }: { m: Msg }) {
  if (!m) return null;
  return <p className={`text-sm mt-3 ${m.ok ? "text-[var(--ok)] font-semibold" : "err"}`}>{m.text}</p>;
}

export default function ProfileClient({ name: initial, email, verified }: { name: string; email: string; verified: boolean }) {
  const router = useRouter();
  const { refreshMe } = useStore();
  const [name, setName] = useState(initial);
  const [pw, setPw] = useState({ current: "", next: "", again: "" });
  const [m1, setM1] = useState<Msg>(null);
  const [m2, setM2] = useState<Msg>(null);
  const [m3, setM3] = useState<Msg>(null);
  const [busy, setBusy] = useState("");

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("name");
    const r = await call({ action: "name", name });
    setM1(r);
    setBusy("");
    if (r?.ok) { await refreshMe(); router.refresh(); }
  };
  const savePw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.again) return setM2({ ok: false, text: "The two new passwords don’t match." });
    setBusy("pw");
    const r = await call({ action: "password", current: pw.current, next: pw.next });
    setM2(r);
    setBusy("");
    if (r?.ok) setPw({ current: "", next: "", again: "" });
  };
  const signOutAll = async () => {
    if (!confirm("Sign out on every other phone and computer?")) return;
    setBusy("all");
    setM3(await call({ action: "signout_all" }));
    setBusy("");
  };

  return (
    <div className="grid gap-6">
      <section className="card p-6">
        <h2 className="font-display text-xl font-semibold text-[var(--navy)] mb-4">Your details</h2>
        <form onSubmit={saveName} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <label className="grid content-start gap-1.5 text-sm font-semibold">Full name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required autoComplete="name" />
          </label>
          <label className="grid content-start gap-1.5 text-sm font-semibold">Email
            <input className="input" value={email} disabled />
            <span className={`text-xs font-normal ${verified ? "text-[var(--ok)]" : "muted"}`}>{verified ? "✓ Confirmed" : "Not confirmed yet — check your inbox"}</span>
          </label>
          <div className="sm:col-span-2">
            <button className="btn btn-primary" disabled={busy === "name" || !name.trim() || name === initial}>{busy === "name" ? "Saving…" : "Save name"}</button>
            <Note m={m1} />
          </div>
        </form>
        <p className="muted text-xs mt-4">Need to change your email? Message us in the chat and we’ll move your account.</p>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-xl font-semibold text-[var(--navy)] mb-4">Change password</h2>
        <form onSubmit={savePw} className="grid gap-4 max-w-md">
          <label className="grid content-start gap-1.5 text-sm font-semibold">Current password
            <input className="input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" />
          </label>
          <label className="grid content-start gap-1.5 text-sm font-semibold">New password
            <input className="input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} minLength={8} required autoComplete="new-password" />
            <span className="text-xs font-normal muted">At least 8 characters.</span>
          </label>
          <label className="grid content-start gap-1.5 text-sm font-semibold">Repeat new password
            <input className="input" type="password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} minLength={8} required autoComplete="new-password" />
          </label>
          <div>
            <button className="btn btn-primary" disabled={busy === "pw"}>{busy === "pw" ? "Saving…" : "Change password"}</button>
            <Note m={m2} />
          </div>
        </form>
        <p className="muted text-xs mt-4">Forgot your current password? Sign out and use “Forgot password?” on the sign-in page.</p>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-xl font-semibold text-[var(--navy)] mb-2">Devices</h2>
        <p className="muted text-sm mb-4">Signed in on a shared or lost device? Sign it out from here — you stay signed in on this one.</p>
        <button className="btn btn-outline" onClick={signOutAll} disabled={busy === "all"}>Sign out all other devices</button>
        <Note m={m3} />
      </section>
    </div>
  );
}
