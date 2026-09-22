import "server-only";
import PDFDocument from "pdfkit";
import type { Order, OrderItem } from "@prisma/client";
import { getSettings } from "./settings";
import { countryName } from "./countries";
import { site } from "./site";
import { bankReady } from "./settings-shared";

type O = Order & { items: OrderItem[] };

const money = (c: number) => `US$${(c / 100).toFixed(2)}`;
const NAVY = "#0a2463";
const MUTED = "#5b6b8a";
const LINE = "#dce6f6";

export const invoiceNumber = (o: Order) => `INV-${o.number}`;

/** Builds the invoice PDF for an order (used for email attachments and downloads). */
export async function buildInvoicePdf(o: O): Promise<Buffer> {
  const { store, shipping: from, payments } = await getSettings();
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Invoice ${invoiceNumber(o)}`, Author: store.name } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const W = doc.page.width - 96;
  const paid = o.paymentStatus === "paid";
  const refunded = o.paymentStatus === "refunded";

  // ---- header band ----
  doc.rect(0, 0, doc.page.width, 110).fill(NAVY);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20).text(store.name, 48, 36, { width: W * 0.62 });
  doc.font("Helvetica").fontSize(9).fillColor("#cfe0ff")
    .text([from.fromAddress && !/^TODO/i.test(from.fromAddress) ? from.fromAddress : "", [from.fromCity, from.fromPostcode].filter(Boolean).join(" "), countryName(from.fromCountry) || from.fromCountry].filter(Boolean).join(", "), 48, 64, { width: W * 0.62 })
    .text(`${store.email}  ·  ${store.phone}`, { width: W * 0.62 });
  doc.font("Helvetica-Bold").fontSize(26).fillColor("#ffffff").text("INVOICE", 48, 34, { width: W, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor("#cfe0ff").text(invoiceNumber(o), 48, 66, { width: W, align: "right" });

  // ---- status + meta ----
  let y = 132;
  const status = refunded ? "REFUNDED" : paid ? "PAID" : o.paymentStatus === "awaiting_verification" ? "PAYMENT BEING VERIFIED" : "AWAITING PAYMENT";
  const statusColor = paid ? "#0f9d58" : refunded ? "#dc2626" : "#d97706";
  doc.roundedRect(48, y, 170, 24, 12).fill(statusColor);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(10).text(status, 48, y + 7, { width: 170, align: "center" });

  const meta: [string, string][] = [
    ["Invoice date", o.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })],
    ["Order number", o.number],
    ...(paid && o.paidAt ? [["Paid on", o.paidAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })] as [string, string]] : []),
    ["Currency", "USD"],
  ];
  let my = y - 2;
  for (const [k, v] of meta) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(k, 330, my, { width: 90 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0b1b3f").text(v, 420, my, { width: W - 372, align: "right" });
    my += 15;
  }
  y = Math.max(y + 44, my + 12);

  // ---- bill to / ship to ----
  const block = (title: string, lines: string[], x: number) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(title.toUpperCase(), x, y, { characterSpacing: 1 });
    doc.font("Helvetica").fontSize(10).fillColor("#0b1b3f").text(lines.filter(Boolean).join("\n"), x, y + 14, { width: W / 2 - 16, lineGap: 2 });
  };
  block("Bill to", [o.name, o.email, o.phone], 48);
  block("Ship to", [o.name, o.line1, o.line2, [o.city, o.state, o.postcode].filter(Boolean).join(" "), countryName(o.country), o.customsId ? `Customs ID: ${o.customsId}` : ""], 48 + W / 2);
  y += 100;

  // ---- items table ----
  const cols = { desc: 48, qty: 330, unit: 390, total: 470 };
  doc.rect(48, y, W, 24).fill("#f3f7ff");
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9);
  doc.text("DESCRIPTION", cols.desc + 8, y + 8).text("QTY", cols.qty, y + 8, { width: 40, align: "right" }).text("UNIT", cols.unit, y + 8, { width: 70, align: "right" }).text("AMOUNT", cols.total, y + 8, { width: W + 48 - cols.total - 8, align: "right" });
  y += 30;
  for (const it of o.items) {
    const extra = [it.lensName !== "Frame only" ? it.lensName : "", it.coatings].filter(Boolean).join(" + ");
    const desc = `${it.name} — ${it.colorName}`;
    const sub = `SKU ${it.sku}${extra ? ` · ${extra}` : " · Frame"}`;
    const unit = it.unitPrice + it.lensPrice;
    const h = Math.max(30, doc.heightOfString(desc, { width: 270 }) + 18);
    if (y + h > doc.page.height - 190) {
      doc.addPage();
      y = 48;
    }
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0b1b3f").text(desc, cols.desc + 8, y, { width: 270 });
    doc.font("Helvetica").fontSize(8.5).fillColor(MUTED).text(sub, cols.desc + 8, doc.y + 1, { width: 270 });
    doc.font("Helvetica").fontSize(10).fillColor("#0b1b3f")
      .text(String(it.qty), cols.qty, y, { width: 40, align: "right" })
      .text(money(unit), cols.unit, y, { width: 70, align: "right" })
      .text(money(unit * it.qty), cols.total, y, { width: W + 48 - cols.total - 8, align: "right" });
    y += h;
    doc.moveTo(48, y - 6).lineTo(48 + W, y - 6).strokeColor(LINE).lineWidth(1).stroke();
  }

  // ---- totals ----
  y += 6;
  const tRow = (label: string, value: string, bold = false, color = "#0b1b3f") => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10).fillColor(bold ? NAVY : MUTED).text(label, 330, y, { width: 130 });
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10).fillColor(color).text(value, 460, y, { width: W + 48 - 460 - 8, align: "right" });
    y += bold ? 22 : 17;
  };
  tRow("Frames", money(o.subtotal));
  if (o.bundleDiscount) tRow("Bundle saving", `−${money(o.bundleDiscount)}`, false, "#0f9d58");
  if (o.lensTotal) tRow("Upgrades & lenses", money(o.lensTotal));
  tRow(o.dhlServiceName || "Shipping", o.shipping ? money(o.shipping) : "Free");
  if (o.adjustment) tRow(o.adjustment < 0 ? "Discount" : "Adjustment", `${o.adjustment < 0 ? "−" : "+"}${money(Math.abs(o.adjustment))}`, false, o.adjustment < 0 ? "#0f9d58" : "#0b1b3f");
  doc.moveTo(330, y).lineTo(48 + W, y).strokeColor(NAVY).lineWidth(1.2).stroke();
  y += 8;
  tRow(paid ? "Total paid" : "Total due", money(o.total), true);

  // ---- payment block ----
  y += 12;
  const method = o.paymentMethod === "paypal" ? "PayPal" : o.paymentMethod === "xtransfer" ? "Bank transfer (XTransfer)" : o.paymentMethod === "pending" ? "Not chosen yet" : o.paymentMethod;
  doc.roundedRect(48, y, W, paid ? 44 : 92, 8).strokeColor(LINE).lineWidth(1).stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text("Payment", 62, y + 12);
  doc.font("Helvetica").fontSize(9.5).fillColor("#0b1b3f").text(paid ? `Paid by ${method}${o.paypalCaptureId ? ` · transaction ${o.paypalCaptureId}` : ""}.` : `Method: ${method}. Pay by PayPal or bank transfer from your order page or in the chat on our website.`, 62, y + 27, { width: W - 28 });
  if (!paid && bankReady(payments)) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
      `Bank transfer: ${payments.xtransferBeneficiary} · ${payments.xtransferBank} · Account ${payments.xtransferAccount} · SWIFT ${payments.xtransferSwift} · Reference ${o.number}`,
      62, y + 55, { width: W - 28 },
    );
  }

  // ---- footer ----
  const fy = doc.page.height - 86;
  doc.moveTo(48, fy).lineTo(48 + W, fy).strokeColor(LINE).lineWidth(1).stroke();
  doc.font("Helvetica-Bold").fontSize(10).fillColor(NAVY).text(`Thank you for shopping with ${store.name}!`, 48, fy + 12, { width: W, align: "center" });
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(
    `Shipped DAP from ${from.fromCity || "Wenzhou"}, China. Import duties or taxes, if any, are charged by your country's customs and collected by the courier on delivery. ${site.url}`,
    48, fy + 28, { width: W, align: "center" },
  );

  doc.end();
  return done;
}
