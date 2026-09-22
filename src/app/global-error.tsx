"use client";

/** Last-resort error screen (if even the root layout fails). Plain styles so it can't fail itself. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f3f7ff", color: "#0b1b3f" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>We’ll be right back.</h1>
          <p style={{ color: "#5b6b8a" }}>The shop hit an unexpected error. Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, background: "#0a2463", color: "#fff", border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
