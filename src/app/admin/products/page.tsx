import Link from "next/link";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import FrameArt from "@/components/FrameArt";
import StockCell from "./StockCell";
import RowActions from "./RowActions";

export default async function Products({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const { q = "", show = "" } = await searchParams;
  const products = await db.product.findMany({
    where: {
      ...(show === "archived" ? { active: false } : show === "all" ? {} : { active: true }),
      ...(q ? { OR: [{ name: { contains: q } }, { modelCode: { contains: q } }, { variants: { some: { sku: { contains: q } } } }] } : {}),
    },
    include: { variants: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  const skus = products.reduce((s, p) => s + p.variants.length, 0);
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="h-section !text-3xl">Frames & stock</h1>
          <p className="muted text-sm">{products.length} frames · {skus} SKUs</p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary">+ Add frame</Link>
      </div>
      <form className="flex gap-2 flex-wrap">
        <input name="q" defaultValue={q} placeholder="Search name, model, SKU…" className="input !w-72" />
        <select name="show" defaultValue={show} className="select !w-40">
          <option value="">Active</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </select>
        <button className="btn btn-outline">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table min-w-[860px]">
          <thead><tr><th></th><th>Frame</th><th>Category</th><th>Price</th><th>Colours & stock (edit inline)</th><th>3D</th><th>Flags</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => {
              const out = p.variants.filter((v) => v.stock === 0).length;
              return (
                <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                  <td className="w-24"><FrameArt spec={p} color={p.variants[0]?.colorHex || "#222"} accent={p.variants[0]?.accentHex} finish={p.variants[0]?.finish} className="w-20" /></td>
                  <td><Link href={`/admin/products/${p.id}`} className="font-bold text-[var(--blue)]">{p.name} {p.modelCode}</Link><div className="text-xs muted capitalize">{p.shape} · {p.material} · {p.gender}</div></td>
                  <td className="capitalize">{p.category}</td>
                  <td className="font-semibold">{usd(p.price)}</td>
                  <td>
                    <div className="flex gap-1.5 flex-wrap">
                      {p.variants.map((v) => (
                        <StockCell key={v.id} productId={p.id} variantId={v.id} colorName={v.colorName} colorHex={v.colorHex} stock={v.stock} />
                      ))}
                    </div>
                    {out > 0 && <div className="text-xs text-[var(--bad)] mt-1">⚠ {out} colour(s) out of stock</div>}
                  </td>
                  <td className="text-xs">{p.variants.some((v) => v.modelUrl) ? <span className="tag tag-ok">GLB</span> : <span className="muted">Auto</span>}</td>
                  <td className="text-xs">{[p.isFeatured && "Featured", p.isNew && "New", p.isBestseller && "Best", !p.active && "Hidden"].filter(Boolean).join(" · ")}</td>
                  <td><RowActions id={p.id} name={`${p.name} ${p.modelCode}`} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
