"use client";

export default function PrintButton() {
  return (
    <button className="btn btn-primary mt-8 print:hidden" onClick={() => window.print()}>
      Print
    </button>
  );
}
