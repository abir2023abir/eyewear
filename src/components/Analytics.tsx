import Script from "next/script";

const ID = /^(G|AW|UA)-[A-Z0-9-]+$/i;

/** Google Analytics 4 + Google Ads. IDs are set in Admin → Settings → Marketing; nothing loads until then. */
export default function Analytics({ gaId, adsId }: { gaId?: string; adsId?: string }) {
  const ga = gaId && ID.test(gaId) ? gaId : "";
  const ads = adsId && ID.test(adsId) ? adsId : "";
  const first = ga || ads;
  if (!first) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${first}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());${ga ? `gtag('config','${ga}');` : ""}${ads ? `gtag('config','${ads}');` : ""}`}
      </Script>
    </>
  );
}

/** Purchase + Google Ads conversion event for the order-confirmation page. */
export function purchaseEventScript(orderNumber: string, value: number, items: { id: string; name: string; price: number; qty: number }[], adsId?: string, label?: string) {
  const ads = adsId && ID.test(adsId) ? adsId : "";
  const lbl = label && /^[A-Za-z0-9_-]+$/.test(label) ? label : "";
  const payload = JSON.stringify({
    transaction_id: orderNumber,
    value,
    currency: "USD",
    items: items.map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.qty })),
  });
  return `if(window.gtag){gtag('event','purchase',${payload});${ads && lbl ? `gtag('event','conversion',{send_to:'${ads}/${lbl}',value:${value},currency:'USD',transaction_id:${JSON.stringify(orderNumber)}});` : ""}}`;
}
