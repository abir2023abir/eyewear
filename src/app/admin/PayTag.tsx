export default function PayTag({ s }: { s: string }) {
  const map: Record<string, string> = { paid: "tag-ok", awaiting_verification: "tag-warn", unpaid: "tag-light", refunded: "tag-bad" };
  const icon: Record<string, string> = { paid: "✓ ", awaiting_verification: "⏳ ", unpaid: "", refunded: "↩ " };
  return <span className={`tag ${map[s] || "tag-light"}`}>{icon[s]}{s.replace(/_/g, " ")}</span>;
}
