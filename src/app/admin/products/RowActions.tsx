"use client";
import { useRouter } from "next/navigation";

export default function RowActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const act = async (action: "duplicate" | "delete") => {
    if (action === "delete" && !confirm(`Permanently delete “${name}”? Past orders keep their details. (To just hide it, open the frame and click Archive.)`)) return;
    const r = await fetch(`/api/admin/products/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "delete" ? { action, confirm: "DELETE" } : { action }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return alert(j.error || "Failed");
    if (action === "duplicate") router.push(`/admin/products/${j.id}`);
    else router.refresh();
  };
  return (
    <div className="flex gap-3 text-xs font-bold whitespace-nowrap">
      <button className="text-[var(--blue)]" onClick={() => act("duplicate")}>Duplicate</button>
      <button className="text-[var(--bad)]" onClick={() => act("delete")}>Delete</button>
    </div>
  );
}
