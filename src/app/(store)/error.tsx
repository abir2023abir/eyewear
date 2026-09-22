"use client";
import Link from "next/link";
import { useEffect } from "react";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-x py-24 text-center">
      <div className="eyebrow">Something went wrong</div>
      <h1 className="h-section mt-2">Sorry — this page didn’t load properly.</h1>
      <p className="lead mt-3">Your bag is safe. Please try again, or contact us if it keeps happening.</p>
      <div className="flex justify-center gap-3 mt-8">
        <button className="btn btn-primary" onClick={reset}>Try again</button>
        <Link href="/" className="btn btn-outline">Home</Link>
      </div>
      {error.digest && <p className="text-xs muted mt-6">Reference: {error.digest}</p>}
    </div>
  );
}
