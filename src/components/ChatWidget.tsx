"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Icon, { MessengerIcon, WhatsAppIcon } from "./Icon";
import { useSite, useStore, useViewingProduct } from "./Providers";
import { ChatActions, OrderCard, PaymentCard, ShippingCard, ThanksCard } from "./ChatCards";
import { usd } from "@/lib/money";
import { telHref, waLink } from "@/lib/settings-shared";

export type ChatMessage = {
  id: string;
  sender: "customer" | "seller" | "system" | "assistant";
  kind: "text" | "product" | "quote" | "order" | "shipping" | "payment" | "thanks";
  body: string;
  payload: any;
  createdAt: string;
  updatedAt?: string;
};

const QUICK: [string, string][] = [
  ["delivery", "How long is delivery?"],
  ["customs", "Customs & import duty"],
  ["payment", "Payment methods"],
  ["human", "Talk to a person"],
];

export function MessageBubble({ m, mine, assistantName = "Order assistant" }: { m: ChatMessage; mine: boolean; assistantName?: string }) {
  const p = m.payload;
  if (m.kind === "order" && p) return <div className="ml-6"><OrderCard p={p} /></div>;
  if (m.kind === "shipping" && p) return <Assistant name={assistantName} body={m.body}><ShippingCard p={p} /></Assistant>;
  if (m.kind === "payment" && p) return <Assistant name={assistantName}><PaymentCard p={p} body={m.body} /></Assistant>;
  if (m.kind === "thanks" && p) return <Assistant name={assistantName}><ThanksCard p={p} body={m.body} /></Assistant>;
  if (m.kind === "product" && p) {
    return (
      <div className={`bubble ${mine ? "me" : "them"} !p-0 overflow-hidden`}>
        <Link href={`/product/${p.slug}`} className="flex gap-3 items-center p-3" target="_blank">
          <span className="w-10 h-10 rounded-full border-2 border-white shrink-0" style={{ background: p.colorHex }} />
          <span>
            <span className="block text-[11px] opacity-80 font-bold uppercase tracking-wider">Asking about</span>
            <span className="block font-bold">{p.name}</span>
            <span className="block text-[12.5px] opacity-90">{p.colorName} · {usd(p.price)}</span>
          </span>
        </Link>
        {m.body && <div className="px-3 pb-3">{m.body}</div>}
      </div>
    );
  }
  if (m.kind === "quote" && p) {
    return (
      <div className="w-[88%] rounded-2xl border-2 border-[var(--blue)] bg-white overflow-hidden text-sm">
        <div className="bg-[var(--blue)] text-white px-4 py-2.5 font-bold flex items-center gap-2"><Icon name="tag" size={16} /> Your quote</div>
        <div className="p-4 grid gap-1.5">
          {p.lines?.map((l: any, i: number) => (
            <div key={i} className="flex justify-between gap-3">
              <span>{l.qty}× {l.name} <span className="muted">({l.colorName}{l.lensName && l.lensName !== "Frame only" ? `, ${l.lensName}` : ""})</span></span>
              <span className="font-semibold">{usd(l.total)}</span>
            </div>
          ))}
          {p.bundleDiscount > 0 && <div className="flex justify-between text-[var(--ok)]"><span>Bundle saving</span><span>−{usd(p.bundleDiscount)}</span></div>}
          <div className="flex justify-between"><span>DHL Express to {p.countryName}</span><span className="font-semibold">{usd(p.shipping)}</span></div>
          <div className="flex justify-between border-t border-[var(--line)] pt-2 mt-1 text-base"><b>Total</b><b>{usd(p.total)}</b></div>
          {m.body && <p className="muted mt-1">{m.body}</p>}
          {p.status === "paid" ? <div className="tag tag-ok mt-2 text-center">Paid</div> : <Link href={`/checkout?quote=${p.token}`} className="btn btn-primary w-full mt-2">Pay now <Icon name="arrow" size={15} /></Link>}
        </div>
      </div>
    );
  }
  if (m.sender === "system") return <div className="text-center text-xs muted py-1">{m.body}</div>;
  if (m.sender === "assistant") return <Assistant name={assistantName} body={m.body} />;
  return <div className={`bubble ${mine ? "me" : "them"}`}>{m.body}</div>;
}

