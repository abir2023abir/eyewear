import "server-only";
import type { Order, OrderItem } from "@prisma/client";
import { esc, layout, sendMail } from "./mail";
import { usd } from "./money";
import { site } from "./site";
import { getSettings } from "./settings";
import { countryName } from "./countries";
import { trackingUrl } from "./shipping";
import { buildInvoicePdf, invoiceNumber } from "./invoice";
import type { Attachment } from "./mail";

type O = Order & { items: OrderItem[] };

function itemsTable(o: O) {
  const rows = o.items
    .map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #e3ebf8">${i.qty}× ${esc(i.name)} — ${esc(i.colorName)}<br><span style="color:#5a6b8c;font-size:13px">${esc(i.lensName)}${i.coatings ? " + " + esc(i.coatings) : ""}</span></td><td align="right" style="padding:8px 0;border-bottom:1px solid #e3ebf8">${usd((i.unitPrice + i.lensPrice) * i.qty)}</td></tr>`)
    .join("");
  const line = (l: string, r: string, b = false) => `<tr><td style="padding:4px 0;${b ? "font-weight:bold;font-size:16px" : ""}">${l}</td><td align="right" style="padding:4px 0;${b ? "font-weight:bold;font-size:16px" : ""}">${r}</td></tr>`;
  return `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
  ${line("Frames", usd(o.subtotal))}
  ${o.bundleDiscount ? line("Bundle saving", "−" + usd(o.bundleDiscount)) : ""}
  ${o.lensTotal ? line("Lenses &amp; upgrades", usd(o.lensTotal)) : ""}
  ${line(esc(o.dhlServiceName), usd(o.shipping))}
  ${o.adjustment ? line(o.adjustment < 0 ? "Discount" : "Adjustment", (o.adjustment < 0 ? "−" : "+") + usd(Math.abs(o.adjustment))) : ""}
  ${line("Total (USD)", usd(o.total), true)}</table>
  <p style="font-size:13px;color:#5a6b8c">Ship to: ${esc(o.name)}, ${esc(o.line1)}${o.line2 ? ", " + esc(o.line2) : ""}, ${esc(o.city)} ${esc(o.postcode)}, ${esc(countryName(o.country))}</p>`;
}

const btn = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#1d5bd8;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">${esc(label)}</a></p>`;

export const orderLink = (o: Order) => `${site.url}/order/${o.number}?t=${o.accessToken}`;
export const invoiceLink = (o: Order) => `${site.url}/api/orders/${o.number}/invoice?t=${o.accessToken}`;

/** Invoice PDF attachment (never breaks an email if the PDF fails). */
async function invoiceAttachment(o: O): Promise<Attachment[]> {
  try {
    return [{ filename: `${invoiceNumber(o)}.pdf`, content: await buildInvoicePdf(o), contentType: "application/pdf" }];
  } catch (e) {
    console.error("[invoice] could not build PDF", e);
    return [];
  }
}

export async function emailOrderPlaced(o: O) {
  const { store } = await getSettings();
  const pay =
    o.paymentMethod === "xtransfer"
      ? `<p>Please transfer <b>USD ${(o.total / 100).toFixed(2)}</b> via bank transfer using reference <b>${esc(o.number)}</b>, then upload your receipt on your order page. Bank details are shown there.</p>`
      : o.paymentMethod === "paypal"
        ? `<p>If you haven’t finished paying with PayPal yet, you can do it from your order page.</p>`
        : `<p>Your order is reserved. Finish it in the chat on our website — confirm your delivery details and pay by PayPal or bank transfer — or from your order page below.</p>`;
  const rxLater = o.items.some((i) => i.prescription.includes('"mode":"later"'))
    ? `<p style="background:#eef4ff;padding:12px;border-radius:8px">You chose to send your prescription later — simply reply to this email with a photo of it.</p>`
    : "";
  return sendMail(
    o.email,
    `Order ${o.number} confirmed — invoice ${invoiceNumber(o)} — ${store.name}`,
    await layout(`Thanks for your order, ${o.name.split(" ")[0]}!`, `<p>Order <b>${esc(o.number)}</b> is confirmed. Your invoice <b>${esc(invoiceNumber(o))}</b> is attached as a PDF.</p>${pay}${rxLater}${itemsTable(o)}${btn(orderLink(o), "View your order")}<p style="font-size:13px"><a href="${esc(invoiceLink(o))}">Download invoice (PDF)</a></p><p style="font-size:12px;color:#5a6b8c">Import duties/taxes may be collected by DHL on delivery.</p>`),
    await invoiceAttachment(o),
  );
}

export async function emailPaymentReceipt(o: O) {
  return sendMail(o.email, `Payment received — paid invoice ${invoiceNumber(o)}`, await layout("Payment received — thank you!", `<p>We’ve received <b>${usd(o.total)}</b> for order <b>${esc(o.number)}</b> by ${o.paymentMethod === "paypal" ? "PayPal" : o.paymentMethod === "xtransfer" ? "bank transfer" : esc(o.paymentMethod)}. This email is your receipt.</p>${itemsTable(o)}<p>Next: we’ll ${o.lensTotal ? "cut and fit your lenses, " : ""}quality-check and dispatch your order by DHL Express. You’ll get your tracking number by email.</p><p>Your <b>paid invoice</b> is attached.</p>${btn(orderLink(o), "Track your order")}`), await invoiceAttachment(o));
}

/** XTransfer: the customer uploaded a transfer receipt. */
export async function emailReceiptUploaded(o: O) {
  const { store } = await getSettings();
  return sendMail(o.email, `We received your transfer receipt — order ${o.number}`, await layout("Transfer receipt received", `<p>Thank you, ${esc(o.name.split(" ")[0])}! We’ve received your bank-transfer receipt for order <b>${esc(o.number)}</b> (${usd(o.total)}).</p><p>Our team will match it with our bank account and confirm within 1 business day. You’ll then receive your paid invoice by email.</p>${btn(orderLink(o), "View your order")}<p style="font-size:12px;color:#5a6b8c">Questions? Reply to this email or chat with ${esc(store.name)} on our website.</p>`));
}

export async function emailShipped(o: O) {
  if (!o.trackingNumber) return false;
  return sendMail(o.email, `Your order ${o.number} has shipped`, await layout("Your glasses are on the way!", `<p>Order <b>${esc(o.number)}</b> has shipped with DHL Express.</p><p>Tracking number: <b>${esc(o.trackingNumber)}</b></p>${btn(trackingUrl(o.trackingNumber), "Track with DHL")}<p style="font-size:13px;color:#5a6b8c">DHL may contact you by phone or email to arrange delivery or collect import duties.</p>`));
}

/** Admin → "Send payment link": for manual / WhatsApp orders. */
export async function emailPaymentRequest(o: O) {
  const { store } = await getSettings();
  return sendMail(o.email, `Your order ${o.number} from ${store.name} — payment link`, await layout(`Your order is ready, ${o.name.split(" ")[0]}`, `<p>Here are the details of your order <b>${esc(o.number)}</b>. You can pay securely by PayPal or bank transfer on your order page.</p>${itemsTable(o)}${btn(orderLink(o), "View order & pay")}`));
}
