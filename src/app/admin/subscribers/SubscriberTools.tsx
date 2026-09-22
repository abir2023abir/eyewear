"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const post = (body: unknown) => fetch("/api/admin/subscribers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function SubscriberTools() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();
  return (
    <form
      className="flex gap-2 max-w-md"
      onSubmit={async (e) => {
        e.preventDefault();
        setErr("");
        const r = await post({ add: email });
        if (!r.ok) return setErr("Enter a valid email");
        setEmail("");
        router.refresh();
      }}
    >
      <input className="input" type="email" placeholder="Add a subscriber manually" value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn btn-outline">Add</button>
      {err && <span className="err self-center">{err}</span>}
    </form>
  );
}

export function RemoveSubscriber({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  return (
    <button
      className="text-xs text-[var(--bad)] font-bold"
      onClick={async () => {
        if (!confirm(`Remove ${email} from the newsletter?`)) return;
        await post({ remove: id });
        router.refresh();
      }}
    >
      Remove
    </button>
  );
}
