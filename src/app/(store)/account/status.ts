type O = { status: string; paymentStatus: string; paymentMethod: string; trackingNumber?: string | null };

/** One plain-language label + colour + "what to do next" for a customer's order. */
export function orderState(o: O): { label: string; tone: "ok" | "warn" | "bad" | "light"; next: string } {
  if (o.status === "cancelled") return { label: "Cancelled", tone: "bad", next: "" };
  if (o.paymentStatus === "refunded") return { label: "Refunded", tone: "bad", next: "" };
  if (o.status === "delivered") return { label: "Delivered", tone: "ok", next: "" };
  if (o.status === "shipped") return { label: "Shipped", tone: "ok", next: o.trackingNumber ? "Track your parcel" : "" };
  if (o.status === "processing") return { label: "Being made", tone: "light", next: "" };
  if (o.paymentStatus === "paid") return { label: "Paid — preparing", tone: "ok", next: "" };
  if (o.paymentStatus === "awaiting_verification") return { label: "Checking your transfer", tone: "warn", next: "" };
  if (o.paymentMethod === "pending") return { label: "Awaiting payment", tone: "warn", next: "Finish in chat" };
  return { label: "Awaiting payment", tone: "warn", next: "Pay now" };
}

export const orderLink = (o: { number: string; accessToken: string }) => `/order/${o.number}?t=${o.accessToken}`;
export const invoiceLink = (o: { number: string; accessToken: string }) => `/api/orders/${o.number}/invoice?t=${o.accessToken}`;
