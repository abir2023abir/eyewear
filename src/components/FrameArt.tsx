import { FrameSpec, lensCenterX, lensOutline, offsetOutline, rimThickness, toPath } from "@/lib/frame-geometry";

type Props = {
  spec: FrameSpec;
  color: string;
  accent?: string | null;
  /** "gradient" fades color (top) into accent (bottom); otherwise accent is a browline top bar */
  finish?: string;
  view?: "front" | "side";
  sun?: boolean;
  className?: string;
  title?: string;
  /** draw dimension lines (lens / bridge / total width), like a technical drawing */
  annotate?: boolean;
};

function shade(hex: string, amt: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

/** Generated product artwork (used until real photos are uploaded in the admin panel). */
export default function FrameArt({ spec, color, accent: accentIn, finish, view = "front", sun, className, title, annotate }: Props) {
  const fade = finish === "gradient" && accentIn ? accentIn : null;
  const accent = fade ? null : accentIn;
  const id = `g${Math.abs(hashCode(spec.shape + color + (accentIn || "") + (fade ? "f" : "") + view + (sun ? 1 : 0)))}`;
  const lens = lensOutline(spec, 80);
  const rim = offsetOutline(lens, rimThickness(spec));
  const cx = lensCenterX(spec);
  const W = 180, H = 90, s = 1.12;
  const mid = W / 2, cy = 46;
  const top = accent || color;
  const lensFill = sun ? `url(#${id}l)` : `url(#${id}c)`;

  if (view === "side") {
    // three-quarter view: one lens foreshortened, temple arm visible
    const k = 0.55;
    const pathL = rim.map(([x, y]) => [x * k, y] as [number, number]);
    const lensL = lens.map(([x, y]) => [x * k, y] as [number, number]);
    const pathR = rim.map(([x, y]) => [x * 0.95, y] as [number, number]);
    const lensR = lens.map(([x, y]) => [x * 0.95, y] as [number, number]);
    const lx = mid - 24, rx = mid + 28;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={title}>
        <Defs id={id} color={color} fade={fade} />
        <path d={`M${rx + 34},${cy - 10} C${rx + 60},${cy - 12} ${rx + 70},${cy - 8} ${W - 6},${cy + 6} L${W - 8},${cy + 10} C${rx + 64},${cy - 3} ${rx + 56},${cy - 7} ${rx + 34},${cy - 5} Z`} fill={shade(color, -18)} />
        <path d={toPath(pathL, lx, cy, true, s) + toPath(lensL, lx, cy, true, s)} fillRule="evenodd" fill={fade ? `url(#${id}f)` : top} />
        <path d={toPath(lensL, lx, cy, true, s)} fill={lensFill} />
        <path d={toPath(pathR, rx, cy, false, s) + toPath(lensR, rx, cy, false, s)} fillRule="evenodd" fill={`url(#${id}f)`} />
        <path d={toPath(lensR, rx, cy, false, s)} fill={lensFill} />
        <path d={`M${lx + 8},${cy - 12} Q${mid + 2},${cy - 18} ${rx - 24},${cy - 12}`} stroke={top} strokeWidth={3} fill="none" />
        <Glare lens={lensR} x={rx} y={cy} s={s} />
      </svg>
    );
  }

  const lx = mid - cx * s, rx = mid + cx * s;
  const bridgeY = cy - spec.lensHeight * 0.18 * s;
  const metal = spec.material === "Metal" || spec.material === "Titanium";
  const outerX = Math.max(...rim.map((p) => p[0]));
  const topY = Math.max(...rim.map((p) => p[1]));
  const botY = Math.min(...rim.map((p) => p[1]));
  return (
    <svg viewBox={annotate ? `-6 -20 ${W + 12} ${H + 42}` : `0 0 ${W} ${H}`} className={className} role="img" aria-label={title}>
      <Defs id={id} color={color} fade={fade} />
      {/* temple hinges */}
      <rect x={lx - (spec.lensWidth / 2 + 4) * s - 4} y={cy - spec.lensHeight * 0.3 * s} width={7} height={4} rx={1.5} fill={shade(color, -25)} />
      <rect x={rx + (spec.lensWidth / 2 + 4) * s - 3} y={cy - spec.lensHeight * 0.3 * s} width={7} height={4} rx={1.5} fill={shade(color, -25)} />
      <path d={toPath(rim, lx, cy, true, s) + toPath(lens, lx, cy, true, s)} fillRule="evenodd" fill={`url(#${id}f)`} />
      <path d={toPath(rim, rx, cy, false, s) + toPath(lens, rx, cy, false, s)} fillRule="evenodd" fill={`url(#${id}f)`} />
      {accent && (
        <>
          <path d={toPath(rim.map(([x, y]) => [x, Math.max(y, spec.lensHeight * 0.12)] as [number, number]), lx, cy, true, s) + toPath(lens, lx, cy, true, s)} fillRule="evenodd" fill={accent} />
          <path d={toPath(rim.map(([x, y]) => [x, Math.max(y, spec.lensHeight * 0.12)] as [number, number]), rx, cy, false, s) + toPath(lens, rx, cy, false, s)} fillRule="evenodd" fill={accent} />
        </>
      )}
      <path d={toPath(lens, lx, cy, true, s)} fill={lensFill} />
      <path d={toPath(lens, rx, cy, false, s)} fill={lensFill} />
      {/* bridge */}
      <path
        d={`M${lx + (spec.lensWidth / 2 - 2) * s},${bridgeY} Q${mid},${bridgeY - (metal ? 5 : 3)} ${rx - (spec.lensWidth / 2 - 2) * s},${bridgeY}`}
        stroke={top}
        strokeWidth={metal ? 1.6 : 4}
        fill="none"
      />
      {metal && (
        <path d={`M${lx + (spec.lensWidth / 2 - 1) * s},${cy - spec.lensHeight * 0.42 * s} L${rx - (spec.lensWidth / 2 - 1) * s},${cy - spec.lensHeight * 0.42 * s}`} stroke={top} strokeWidth={1.2} />
      )}
      <Glare lens={lens} x={lx} y={cy} s={s} flip />
      <Glare lens={lens} x={rx} y={cy} s={s} />
      {annotate && (
        <g stroke="#2553d9" strokeWidth={0.35} fill="#2553d9" style={{ fontFamily: "var(--font-mono), monospace" }} fontSize={4.2}>
          <Dim x1={rx - (spec.lensWidth / 2) * s} x2={rx + (spec.lensWidth / 2) * s} y={cy - topY * s - 7} label={`LENS ${spec.lensWidth}`} />
          <Dim x1={lx + (spec.lensWidth / 2) * s} x2={rx - (spec.lensWidth / 2) * s} y={cy - topY * s - 7} label={`${spec.bridge}`} />
          <Dim x1={lx - outerX * s} x2={rx + outerX * s} y={cy - botY * s + 9} label={`TOTAL WIDTH ${spec.frameWidth}`} below />
          <line x1={lx - outerX * s} x2={lx - outerX * s} y1={cy} y2={cy - botY * s + 11} strokeDasharray="1 1.2" />
          <line x1={rx + outerX * s} x2={rx + outerX * s} y1={cy} y2={cy - botY * s + 11} strokeDasharray="1 1.2" />
        </g>
      )}
    </svg>
  );
}

