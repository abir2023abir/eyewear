"use client";
import { useState } from "react";

/** Inline stock editor: saves when the field loses focus or Enter is pressed. */
export default function StockCell({ productId, variantId, colorName, colorHex, stock }: { productId: string; variantId: string; colorName: string; colorHex: string; stock: number }) {
  const [v, setV] = useState(String(stock));
  const [state, setState] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const save = async () => {
    const n = Math.max(0, parseInt(v) || 0);
    if (n === stock && state !== "err") return;
    setState("saving");
    const r = await fetch(`/api/admin/products/${productId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stock", variantId, stock: n }) });
    setState(r.ok ? "ok" : "err");
    setV(String(n));
    setTimeout(() => setState("idle"), 1200);
  };
  return (
    <label title={colorName} className={`inline-flex items-center gap-1 text-xs border rounded-full pl-0.5 pr-1 py-0.5 ${state === "ok" ? "border-[var(--ok)]" : state === "err" ? "border-[var(--bad)]" : parseInt(v) === 0 ? "border-[#fca5a5]" : "border-[var(--line)]"}`}>
      <span className="w-4 h-4 rounded-full shrink-0" style={{ background: colorHex }} />
      <input
        aria-label={`${colorName} stock`}
        className="w-10 bg-transparent text-center outline-none"
        inputMode="numeric"
        value={v}
        onChange={(e) => setV(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}
