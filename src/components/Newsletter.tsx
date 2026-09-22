"use client";
import { useState } from "react";

export default function Newsletter({ dark }: { dark?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    const r = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setState(r.ok ? "ok" : "err");
    if (r.ok) {
      setEmail("");
      (window as any).gtag?.("event", "sign_up", { method: "newsletter" });
    }
  };
  if (state === "ok") return <p className={dark ? "text-white text-sm" : "text-[var(--ok)] font-semibold"}>You’re in — watch your inbox for new drops.</p>;
  return (
    <form onSubmit={submit} className="flex gap-2 max-w-md">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        aria-label="Email address"
        className={dark ? "input !bg-white/10 !border-white/20 !text-white placeholder:text-white/50" : "input"}
      />
      <button className={dark ? "btn btn-blue" : "btn btn-primary"} disabled={state === "busy"}>Subscribe</button>
      {state === "err" && <span className="err self-center">Try again</span>}
    </form>
  );
}
