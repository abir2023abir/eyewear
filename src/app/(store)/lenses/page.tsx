import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";

export const metadata: Metadata = {
  title: "Prescription Lenses & Coatings — Clear Pricing",
  description: "Compare clear, anti-reflection, bluecut and photosun prescription lenses. How to read SPH, CYL, AXIS and PD.",
  alternates: { canonical: "/lenses" },
};

const TINT: Record<string, string> = {
  none: "repeating-linear-gradient(45deg,#f3f7ff 0 8px,#fff 8px 16px)",
  clear: "linear-gradient(135deg,#f8fbff,#e6efff)",
  ar: "linear-gradient(135deg,#f3fff9,#dff5ff 60%,#e9e4ff)",
  bluecut: "linear-gradient(135deg,#fffbe8,#fff3c4 60%,#dce9ff)",
  photosun: "linear-gradient(90deg,#f3f6fb 0 50%,#4b5566 50% 100%)",
};

export default async function Lenses() {
  const all = await db.lensOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  const types = all.filter((l) => l.kind === "type");
  const hasTypes = types.some((t) => t.code !== "none");
  const coats = all.filter((l) => l.kind === "coating");
  const features: [string, string[]][] = [
    ["Scratch-resistant hard coat", ["clear", "ar", "bluecut", "photosun"]],
    ["100% UV protection", ["bluecut", "photosun"]],
    ["Anti-glare multi-coat", ["ar", "bluecut", "photosun"]],
    ["Blue-light filter", ["bluecut", "photosun"]],
    ["Darkens in sunlight", ["photosun"]],
  ];
  return (
    <div className="container-x py-12">
      <div className="max-w-2xl">
        <div className="eyebrow">Lenses & prescriptions</div>
        <h1 className="h-section mt-2">{hasTypes ? "Lenses cut to your prescription." : "Upgrades & coatings"}</h1>
        <p className="lead mt-4">{hasTypes ? "Every lens is single-vision, made to your SPH, CYL and AXIS and centred on your PD. Prices are per pair and are added to the frame price." : "Frames are sold on their own. Add any of these upgrades when you order — the price is added per pair."}</p>
      </div>

      {hasTypes && (
      <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-10">
        {types.map((l) => (
          <div key={l.id} className="lens-card">
            <div className="lens-swatch" style={{ background: TINT[l.code] }} />
            <div className="font-display text-lg font-semibold text-[var(--navy)]">{l.name}</div>
            <p className="text-[13px] muted mt-1.5 min-h-[72px]">{l.description}</p>
            <div className="font-extrabold mt-3">{l.price ? usd(l.price) : "Free"}</div>
          </div>
        ))}
      </div>

      <div className="card mt-10 overflow-x-auto">
        <table className="table min-w-[640px]">
          <thead>
            <tr>
              <th>Feature</th>
              {types.filter((t) => t.code !== "none").map((t) => <th key={t.id} className="!text-center">{t.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {features.map(([f, has]) => (
              <tr key={f}>
                <td className="font-semibold">{f}</td>
                {types.filter((t) => t.code !== "none").map((t) => (
                  <td key={t.id} className="text-center text-lg">{has.includes(t.code) ? <span className="text-[var(--ok)]">✓</span> : <span className="muted">—</span>}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="font-bold">Price per pair</td>
              {types.filter((t) => t.code !== "none").map((t) => <td key={t.id} className="text-center font-extrabold">{usd(t.price)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      </>
      )}

      <h2 className={`h-section ${hasTypes ? "mt-16" : "mt-10"} mb-6 !text-3xl`}>{hasTypes ? "Upgrades & coatings" : "Available upgrades"}</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {coats.map((c) => (
          <div key={c.id} className="card-flat p-5">
            <div className="flex justify-between font-bold"><span>{c.name}</span><span>+{usd(c.price)}</span></div>
            <p className="text-sm muted mt-2">{c.description}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-10 mt-16 items-start">
        <div className="prose-x">
          <h2>Reading your prescription</h2>
          <ul>
            <li><b>OD / OS</b> — right eye / left eye.</li>
            <li><b>SPH</b> — main lens power. Minus = short-sighted, plus = long-sighted.</li>
            <li><b>CYL & AXIS</b> — astigmatism correction and its direction (1–180°). Leave AXIS blank if CYL is empty.</li>
            <li><b>ADD</b> — reading addition, only for reading glasses.</li>
            <li><b>PD</b> — distance between your pupils in mm. Our try-on studio can estimate it for you.</li>
          </ul>
          <p>Prefer not to type it? Upload a photo of your prescription at checkout — our opticians verify every order before lenses are cut.</p>
          <p className="text-sm muted">We supply single-vision lenses from SPH −10.00 to +6.00 and CYL up to ±4.00. For stronger prescriptions, chat with us for a quote.</p>
        </div>
        <div className="card p-8 text-center">
          <div className="font-display text-2xl font-semibold text-[var(--navy)]">Don’t know your PD?</div>
          <p className="muted mt-2">Open the try-on studio — it measures your pupillary distance from your camera and can add it to your order.</p>
          <Link href="/try-on" className="btn btn-primary mt-5">Measure with my camera</Link>
        </div>
      </div>
    </div>
  );
}
