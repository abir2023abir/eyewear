import "server-only";
import { getSettings } from "./settings";

async function cfg() {
  const { payments, store } = await getSettings();
  return {
    base: payments.paypalMode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com",
    clientId: payments.paypalClientId,
    secret: payments.paypalSecret,
    webhookId: payments.paypalWebhookId,
    enabled: payments.paypalEnabled,
    brand: store.name.slice(0, 127),
  };
}

export async function paypalConfigured() {
  const c = await cfg();
  return !!(c.enabled && c.clientId && c.secret);
}

let tokenCache: { key: string; token: string; exp: number } | null = null;

async function token() {
  const c = await cfg();
  if (!c.clientId || !c.secret) throw new Error("PayPal keys are not set (Admin → Settings → Payments)");
  const key = `${c.base}|${c.clientId}`;
  if (tokenCache && tokenCache.key === key && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const r = await fetch(`${c.base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${c.clientId}:${c.secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error_description || "PayPal authentication failed — check the Client ID, Secret and Live/Sandbox mode.");
  tokenCache = { key, token: j.access_token, exp: Date.now() + (j.expires_in || 300) * 1000 };
  return j.access_token as string;
}

async function call(path: string, init: RequestInit & { idem?: string } = {}) {
  const c = await cfg();
  const r = await fetch(`${c.base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      ...(init.idem ? { "PayPal-Request-Id": init.idem } : {}),
      ...(init.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

/** Admin → Settings → "Test PayPal connection". */
export async function testPaypal(): Promise<{ ok: boolean; error?: string; mode?: string }> {
  try {
    await token();
    return { ok: true, mode: (await cfg()).base.includes("sandbox") ? "sandbox" : "live" };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export async function createPaypalOrder(o: { id: string; number: string; total: number }) {
  const c = await cfg();
  const { ok, j } = await call("/v2/checkout/orders", {
    method: "POST",
    idem: `create-${o.number}-${o.total}`,
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: o.number,
          invoice_id: o.number,
          custom_id: o.id,
          description: `Order ${o.number}`,
          amount: { currency_code: "USD", value: (o.total / 100).toFixed(2) },
        },
      ],
      payment_source: {
        paypal: { experience_context: { brand_name: c.brand, shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } },
      },
    }),
  });
  if (!ok) throw new Error(j?.details?.[0]?.description || j?.message || "PayPal create failed");
  return j.id as string;
}

export type CaptureResult = { status: string; captureId?: string; amountCents: number; currency?: string; declined?: boolean };

function readCapture(j: any): CaptureResult {
  const cap = j?.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    status: (cap?.status || j?.status || "UNKNOWN") as string,
    captureId: cap?.id,
    amountCents: cap ? Math.round(parseFloat(cap.amount.value) * 100) : 0,
    currency: cap?.amount?.currency_code,
  };
}

export async function capturePaypalOrder(paypalOrderId: string): Promise<CaptureResult> {
  const { ok, j } = await call(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, { method: "POST", idem: `capture-${paypalOrderId}` });
  const issue = j?.details?.[0]?.issue;
  if (!ok && issue === "ORDER_ALREADY_CAPTURED") return getPaypalOrder(paypalOrderId);
  if (!ok && issue === "INSTRUMENT_DECLINED") return { status: "DECLINED", amountCents: 0, declined: true };
  if (!ok) throw new Error(j?.details?.[0]?.description || j?.message || "PayPal capture failed");
  return readCapture(j);
}

/** Looks up a PayPal order (used by the admin "Check PayPal payment" button and the webhook). */
export async function getPaypalOrder(paypalOrderId: string): Promise<CaptureResult & { orderStatus?: string }> {
  const { ok, j } = await call(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, { method: "GET" });
  if (!ok) throw new Error(j?.message || "PayPal lookup failed");
  return { ...readCapture(j), orderStatus: j.status };
}

/** Verifies a webhook really came from PayPal (https://developer.paypal.com/api/rest/webhooks/rest/). */
export async function verifyWebhook(headers: Headers, event: unknown) {
  const c = await cfg();
  if (!c.webhookId) return false;
  const { ok, j } = await call("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: c.webhookId,
      webhook_event: event,
    }),
  });
  return ok && j?.verification_status === "SUCCESS";
}