function Assistant({ name, body, children }: { name: string; body?: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-2 items-start">
      <span className="w-7 h-7 rounded-full grid place-items-center text-white shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,var(--blue),var(--navy))" }}><Icon name="glasses" size={15} /></span>
      <div className="flex-1 min-w-0 grid gap-1.5">
        <div className="text-[11px] font-bold text-[var(--navy)]">{name}</div>
        {body && <div className="bubble them !max-w-full">{body}</div>}
        {children}
      </div>
    </div>
  );
}

export default function ChatWidget() {
  const pathname = usePathname();
  const { me } = useStore();
  const { store } = useSite();
  const viewing = useViewingProduct();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [online, setOnline] = useState(false);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState("");
  const [attach, setAttach] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [hasProfile, setHasProfile] = useState(false);
  const [sending, setSending] = useState(false);
  const [assistantName, setAssistantName] = useState("Order assistant");
  const last = useRef<string>("");
  const since = useRef<string>("");
  const scroller = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/chat?after=${encodeURIComponent(last.current)}&since=${encodeURIComponent(since.current)}&open=${open ? 1 : 0}`, { cache: "no-store" });
      const j = await r.json();
      setOnline(!!j.online);
      setUnread(j.unread || 0);
      if (j.assistantName) setAssistantName(j.assistantName);
      if (j.profile?.email) setHasProfile(true);
      if (j.now) since.current = j.now;
      if (j.updates?.length) {
        const upd = new Map<string, ChatMessage>(j.updates.map((m: ChatMessage) => [m.id, m]));
        setMsgs((prev) => prev.map((m) => upd.get(m.id) ?? m));
      }
      if (j.messages?.length) {
        setMsgs((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...j.messages.filter((m: ChatMessage) => !seen.has(m.id))];
        });
        last.current = j.messages[j.messages.length - 1].createdAt;
      }
    } catch {}
  }, [open]);

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    poll();
    const t = setInterval(poll, open ? 3000 : 15000);
    return () => clearInterval(t);
  }, [poll, open, pathname]);

  useEffect(() => {
    if (msgs.length !== count.current) scroller.current?.scrollTo({ top: 1e9, behavior: "smooth" });
    count.current = msgs.length;
  }, [msgs, open]);

  useEffect(() => {
    if (me) setProfile((p) => ({ name: p.name || me.name, email: p.email || me.email }));
  }, [me]);

  useEffect(() => {
    // other components open the chat: "Ask the seller" (attach product) or checkout (order flow)
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (d.reload) {
        // switched to another of the customer's conversations — load it from the start
        last.current = "";
        since.current = "";
        setMsgs([]);
      }
      setOpen(true);
      setAttach(!d.checkout);
      if (d.checkout) setHasProfile(true);
      setTimeout(poll, 150);
    };
    window.addEventListener("open-chat", h);
    return () => window.removeEventListener("open-chat", h);
  }, [poll]);

  const actions = useMemo(() => ({ refresh: () => poll(), interactive: true }), [poll]);

  if (pathname.startsWith("/admin") || pathname.startsWith("/try-on")) return null;

  const send = async (e?: React.FormEvent, quick?: string) => {
    e?.preventDefault();
    if (!quick && !text.trim() && !(attach && viewing)) return;
    if (!quick && !online && !hasProfile && !profile.email) return;
    setSending(true);
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quick ? { quick, name: profile.name, email: profile.email } : { body: text.trim(), product: attach && viewing ? viewing : undefined, name: profile.name, email: profile.email }),
    });
    setSending(false);
    if (r.ok) {
      if (!quick) {
        setText("");
        setAttach(false);
      }
      setHasProfile(!!profile.email || hasProfile);
      poll();
    }
  };

  const wa = store.whatsapp ? waLink(store.whatsapp, viewing ? `Hello, I'm interested in ${viewing.name} (${viewing.colorName}).` : "Hello, I have a question about your frames.") : null;
  const needsEmail = !online && !hasProfile;

  return (
    <>
      {!open && (
        <div className="float-stack">
          {store.phone && <a href={telHref(store.phone)} className="float-btn bg-[var(--ink)]"><Icon name="phone" size={16} /> Call</a>}
          {wa && <a href={wa} target="_blank" rel="noopener" className="float-btn bg-[#25D366]"><WhatsAppIcon /> WhatsApp</a>}
          {store.messenger && <a href={`https://m.me/${encodeURIComponent(store.messenger)}`} target="_blank" rel="noopener" className="float-btn bg-[#0a7cff]"><MessengerIcon /> Messenger</a>}
          <button onClick={() => setOpen(true)} className="float-btn bg-[var(--blue)] relative">
            <Icon name="chat" size={16} /> Chat with us
            {unread > 0 && <span className="icon-badge !bg-[#e11d48]">{unread}</span>}
          </button>
        </div>
      )}
      {open && (
        <div className="chat-panel" role="dialog" aria-label="Chat with our team">
          <div className="px-5 py-4 text-white flex items-center gap-3" style={{ background: "linear-gradient(135deg,var(--blue),var(--navy))" }}>
            <div className="w-10 h-10 rounded-full bg-white/15 grid place-items-center"><Icon name="user" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-bold truncate">{store.name}</div>
              <div className="text-xs text-white/80 flex items-center gap-1.5">
                {online ? <><span className="live-dot" /> Our team is online</> : "Order assistant · team replies by email"}
              </div>
            </div>
            {wa && <a href={wa} target="_blank" rel="noopener" aria-label="WhatsApp" className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"><WhatsAppIcon size={17} /></a>}
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/10"><Icon name="x" /></button>
          </div>

          <ChatActions.Provider value={actions}>
            <div ref={scroller} className="flex-1 overflow-y-auto p-4 grid gap-3 content-start bg-[var(--sky-2)]">
              <Assistant name={assistantName} body="Hi! 👋 Welcome — ask about sizing, delivery or payment. Our team in Wenzhou replies personally, and I’ll guide you through checkout." />
              {msgs.map((m) => <MessageBubble key={m.id} m={m} mine={m.sender === "customer"} assistantName={assistantName} />)}
              {!online && msgs.some((m) => m.sender === "customer" && m.kind === "text") && (
                <div className="text-center text-xs muted">Our team has been notified and will reply here and by email.</div>
              )}
            </div>
          </ChatActions.Provider>

          <form onSubmit={send} className="border-t border-[var(--line)] p-3 grid gap-2 bg-white">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
              {QUICK.map(([k, l]) => (
                <button key={k} type="button" disabled={sending} onClick={() => send(undefined, k)} className="chip !py-1 !text-[12px] whitespace-nowrap hover:!border-[var(--blue)] hover:!text-[var(--blue)]">{l}</button>
              ))}
            </div>
            {needsEmail && (
              <div className="grid grid-cols-2 gap-2">
                <input className="input !py-2" placeholder="Your name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
                <input className="input !py-2" type="email" placeholder="Email for reply" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
              </div>
            )}
            {viewing && (
              <label className={`check !py-2 text-[13px] ${attach ? "on" : ""}`}>
                <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} className="mt-0.5" />
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full" style={{ background: viewing.colorHex }} />
                  Attach <b>{viewing.name}</b> ({viewing.colorName})
                </span>
              </label>
            )}
            <div className="flex gap-2">
              <textarea
                className="textarea !py-2 resize-none"
                rows={1}
                placeholder="Type your message…"
                value={text}
                maxLength={2000}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <button className="btn btn-blue !px-4" disabled={sending} aria-label="Send"><Icon name="send" /></button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
