"use client";
import { useState } from "react";
import Icon from "@/components/Icon";

/** Switches the chat widget to one of the customer's own conversations, then opens it. */
export default function ResumeChat({ conversationId, label }: { conversationId?: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    setBusy(true);
    if (conversationId) {
      await fetch("/api/account/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId }) }).catch(() => {});
    }
    setBusy(false);
    window.dispatchEvent(new CustomEvent("open-chat", { detail: { checkout: true, reload: true } }));
  };
  return (
    <button className={`btn btn-sm ${conversationId ? "btn-outline" : "btn-primary"}`} onClick={open} disabled={busy}>
      <Icon name="chat" size={14} /> {label}
    </button>
  );
}
