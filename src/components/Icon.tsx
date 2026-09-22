const P: Record<string, string> = {
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  cart: "M3 4h2l2.4 11h11.2L21 7H6.2M9 20a1 1 0 1 0 0-.01M18 20a1 1 0 1 0 0-.01",
  heart: "M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5c-2.2 4.6-9.2 9-9.2 9Z",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z",
  chat: "M4 5h16v11H8l-4 4V5Z",
  x: "M6 6l12 12M18 6 6 18",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  upload: "M12 16V4m0 0-4 4m4-4 4 4M4 16v4h16v-4",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  check: "M5 12.5 10 17 19 7",
  truck: "M3 6h11v10H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-.01M17 19a2 2 0 1 0 0-.01",
  shield: "M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3Z",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z",
  glasses: "M2 13a4 4 0 1 0 8 0 4 4 0 0 0-8 0Zm12 0a4 4 0 1 0 8 0 4 4 0 0 0-8 0Zm-4 0c1.3-1 2.7-1 4 0M2 12l2-5h3m15 5-2-5h-3",
  sparkle: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
  tag: "M3 12V3h9l9 9-9 9-9-9Zm5-4a1 1 0 1 0 0-.01",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  menu: "M4 7h16M4 12h16M4 17h16",
  attach: "M16 7l-7.5 7.5a2.1 2.1 0 0 0 3 3L19 10a4.2 4.2 0 0 0-6-6l-8 8a6.4 6.4 0 0 0 9 9l6-6",
  send: "M4 12 20 4l-6 16-3-7-7-1Z",
  share: "M8 12h.01M16 6h.01M16 18h.01M9 11l6-4m-6 6 6 4",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  cube: "M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 0v18M4 7.5l8 4.5 8-4.5",
  lock: "M6 11h12v10H6V11Zm2 0V8a4 4 0 0 1 8 0v3",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  ruler: "M3 17 17 3l4 4L7 21l-4-4Zm4-4 2 2m1-5 2 2m1-5 2 2",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  box: "M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Zm0 0L12 12l9-4.5M12 12v9",
  inbox: "M4 13h4l1.5 3h5L16 13h4M4 13l2.5-8h11L20 13v6H4v-6Z",
  doc: "M7 3h7l5 5v13H7V3Zm7 0v5h5M10 13h6M10 17h6",
  mail: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  store: "M4 9h16l-1.5-5h-13L4 9Zm0 0v11h16V9M9 20v-6h6v6",
  lens: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5a4 4 0 1 0 0-8",
};

export default function Icon({ name, size = 18, className, stroke = 1.8 }: { name: keyof typeof P | string; size?: number; className?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={P[name] || ""} />
    </svg>
  );
}

export function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.3-.5 0-1 .2-3.3-.7-2.8-1.1-4.5-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.3.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.6-.3.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.1.1.7-.1 1.3Z" />
    </svg>
  );
}
export function MessengerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.4 2 2 6.1 2 11.5c0 2.9 1.3 5.4 3.4 7.2V22l3.1-1.7c1.1.3 2.3.5 3.5.5 5.6 0 10-4.1 10-9.4S17.6 2 12 2Zm1 12.6-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 5-2.7-5.5 5.8Z" />
    </svg>
  );
}