function Dim({ x1, x2, y, label, below }: { x1: number; x2: number; y: number; label: string; below?: boolean }) {
  return (
    <g>
      <line x1={x1} x2={x2} y1={y} y2={y} />
      <line x1={x1} x2={x1} y1={y - 1.8} y2={y + 1.8} />
      <line x1={x2} x2={x2} y1={y - 1.8} y2={y + 1.8} />
      <text x={(x1 + x2) / 2} y={below ? y + 6.5 : y - 2.4} textAnchor="middle" stroke="none" letterSpacing={0.3}>{label}</text>
    </g>
  );
}

function Defs({ id, color, fade }: { id: string; color: string; fade?: string | null }) {
  return (
    <defs>
      {fade ? (
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, 20)} />
          <stop offset="0.3" stopColor={color} />
          <stop offset="0.85" stopColor={fade} />
          <stop offset="1" stopColor={fade} stopOpacity="0.85" />
        </linearGradient>
      ) : (
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(color, 38)} />
          <stop offset="0.45" stopColor={color} />
          <stop offset="1" stopColor={shade(color, -30)} />
        </linearGradient>
      )}
      <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#eaf2ff" stopOpacity="0.55" />
        <stop offset="1" stopColor="#ffffff" stopOpacity="0.15" />
      </linearGradient>
      <linearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1b2330" stopOpacity="0.92" />
        <stop offset="1" stopColor="#3d4a5c" stopOpacity="0.8" />
      </linearGradient>
    </defs>
  );
}

function Glare({ lens, x, y, s, flip }: { lens: [number, number][]; x: number; y: number; s: number; flip?: boolean }) {
  const maxX = Math.max(...lens.map((p) => p[0]));
  const maxY = Math.max(...lens.map((p) => p[1]));
  const gx = x + (flip ? 1 : -1) * maxX * 0.35 * s;
  const gy = y - maxY * 0.45 * s;
  return <path d={`M${gx - 6},${gy + 5} L${gx + 2},${gy - 5}`} stroke="#fff" strokeOpacity="0.7" strokeWidth={2.2} strokeLinecap="round" />;
}

function hashCode(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}
