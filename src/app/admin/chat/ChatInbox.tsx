"use client";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageBubble, type ChatMessage } from "@/components/ChatWidget";
import { COUNTRIES } from "@/lib/countries";
import { usd } from "@/lib/money";
import type { ProductDTO } from "@/lib/types";

type Conv = { id: string; name: string; email: string; unread: number; status: string; lastMessageAt: string; last: string };
type QItem = { variantId: string; label: string; qty: number; lensCode: string };
const LENSES = [["none", "Frame only"], ["clear", "Clear"], ["ar", "Anti-reflection"], ["bluecut", "Bluecut + UV"], ["photosun", "Bluecut + Photosun"]];

export default function ChatInbox() {
  const sp = useSearchParams();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(sp.get("c"));
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [showQuote, setShowQuote] = useState(false);
  const last = useRef("");
  const scroller = useRef<HTMLDivElement>(null);

  const load = useCallback(async (reset = false) => {
    if (reset) {
      last.current = "";
      setMsgs([]);
    }
    const qs = new URLSearchParams();
    if (active) qs.set("c", active);
    if (active && last.current) qs.set("after", last.current);
    const j = await fetch(`/api/admin/chat?${qs}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!j) return;
    setConvs(j.conversations || []);
    if (j.messages?.length) {
      setMsgs((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        return [...prev, ...j.messages.filter((m: ChatMessage) => !seen.has(m.id))];
      });
      last.current = j.messages[j.messages.length - 1].createdAt;
    }
  }, [active]);

  useEffect(() => {
    load(true);
    const t = setInterval(() => load(), 3000); // polling also keeps the seller marked "online"
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [msgs]);

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || !active) return;
    const body = text;
    setText("");
    await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send", conversationId: active, body }) });
    load();
  };

  const conv = convs.find((c) => c.id === active);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h1 className="h-section !text-3xl">Chat inbox</h1>
        <span className="chip"><span className="live-dot" /> You appear online while this page is open</span>
      </div>
      <div className="card grid md:grid-cols-[300px_1fr] h-[calc(100vh-170px)] min-h-[520px] overflow-hidden">
        <div className="border-r border-[var(--line)] overflow-y-auto">
          {convs.length === 0 && <p className="p-5 muted text-sm">No conversations yet. Messages from the store chat appear here.</p>}
          {convs.map((c) => (
            <button key={c.id} onClick={() => setActive(c.id)} className={`w-full text-left px-4 py-3 border-b border-[var(--line)] hover:bg-[var(--sky-2)] ${active === c.id ? "bg-[var(--sky)]" : ""}`}>
              <div className="flex justify-between gap-2">
                <b className="truncate text-sm">{c.name || c.email || "Visitor"}</b>
                {c.unread > 0 && <span className="min-w-5 h-5 px-1 grid place-items-center rounded-full bg-[#e11d48] text-white text-[11px] font-bold">{c.unread}</span>}
              </div>
              <div className="text-xs muted truncate">{c.last}</div>
              <div className="text-[10px] muted mt-0.5">{new Date(c.lastMessageAt).toLocaleString()}{c.status === "closed" ? " · closed" : ""}</div>
            </button>
          ))}
        </div>
        <div className="flex flex-col min-w-0">
          {!conv ? (
            <div className="flex-1 grid place-items-center muted">Select a conversation</div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-[var(--line)] flex justify-between items-center gap-3">
                <div>
                  <b>{conv.name || "Visitor"}</b> <span className="muted text-sm">{conv.email || "no email"}</span>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-blue btn-sm" onClick={() => setShowQuote(!showQuote)}>{showQuote ? "Close quote" : "Send quote"}</button>
                  <button className="btn btn-outline btn-sm" onClick={async () => { await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "close", conversationId: conv.id }) }); load(); }}>{conv.status === "closed" ? "Reopen" : "Close"}</button>
                  <button className="btn btn-ghost btn-sm !text-[var(--bad)]" onClick={async () => { if (!confirm("Delete this whole conversation?")) return; await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", conversationId: conv.id }) }); setActive(null); load(true); }}>Delete</button>
                </div>
              </div>
              <div ref={scroller} className="flex-1 overflow-y-auto p-5 grid gap-2.5 content-start bg-[var(--sky-2)]">
                {msgs.map((m) => (
                  <div key={m.id} className={m.sender === "seller" && m.kind === "quote" ? "flex justify-end" : ""}>
                    <MessageBubble m={m} mine={m.sender === "seller"} />
                    <div className={`text-[10px] muted mt-0.5 ${m.sender === "seller" ? "text-right" : ""}`}>{new Date(m.createdAt).toLocaleTimeString()}</div>
                  </div>
                ))}
              </div>
              {showQuote && <QuoteBuilder conversationId={conv.id} onSent={() => { setShowQuote(false); load(); }} />}
              <form onSubmit={send} className="border-t border-[var(--line)] p-3 flex gap-2">
                <textarea
                  className="textarea resize-none"
                  rows={2}
                  placeholder="Reply as the seller… (Enter to send, Shift+Enter for a new line)"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                />
                <button className="btn btn-primary">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function QuoteBuilder({ conversationId, onSent }: { conversationId: string; onSent: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductDTO[]>([]);
  const [items, setItems] = useState<QItem[]>([]);
  const [country, setCountry] = useState("US");
  const [city, setCity] = useState("");
  const [override, setOverride] = useState("");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<{ total: number; shipping: number; bundleDiscount: number; estimate: boolean } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (q.length < 2) return setResults([]);
    const t = setTimeout(() => fetch(`/api/products?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((j) => setResults(j.items || [])), 250);
    return () => clearTimeout(t);
  }, [q]);

  const body = (extra: object) => JSON.stringify({
    action: "quote", conversationId, country, city: city || "Capital", note,
    shippingOverride: override ? Math.round(Number(override) * 100) : null,
    items: items.map(({ variantId, qty, lensCode }) => ({ variantId, qty, lensCode })), ...extra,
  });
  const calc = async () => {
    setErr("");
    const r = await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: body({ preview: true }) });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    setPreview(j);
  };
  const send = async () => {
    const r = await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: body({}) });
    const j = await r.json();
    if (!r.ok) return setErr(j.error);
    onSent();
  };

  return (
    <div className="border-t border-[var(--line)] p-4 grid gap-3 bg-white max-h-[45vh] overflow-y-auto">
      <div className="font-bold text-sm">Quote card: products + DHL shipping + total, with a Pay Now button</div>
      <input className="input !py-2" placeholder="Search a frame by name or model…" value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {results.flatMap((p) => p.variants.map((v) => (
            <button key={v.id} className="chip hover:border-[var(--blue)]" onClick={() => { setItems([...items, { variantId: v.id, label: `${p.name} ${p.modelCode} · ${v.colorName} (${usd(p.price)}, stock ${v.stock})`, qty: 1, lensCode: "none" }]); setPreview(null); }}>
              <span className="w-3.5 h-3.5 rounded-full" style={{ background: v.colorHex }} /> {p.name} {p.modelCode} · {v.colorName}
            </button>
          )))}
        </div>
      )}
      {items.map((it, i) => (
        <div key={i} className="flex flex-wrap gap-2 items-center text-sm">
          <span className="flex-1 min-w-[200px]">{it.label}</span>
          <input type="number" min={1} max={20} className="input !py-1.5 !w-20" value={it.qty} onChange={(e) => { setItems(items.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x))); setPreview(null); }} />
          <select className="select !py-1.5 !w-48" value={it.lensCode} onChange={(e) => { setItems(items.map((x, j) => (j === i ? { ...x, lensCode: e.target.value } : x))); setPreview(null); }}>
            {LENSES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
          </select>
          <button className="text-[var(--bad)] text-xs font-bold" onClick={() => { setItems(items.filter((_, j) => j !== i)); setPreview(null); }}>Remove</button>
        </div>
      ))}
      <div className="grid sm:grid-cols-3 gap-2">
        <select className="select !py-2" value={country} onChange={(e) => { setCountry(e.target.value); setPreview(null); }}>
          {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
        <input className="input !py-2" placeholder="City (for DHL rate)" value={city} onChange={(e) => { setCity(e.target.value); setPreview(null); }} />
        <input className="input !py-2" placeholder="Shipping override US$ (optional)" value={override} onChange={(e) => { setOverride(e.target.value.replace(/[^0-9.]/g, "")); setPreview(null); }} />
      </div>
      <input className="input !py-2" placeholder="Note to customer (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      {preview && (
        <div className="text-sm bg-[var(--sky)] rounded-xl p-3">
          {preview.bundleDiscount > 0 && <>Bundle saving −{usd(preview.bundleDiscount)} · </>}DHL {usd(preview.shipping)}{preview.estimate ? " (estimate)" : " (live)"} · <b>Total {usd(preview.total)}</b>
        </div>
      )}
      {err && <p className="err">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-outline btn-sm" disabled={!items.length} onClick={calc}>Calculate total</button>
        <button className="btn btn-primary btn-sm" disabled={!preview} onClick={send}>Send quote card</button>
      </div>
    </div>
  );
}
