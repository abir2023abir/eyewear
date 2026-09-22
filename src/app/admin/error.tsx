"use client";
import { useEffect } from "react";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="card p-8 max-w-xl">
      <h1 className="h-section !text-2xl">This admin page hit an error</h1>
      <p className="muted mt-2 text-sm">Nothing was lost. Try again — if it keeps happening, note the reference below and check the server log.</p>
      {error.digest && <p className="text-xs muted mt-3">Reference: {error.digest}</p>}
      <button className="btn btn-primary mt-5" onClick={reset}>Try again</button>
    </div>
  );
}
