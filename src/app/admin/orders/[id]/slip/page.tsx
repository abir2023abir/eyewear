import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { usd } from "@/lib/money";
import { countryName } from "@/lib/countries";
import { getSettings } from "@/lib/settings";
import { safeJson } from "@/lib/types";
import PrintButton from "./PrintButton";

/** Printable packing slip + commercial invoice (for customs paperwork). */
export default async function Slip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!o) notFound();
  const { store, shipping: from } = await getSettings();
  return (
    <div className="bg-white p-8 max-w-3xl mx-auto text-sm print:p-0">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-display text-2xl font-semibold">{store.name}</div>
          <div className="muted">{from.fromCompany}<br />{from.fromAddress && !/^TODO/i.test(from.fromAddress) ? `${from.fromAddress}, ` : ""}{from.fromCity} {from.fromPostcode}, {from.fromCountry}<br />{store.phone} · {store.email}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">COMMERCIAL INVOICE / PACKING SLIP</div>
          <div>Invoice no. {o.number}</div>
          <div>Date {o.createdAt.toISOString().slice(0, 10)}</div>
          {o.trackingNumber && <div>DHL AWB {o.trackingNumber}</div>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-6 mt-8">
        <div><b>Ship to</b><br />{o.name}<br />{o.line1}{o.line2 && <>, {o.line2}</>}<br />{o.city} {o.state} {o.postcode}<br />{countryName(o.country)}<br />{o.phone}<br />{o.email}</div>
        <div><b>Terms</b><br />Incoterm: DAP<br />Currency: USD<br />Reason for export: Sale<br />Service: {o.dhlServiceName}</div>
      </div>
      <table className="w-full mt-8 border-collapse">
        <thead><tr className="border-b-2 border-black text-left"><th className="py-2">Description</th><th>HS code</th><th>Origin</th><th>Qty</th><th className="text-right">Unit USD</th><th className="text-right">Total USD</th></tr></thead>
        <tbody>
          {o.items.map((it) => {
            const rx = safeJson<Record<string, string>>(it.prescription, {});
            return (
              <tr key={it.id} className="border-b border-gray-300 align-top">
                <td className="py-2">Spectacle frame {it.name} ({it.colorName}), SKU {it.sku}<br /><span className="text-xs">{it.lensName}{it.coatings ? ` + ${it.coatings}` : ""}{rx.mode === "form" ? ` · R ${rx.odSph}/${rx.odCyl}×${rx.odAxis || "-"} L ${rx.osSph}/${rx.osCyl}×${rx.osAxis || "-"} PD ${rx.pd || `${rx.pdRight}/${rx.pdLeft}`}` : ""}</span></td>
                <td>900311</td>
                <td>{from.fromCountry}</td>
                <td>{it.qty}</td>
                <td className="text-right">{((it.unitPrice + it.lensPrice) / 100).toFixed(2)}</td>
                <td className="text-right">{(((it.unitPrice + it.lensPrice) * it.qty) / 100).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-4 ml-auto max-w-xs grid gap-1">
        <div className="flex justify-between"><span>Goods</span><span>{usd(o.total - o.shipping)}</span></div>
        <div className="flex justify-between"><span>Freight</span><span>{usd(o.shipping)}</span></div>
        <div className="flex justify-between font-bold border-t border-black pt-1"><span>Total</span><span>{usd(o.total)}</span></div>
      </div>
      <p className="mt-10 text-xs">I declare that the information in this invoice is true and correct.</p>
      <p className="mt-8">Signature: ____________________</p>
      <PrintButton />
    </div>
  );
}
