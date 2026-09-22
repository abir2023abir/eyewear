"use client";
import { useState } from "react";
import { usd } from "@/lib/money";

/** Single-series daily revenue bars: 4px rounded tops, 2px gaps, recessive grid, hover tooltip, table view. */
export default function RevenueChart({ data }: { data: { date: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 900, H = 240, padL = 56, padB = 28, padT = 12;
  const max = Math.max(...data.map((d) => d.value), 1);
  const nice = niceMax(max);
  const bw = (W - padL) / data.length;
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  const fmt = (d: string) => new Date(d + "T00:00:00Z").toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="relative mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Daily revenue, last 30 days">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#e6edf8" strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#5b6b8a">{usd(Math.round(t))}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * bw + 1;
          const w = Math.max(2, bw - 2);
          const top = y(d.value);
          const h = H - padB - top;
          const r = Math.min(4, w / 2, h);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * bw} y={padT} width={bw} height={H - padT - padB} fill="transparent" />
              {d.value > 0 && (
                <path
                  d={`M${x},${H - padB} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${H - padB} Z`}
                  fill={hover === i ? "#0a2463" : "#1d5bd8"}
                />
              )}
              {i % 5 === 0 && <text x={x + w / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#5b6b8a">{fmt(d.date)}</text>}
            </g>
          );
        })}
        <line x1={padL} x2={W} y1={H - padB} y2={H - padB} stroke="#c9d6ec" strokeWidth={1} />
      </svg>
      {hover !== null && (
        <div className="absolute top-0 pointer-events-none bg-[var(--ink)] text-white text-xs rounded-lg px-3 py-2 shadow-lg" style={{ left: `${((padL + (hover + 0.5) * bw) / W) * 100}%`, transform: "translateX(-50%)" }}>
          <div className="font-bold">{fmt(data[hover].date)}</div>
          <div>{usd(data[hover].value)}</div>
        </div>
      )}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-[var(--blue)] font-bold">View as table</summary>
        <table className="table mt-2">
          <thead><tr><th>Date</th><th>Revenue</th></tr></thead>
          <tbody>{data.filter((d) => d.value > 0).map((d) => <tr key={d.date}><td>{fmt(d.date)}</td><td>{usd(d.value)}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}

function niceMax(v: number) {
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * exp;
}
