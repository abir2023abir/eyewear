import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { waLink } from "@/lib/settings-shared";
import { jsonLd, toDTO } from "@/lib/types";
import { usd } from "@/lib/money";
import FrameArt from "@/components/FrameArt";
import Icon from "@/components/Icon";
import ProductCard from "@/components/ProductCard";
import Newsletter from "@/components/Newsletter";
import OrderBuilder from "@/components/OrderBuilder";

export const revalidate = 300;

export default async function Home() {
  const settings = await getSettings();
  const { store, home, pricing } = settings;
  const FAQ = home.faq.filter((f) => f.q && f.a).map((f) => [f.q, f.a] as const);
  const waHref = () => waLink(store.whatsapp);
  const [featured, fresh, best, lenses, skuCount, all] = await Promise.all([
    db.product.findMany({ where: { active: true, isFeatured: true, variants: { some: {} } }, include: { variants: { orderBy: { sortOrder: "asc" } } }, take: 8 }),
    db.product.findMany({ where: { active: true, isNew: true, variants: { some: {} } }, include: { variants: { orderBy: { sortOrder: "asc" } } }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.product.findMany({ where: { active: true, isBestseller: true, variants: { some: {} } }, include: { variants: { orderBy: { sortOrder: "asc" } } }, take: 4 }),
    db.lensOption.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.variant.count({ where: { product: { active: true } } }),
    db.product.findMany({ where: { active: true, variants: { some: {} } }, include: { variants: { orderBy: { sortOrder: "asc" } } }, orderBy: [{ isFeatured: "desc" }, { isBestseller: "desc" }, { createdAt: "desc" }] }),
  ]);
  const builderProducts = all.map(toDTO).filter((p) => p.variants.length);
  const builderLenses = lenses.map((l) => ({ code: l.code, kind: l.kind, name: l.name, description: l.description, price: l.price }));
  const topTier = [...pricing.bundleTiers].sort((x, y) => y.off - x.off)[0];
  const lensTypes = lenses.filter((l) => l.kind === "type" && l.code !== "none");
  const upgrades = lenses.filter((l) => l.kind === "coating");
  const lensCards = lensTypes.length ? lensTypes : upgrades;
  const minLens = Math.min(...lensTypes.filter((l) => l.price > 0).map((l) => l.price));
  const hero = featured[0] ? toDTO(featured[0]) : null;
  // real photo first: the one uploaded for the hero, else the featured frame's own product photo
  const heroPhoto = home.heroImage || hero?.variants[0]?.images?.[0] || "";
  const minPrice = Math.min(...featured.map((p) => p.price), 2900);
  const liveModels = featured.slice(0, 5).map(toDTO);

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "radial-gradient(900px 500px at 85% 10%, #dbe8ff 0%, transparent 60%), radial-gradient(700px 400px at 0% 90%, #eef4ff 0%, transparent 60%)" }} />
        <div className="container-x grid lg:grid-cols-2 gap-12 items-center pt-12 pb-20 lg:pt-20">
          <div className="fade-up order-2 lg:order-1">
            {home.heroBadge && <span className="chip"><span className="chip-dot">✦</span> {home.heroBadge}</span>}
            <h1 className="h-display mt-6">{home.heroTitle}{home.heroHighlight && <> <em className="text-[var(--blue)] not-italic">{home.heroHighlight}</em></>}{home.heroTitleEnd && <> {home.heroTitleEnd}</>}</h1>
            <p className="lead mt-6 max-w-xl">
              {home.heroSubtitle}
            </p>
            <div className="mt-8 flex items-end gap-6">
              <div>
                <div className="text-xs font-bold tracking-[.16em] uppercase muted">From</div>
                <div className="font-display text-5xl font-semibold text-[var(--navy)]">{usd(minPrice)}</div>
                <div className="text-sm muted">per frame{Number.isFinite(minLens) ? <> · lenses from {usd(minLens)}</> : null}</div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop" className="btn btn-primary btn-lg">Browse the collection</Link>
              <Link href="/try-on" className="btn btn-outline btn-lg"><Icon name="camera" size={17} /> Try on with camera</Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {["Flexible TR90", "Spring hinges", "Bluecut & UV", "DHL Express"].map((t) => (
                <span key={t} className="chip"><Icon name="check" size={14} className="text-[var(--blue)]" /> {t}</span>
              ))}
            </div>
          </div>
          <div className="order-1 lg:order-2 relative">
            <div className="hero-card aspect-[5/4] grid place-items-center p-10">
              {heroPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroPhoto} alt={hero ? `${hero.name} ${hero.modelCode}` : store.name} className="w-[92%] max-h-full object-contain drop-shadow-[0_30px_30px_rgba(10,36,99,.18)]" fetchPriority="high" />
              ) : (
                hero && <FrameArt spec={hero} color={hero.variants[0].colorHex} accent={hero.variants[0].accentHex} finish={hero.variants[0].finish} view="front" className="w-[88%] drop-shadow-[0_30px_30px_rgba(10,36,99,.25)]" title={hero.name} />
              )}
              {topTier && topTier.off > 0 && (
                <div className="float-badge top-6 left-6">
                  <span className="ic"><Icon name="tag" size={16} /></span>
                  <span><b className="block text-[15px]">Save {Math.round(topTier.off * 100)}%</b><span className="muted">on {topTier.qty} frames</span></span>
                </div>
              )}
              <div className="float-badge bottom-6 right-6">
                <span className="ic"><Icon name="eye" size={16} /></span>
                <span><b className="block text-[15px]">{skuCount}+ SKUs</b><span className="muted">in stock, ready to ship</span></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- TRY-ON PROMO ---------------- */}
      <section className="section-navy section">
        <div className="container-x grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="eyebrow">Try before you buy</div>
            <h2 className="h-section mt-3">See the frame on your face — not just on a product page.</h2>
            <p className="lead mt-5">Turn on your camera or upload a selfie. Frames lock onto your face in real 3D, temple arms tuck behind your ears, and we tell you if the size fits.</p>
            <div className="grid sm:grid-cols-3 gap-4 mt-8">
              {[
                ["camera", "Live & automatic", "No dragging or resizing — it tracks your face."],
                ["ruler", "True-size fit", "Measures face width and flags frames that fit."],
                ["shield", "100% on-device", "Your face never leaves your phone or laptop."],
              ].map(([ic, t, d]) => (
                <div key={t} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                  <Icon name={ic} className="text-[#8fb4ff]" />
                  <div className="font-bold mt-3">{t}</div>
                  <div className="text-sm text-[#bcd0f5] mt-1">{d}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/try-on" className="btn bg-white text-[var(--navy)] btn-lg hover:bg-[var(--sky)]">Start virtual try-on <Icon name="arrow" size={16} /></Link>
              <Link href="/shop" className="btn border border-white/30 text-white btn-lg hover:bg-white/10">Browse all frames</Link>
            </div>
          </div>
          <div className="rounded-[28px] bg-white/5 border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-bold flex items-center gap-2"><span className="live-dot" /> Live fitting room</span>
              <span className="text-xs text-[#bcd0f5]">Tap a frame to try it</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {liveModels.map((p) => (
                <Link key={p.id} href={`/try-on?p=${p.slug}`} className="rounded-2xl bg-white p-3 text-[var(--ink)] hover:scale-[1.03] transition">
                  <FrameArt photo={p.variants[0].images[0]} spec={p} color={p.variants[0].colorHex} accent={p.variants[0].accentHex} finish={p.variants[0].finish} className="w-full" />
                  <div className="text-[13px] font-bold mt-1">{p.name} {p.modelCode}</div>
                  <div className="text-[12px] muted">{p.variants[0].colorName} · {usd(p.price)}</div>
                </Link>
              ))}
              <Link href="/try-on" className="rounded-2xl border border-dashed border-white/30 grid place-items-center text-sm font-bold p-3 hover:bg-white/5">All frames →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- FEATURED ---------------- */}
      <section className="section" id="collection">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <div className="eyebrow">The collection · featured frames</div>
              <h2 className="h-section mt-2">Tap a swatch to see every finish.</h2>
            </div>
            <Link href="/shop" className="btn btn-outline">View all frames <Icon name="arrow" size={16} /></Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((p) => <ProductCard key={p.id} p={toDTO(p)} />)}
          </div>
        </div>
      </section>

      {/* ---------------- BUNDLES ---------------- */}
      <section className="section section-sky" id="pricing">
        <div className="container-x">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="eyebrow">Bundle pricing</div>
            <h2 className="h-section mt-2">Buy more, save more.</h2>
            <p className="lead mt-4">Mix any models and colours in one order — the discount applies to every frame in your bag automatically.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...pricing.bundleTiers].sort((x, y) => x.qty - y.qty).map((t, i, all) => {
              const example = 2900;
              const each = Math.round(example * (1 - t.off));
              const best = i === all.length - 1 && all.length > 1;
              return (
                <div key={t.qty} className={`bundle ${best ? "best" : ""}`}>
                  {best && <span className="ribbon tag">Best value</span>}
                  <div className="text-xs font-extrabold tracking-[.16em] uppercase muted">Buy {t.qty} frame{t.qty > 1 ? "s" : ""}{best ? "+" : ""}</div>
                  <div className="font-display text-5xl font-semibold text-[var(--navy)] mt-3">{t.off ? `−${Math.round(t.off * 100)}%` : "Base"}</div>
                  <div className="mt-2 text-sm muted">e.g. {usd(each)} each on a {usd(example)} frame</div>
                  <div className={`mt-4 text-sm font-bold ${t.off ? "text-[var(--ok)]" : "muted"}`}>{t.off ? `Save ${usd((example - each) * t.qty)} on ${t.qty}` : "Single frame price"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- NEW + BEST ---------------- */}
      <section className="section">
        <div className="container-x grid gap-16">
          {([
            ["New arrivals", "Just landed", fresh, "/shop?sort=new"],
            ["Bestsellers", "Most loved", best, "/shop?sort=best"],
          ] as const).map(([eyebrow, title, list, href]) => (
            <div key={eyebrow}>
              <div className="flex items-end justify-between mb-8">
                <div>
                  <div className="eyebrow">{eyebrow}</div>
                  <h2 className="h-section mt-2">{title}</h2>
                </div>
                <Link href={href} className="btn btn-ghost">See all <Icon name="arrow" size={16} /></Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {list.map((p) => <ProductCard key={p.id} p={toDTO(p)} />)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- LENSES ---------------- */}
      <section className="section section-sky" id="lenses">
        <div className="container-x">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
            <div>
              <div className="eyebrow">{lensTypes.length ? "Prescription lens options" : "Optional upgrades & coatings"}</div>
              <h2 className="h-section mt-2">Clear pricing, per frame.</h2>
              <p className="lead mt-3 max-w-xl">{lensTypes.length ? "Choose a lens when you order — the price is added to the frame. Coatings and ultra-thin upgrades are optional." : "Every frame is sold on its own. Add an upgrade when you order — the price is added to the frame."}</p>
            </div>
            <Link href="/lenses" className="btn btn-outline">{lensTypes.length ? "Compare lenses" : "See all upgrades"}</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {lensCards.map((l) => (
              <div key={l.id} className="lens-card">
                <div className="lens-swatch" style={{ background: LENS_BG[l.code] }} />
                <div className="font-display text-xl font-semibold text-[var(--navy)]">{l.name}</div>
                <p className="text-sm muted mt-2 min-h-[60px]">{l.description}</p>
                <div className="mt-4 font-extrabold text-lg">{usd(l.price)} <span className="text-sm font-medium muted">/ frame</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- BUILD YOUR ORDER ---------------- */}
      <section className="section" id="build">
        <div className="container-x">
          <div className="max-w-2xl mb-10">
            <div className="eyebrow">Build your order</div>
            <h2 className="h-section mt-2">Choose frames, add lenses, see the total.</h2>
            <p className="lead mt-3">Pick how many frames, the models and colours, and any upgrades — the price updates as you go, bundle discount included.</p>
          </div>
          <OrderBuilder products={builderProducts} lenses={builderLenses} />
        </div>
      </section>

      {/* ---------------- WHY ---------------- */}
      <section className="section">
        <div className="container-x">
          <div className="max-w-2xl mb-12">
            <div className="eyebrow">Why shop with us</div>
            <h2 className="h-section mt-2">Made to be worn all day, every day.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              ["glasses", "Memory-flex frames", "TR90 bends under pressure and springs back — and it’s light enough to forget you’re wearing it."],
              ["refresh", "Spring hinges", "Sprung temples grip gently without pinching and survive years of folding."],
              ["eye", "Screen-ready lenses", "Bluecut filters high-energy light; photosun darkens outdoors on its own."],
              ["tag", "Bundle savings", "The more frames in your bag, the lower the price of every one of them."],
              ["globe", "Worldwide DHL Express", "Door-to-door delivery from Wenzhou to 60+ countries with live tracking."],
              ["cube", "3D try-on", "Real 3D frames on your face in real time — with fit and face-shape advice."],
            ].map(([ic, t, d]) => (
              <div key={t} className="card-flat p-6">
                <div className="w-12 h-12 rounded-2xl bg-[var(--sky)] text-[var(--blue)] grid place-items-center"><Icon name={ic} size={22} /></div>
                <div className="font-display text-xl font-semibold mt-4 text-[var(--navy)]">{t}</div>
                <p className="muted text-sm mt-2 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- HOW TO ORDER ---------------- */}
      <section className="section section-sky">
        <div className="container-x">
          <div className="text-center mb-12">
            <div className="eyebrow">How to order</div>
            <h2 className="h-section mt-2">Three steps to your new glasses.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              ["Pick & try on", "Browse the collection, tap a colour, and try it on in 3D to check the fit."],
              ["Add your lenses", "Choose frame only or a lens type, then enter or upload your prescription."],
              ["Pay & track", "Pay with PayPal or bank transfer. We dispatch by DHL Express and email your tracking."],
            ].map(([t, d], i) => (
              <div key={t} className="card p-7">
                <div className="step-num">{i + 1}</div>
                <div className="font-display text-2xl font-semibold mt-5 text-[var(--navy)]">{t}</div>
                <p className="muted mt-2 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section className="section" id="faq">
        <div className="container-x grid lg:grid-cols-[1fr_1.5fr] gap-12">
          <div>
            <div className="eyebrow">Questions</div>
            <h2 className="h-section mt-2">Everything you might ask.</h2>
            <p className="lead mt-4">Still unsure? Tap <b>Chat with us</b> — a real person from our team will answer.</p>
            <div className="mt-6 grid gap-2 text-sm">
              <a href={`mailto:${store.email}`} className="flex items-center gap-2 font-semibold hover:text-[var(--blue)]"><Icon name="mail" size={16} /> {store.email}</a>
              <a href={waHref()} target="_blank" rel="noopener" className="flex items-center gap-2 font-semibold hover:text-[var(--blue)]"><Icon name="phone" size={16} /> {store.phone} (WhatsApp)</a>
            </div>
          </div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
            }),
          }}
        />
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="section-navy section">
        <div className="container-x text-center max-w-3xl">
          <div className="eyebrow">Ready when you are</div>
          <h2 className="h-section mt-3">Clear vision, delivered to your door.</h2>
          <p className="lead mt-4">Join the list for new drops and member-only bundle offers.</p>
          <div className="mt-8 flex justify-center"><Newsletter dark /></div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/shop" className="btn bg-white text-[var(--navy)] btn-lg">Shop frames</Link>
            <a href={waHref()} target="_blank" rel="noopener" className="btn border border-white/30 text-white btn-lg">WhatsApp us</a>
          </div>
        </div>
      </section>
    </>
  );
}

const LENS_BG: Record<string, string> = {
  clear: "linear-gradient(135deg,#f8fbff,#e6efff)",
  ar: "linear-gradient(135deg,#f3fff9,#dff5ff 60%,#e9e4ff)",
  bluecut: "linear-gradient(135deg,#fffbe8,#fff3c4 60%,#dce9ff)",
  photosun: "linear-gradient(135deg,#dfe6f0,#5b6778)",
};
