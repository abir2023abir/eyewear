import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import ResumeChat from "./ResumeChat";

export const dynamic = "force-dynamic";

const PREVIEW: Record<string, string> = {
  order: "Order summary", shipping: "Delivery details", payment: "Payment options", thanks: "Payment received", product: "Product", quote: "Price quote",
};

export default async function AccountMessages() {
  const s = await getSession();
  if (!s) redirect("/login?next=/account/messages");
  const convs = await db.conversation.findMany({
    where: { userId: s.uid },
    orderBy: { lastMessageAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { messages: true } } },
  });
  const orders = await db.order.findMany({ where: { userId: s.uid, conversationId: { in: convs.map((c) => c.id) } }, select: { number: true, conversationId: true } });

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold text-[var(--navy)]">Messages</h2>
        <ResumeChat label="New message" />
      </div>
      {convs.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="muted">No conversations yet. Ask us anything about frames, lenses, sizing or delivery — a real person replies.</p>
        </div>
      ) : (
        convs.map((c) => {
          const m = c.messages[0];
          const nums = orders.filter((o) => o.conversationId === c.id).map((o) => o.number);
          const preview = m ? (m.kind === "text" ? m.body : PREVIEW[m.kind] || m.body) : "";
          return (
            <article key={c.id} className="card p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <b>{nums.length ? `Order ${nums.join(", ")}` : "General question"}</b>
                  {c.unreadForCustomer > 0 && <span className="tag tag-light !text-[10px]">{c.unreadForCustomer} new</span>}
                </div>
                <p className="muted text-sm truncate mt-1">
                  {m ? `${m.sender === "customer" ? "You: " : ""}${preview}` : "No messages"}
                </p>
                <p className="muted text-xs mt-1">{c._count.messages} messages · last {c.lastMessageAt.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <ResumeChat conversationId={c.id} label="Open chat" />
            </article>
          );
        })
      )}
    </section>
  );
}
