"use client";
import { useEffect } from "react";
import Icon from "./Icon";

/** Opens the chat checkout; with autoOpen it opens once when the page loads (after "Confirm order"). */
export default function OpenChatButton({ autoOpen, label = "Continue in chat" }: { autoOpen?: boolean; label?: string }) {
  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => window.dispatchEvent(new CustomEvent("open-chat", { detail: { checkout: true } })), 400);
    return () => clearTimeout(t);
  }, [autoOpen]);
  return (
    <button className="btn btn-primary" onClick={() => window.dispatchEvent(new CustomEvent("open-chat", { detail: { checkout: true } }))}>
      <Icon name="chat" size={16} /> {label}
    </button>
  );
}
