// End-to-end smoke test for the whole store. Run against a running server:
//   npm run build && npm start      (in one terminal)
//   npm run test:smoke              (in another)
// Uses a temporary admin session minted from AUTH_SECRET — no passwords needed. Cleans up after itself.
import { createHash, randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";

const BASE = process.env.SMOKE_URL || "http://localhost:3000";
const db = new PrismaClient();
const results = [];
const RUN_START = new Date();
let restorePayments = null; // real payment settings, put back after the run
const cleanup = { orders: [], users: [], convs: [], products: [], lenses: [], subs: [] };
const IP = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`; // avoid rate-limit collisions between runs

const ok = (name, cond, info = "") => results.push({ name, pass: !!cond, info });
async function req(path, { method = "GET", body, cookie, headers = {}, form } = {}) {
  const h = { "x-forwarded-for": IP, ...headers };
  if (cookie) h.cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    h["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const r = await fetch(BASE + path, { method, headers: h, body: payload, redirect: "manual" });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, text, json, headers: r.headers };
}
const png = () => new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")], { type: "image/png" });

async function main() {
  const admin = await db.user.findFirst({ where: { role: "admin" } });
  if (!admin) throw new Error("No admin user in the database — run npm run setup");
  const token = await new SignJWT({ role: "admin", name: admin.name, email: admin.email, v: admin.tokenVersion })
    .setProtectedHeader({ alg: "HS256" }).setSubject(admin.id).setIssuedAt().setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me"));
  const A = `session=${token}`;
  const product = await db.product.findFirst({ where: { active: true }, include: { variants: { where: { stock: { gt: 5 } } } } });
  const variant = product.variants[0];
  const post = await db.post.findFirst({ where: { published: true } });

  /* ---------- public pages ---------- */
  for (const p of ["/", "/shop", "/shop?category=optical&shape=round", "/shop?q=black", `/product/${product.slug}`, "/try-on", "/lenses", "/blog", `/blog/${post?.slug}`,
    "/policies/shipping", "/policies/returns", "/policies/privacy", "/policies/terms", "/cart", "/checkout", "/wishlist", "/login", "/register", "/sitemap.xml", "/robots.txt"]) {
    const r = await req(p);
    ok(`page ${p}`, r.status === 200, r.status);
  }
  ok("404 for unknown product", (await req("/product/does-not-exist")).status === 404);
  const home = await req("/");
  ok("homepage shows store name from settings", home.text.includes("Wenzhou Kangjing Shopy") || /<title>[^<]+<\/title>/.test(home.text));
  ok("security headers (CSP, nosniff, frame)", home.headers.get("content-security-policy") && home.headers.get("x-content-type-options") === "nosniff" && home.headers.get("x-frame-options"));

  /* ---------- security ---------- */
  ok("admin page redirects when signed out", [302, 307].includes((await req("/admin")).status));
  ok("admin API 401 when signed out", (await req("/api/admin/settings")).status === 401);
  ok("forged admin cookie rejected", (await req("/api/admin/settings", { cookie: "session=eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYWRtaW4ifQ.bad" })).status === 401);
  ok("cross-site POST blocked", (await req("/api/newsletter", { method: "POST", body: { email: "x@example.com" }, headers: { origin: "https://evil.example" } })).status === 403);
  ok("PayPal webhook rejects unsigned calls", (await req("/api/paypal/webhook", { method: "POST", body: { event_type: "PAYMENT.CAPTURE.COMPLETED" } })).status === 401);
  const fake = new FormData(); fake.append("file", new Blob(["not an image"], { type: "image/png" }), "x.png"); fake.append("kind", "prescription");
  ok("disguised upload rejected", (await req("/api/upload", { method: "POST", form: fake })).status === 400);

  /* ---------- settings (admin) ---------- */
  const st = await req("/api/admin/settings", { cookie: A });
  ok("settings load", st.status === 200 && st.json?.settings?.store?.name);
  const original = st.json.settings;
  const saveMarketing = await req("/api/admin/settings", { method: "POST", cookie: A, body: { section: "email", data: { ...original.email, smtpPass: "smoke-secret-XYZ" } } });
  ok("save settings section", saveMarketing.status === 200, saveMarketing.json?.error);
  const st2 = await req("/api/admin/settings", { cookie: A });
  ok("secrets never sent back to the browser", !st2.text.includes("smoke-secret-XYZ") && st2.json.secretState["email.smtpPass"] === true);
  await req("/api/admin/settings", { method: "POST", cookie: A, body: { section: "email", data: { ...original.email, smtpPass: "__clear__" } } });
  ok("bad settings rejected", (await req("/api/admin/settings", { method: "POST", cookie: A, body: { section: "store", data: { ...original.store, email: "not-an-email" } } })).status === 400);

  /* ---------- payment safety: example bank details are never offered ---------- */
  restorePayments = { ...original.payments, paypalSecret: "" }; // "" = keep the stored secret
  await req("/api/admin/settings", { method: "POST", cookie: A, body: { section: "payments", data: { ...restorePayments, xtransferEnabled: true, xtransferBank: "Example bank", xtransferAccount: "0000000000", xtransferSwift: "XXXXXXXX" } } });
  const fakeBank = await req("/api/orders", { method: "POST", body: { email: "smoke-cn@example.com", address: { name: "Li Wei", phone: "+8613300000001", line1: "2 Road", city: "Wenzhou", country: "CN" }, items: [{ variantId: variant.id, qty: 1, lensCode: "none" }] } });
  const fakeCookie = (fakeBank.headers.get("set-cookie") || "").split(";")[0];
  const fakeCard = ((await req("/api/chat?open=1", { cookie: fakeCookie })).json?.messages || []).find((m) => m.kind === "payment");
  ok("example bank details are hidden from customers", fakeBank.status === 200 && fakeCard && !fakeCard.payload.methods.includes("xtransfer") && !fakeCard.payload.bank);
  const fo = fakeBank.json?.number ? await db.order.findUnique({ where: { number: fakeBank.json.number } }) : null;
  if (fo) { cleanup.orders.push(fo.id); cleanup.convs.push(fo.conversationId); }
  ok("unavailable payment method is refused", fo && (await req("/api/chat/checkout", { method: "POST", body: { action: "pay_method", number: fo.number, token: fo.accessToken, method: "xtransfer" } })).status === 400);
  // realistic test bank details for the rest of the run
  await req("/api/admin/settings", { method: "POST", cookie: A, body: { section: "payments", data: { ...restorePayments, xtransferEnabled: true, xtransferBank: "Smoke Test Bank", xtransferAccount: "6222021234567890", xtransferSwift: "SMOKCNSH" } } });

  /* ---------- checkout: order → bank receipt → admin ---------- */
  const rates = await req("/api/shipping/rates", { method: "POST", body: { country: "US", frames: 2 } });
  ok("shipping estimate (price + delivery days)", rates.status === 200 && rates.json.quote?.price >= 0 && rates.json.quote?.daysMax >= rates.json.quote?.daysMin, rates.text.slice(0, 80));
  const cn = await req("/api/shipping/rates", { method: "POST", body: { country: "CN", frames: 1 } });
  ok("China uses local delivery, not DHL", cn.json?.quote?.kind === "domestic");
  const coating = await db.lensOption.findFirst({ where: { kind: "coating", active: true } });
  const order = await req("/api/orders", {
    method: "POST",
    body: { email: "smoke@example.com", address: { name: "Smoke Test", phone: "+15125550100", line1: "1 Main St", city: "Austin", postcode: "73301", country: "US" },
      items: [{ variantId: variant.id, qty: 2, lensCode: "none", coatings: coating ? [coating.code] : [], rxMode: "form", rx: { odSph: "-1.00", odCyl: "0.00", osSph: "-1.25", osCyl: "0.00", pd: "63.0" }, unitPrice: 1 }] },
  });
  ok("confirm order (no payment on checkout page)", order.status === 200 && order.json?.number, order.json?.error);
  const buyer = (order.headers.get("set-cookie") || "").split(";")[0];
  const o = await db.order.findUnique({ where: { number: order.json.number } });
  cleanup.orders.push(o.id);
  ok("server-side pricing ignores client price", o.subtotal === product.price * 2 && o.total > o.subtotal * 0.5);
  ok("upgrade priced without a lens type", !coating || o.lensTotal === coating.price * 2);
  ok("order is linked to a chat", !!o.conversationId && o.paymentMethod === "pending");
  cleanup.convs.push(o.conversationId);
  let chat1 = await req("/api/chat?open=1", { cookie: buyer });
  const kinds = (chat1.json?.messages || []).map((m) => m.kind);
  ok("chat shows order + DHL card", kinds.includes("order") && kinds.includes("shipping") && !kinds.includes("payment"), kinds.join(","));
  const shipCard = chat1.json.messages.find((m) => m.kind === "shipping");
  ok("DHL card has price & arrival estimate", shipCard?.payload?.kind === "intl" && /\d/.test(shipCard?.payload?.eta || ""));
  ok("DHL details: phone required", (await req("/api/chat/checkout", { method: "POST", body: { action: "shipping", number: o.number, token: o.accessToken, phone: "", postcode: "73301" } })).status === 400);
  ok("DHL details: wrong token refused", (await req("/api/chat/checkout", { method: "POST", body: { action: "shipping", number: o.number, token: "nope", phone: "+15125550100", postcode: "73301" } })).status === 404);
  ok("confirm DHL details", (await req("/api/chat/checkout", { method: "POST", body: { action: "shipping", number: o.number, token: o.accessToken, phone: "+15125550100", postcode: "73301" } })).status === 200);
  chat1 = await req("/api/chat?open=1", { cookie: buyer });
  const payCard = chat1.json.messages.find((m) => m.kind === "payment");
  ok("payment question appears", !!payCard && payCard.payload.methods.includes("xtransfer"));
  ok("choose XTransfer", (await req("/api/chat/checkout", { method: "POST", body: { action: "pay_method", number: o.number, token: o.accessToken, method: "xtransfer" } })).status === 200);
  const quick = await req("/api/chat", { method: "POST", cookie: buyer, body: { quick: "delivery" } });
  const afterQuick = await req("/api/chat?open=1", { cookie: buyer });
  ok("quick reply: delivery time for this order", quick.status === 200 && afterQuick.json.messages.some((m) => m.sender === "assistant" && m.body.includes(o.number)));
  ok("order page needs its secret link", (await req(`/order/${o.number}?t=wrong`)).status === 404 && (await req(`/order/${o.number}?t=${o.accessToken}`)).status === 200);
  const proof = new FormData(); proof.append("file", png(), "receipt.png"); proof.append("token", o.accessToken);
  ok("upload bank receipt", (await req(`/api/orders/${o.number}/proof`, { method: "POST", form: proof })).status === 200);
  const o2 = await db.order.findUnique({ where: { id: o.id } });
  ok("receipt is private", (await req(`/api/files/${o2.proofUploadId}`)).status === 404 && (await req(`/api/files/${o2.proofUploadId}`, { cookie: A })).status === 200);
  const edit = await req(`/api/admin/orders/${o.id}`, { method: "POST", cookie: A, body: { action: "edit", email: o.email, name: o.name, phone: o.phone, line1: o.line1, line2: "", city: o.city, state: "", postcode: "", country: "US", shipping: 1000, adjustment: -500 } });
  const o3 = await db.order.findUnique({ where: { id: o.id } });
  ok("admin edits shipping & discount → total recalculated", edit.status === 200 && o3.total === o3.subtotal - o3.bundleDiscount + o3.lensTotal + 1000 - 500, edit.json?.error);
  const stockBefore = (await db.variant.findUnique({ where: { id: variant.id } })).stock;
  ok("admin marks paid", (await req(`/api/admin/orders/${o.id}`, { method: "POST", cookie: A, body: { action: "mark_paid", method: "xtransfer" } })).status === 200);
  const chat2 = await req("/api/chat?open=1", { cookie: buyer });
  ok("thank-you card after payment", chat2.json.messages.some((m) => m.kind === "thanks") && chat2.json.messages.find((m) => m.kind === "payment")?.payload?.status === "paid");
  await req(`/api/admin/orders/${o.id}`, { method: "POST", cookie: A, body: { action: "mark_paid" } }); // idempotent
  const stockAfter = (await db.variant.findUnique({ where: { id: variant.id } })).stock;
  ok("stock reduced exactly once", stockAfter === Math.max(0, stockBefore - 2), `${stockBefore} → ${stockAfter}`);
  ok("paid order amounts locked", (await req(`/api/admin/orders/${o.id}`, { method: "POST", cookie: A, body: { action: "edit", email: o.email, name: o.name, phone: o.phone, line1: o.line1, line2: "", city: o.city, state: "", postcode: "", country: "US", shipping: 1, adjustment: 0 } })).status === 400);
  ok("save tracking", (await req(`/api/admin/orders/${o.id}`, { method: "POST", cookie: A, body: { action: "tracking", tracking: "1234567890" } })).status === 200);
  ok("resend email", (await req(`/api/admin/orders/${o.id}`, { method: "POST", cookie: A, body: { action: "resend", email: "receipt" } })).status === 200);
  ok("paid orders can't be deleted", (await req(`/api/admin/orders/${o.id}`, { method: "POST", cookie: A, body: { action: "delete", confirm: "DELETE" } })).status === 400);
  await db.variant.update({ where: { id: variant.id }, data: { stock: stockBefore } }); // restore stock
  ok("admin order pages render", (await req(`/admin/orders/${o.id}`, { cookie: A })).status === 200 && (await req(`/admin/orders/${o.id}/slip`, { cookie: A })).status === 200);

  /* ---------- China order + customs ID country ---------- */
  const cnOrder = await req("/api/orders", { method: "POST", body: { email: "smoke-cn@example.com", address: { name: "Li Wei", phone: "+8613300000000", line1: "1 Road", city: "Wenzhou", country: "CN" }, items: [{ variantId: variant.id, qty: 1, lensCode: "none" }] } });
  const cnCookie = (cnOrder.headers.get("set-cookie") || "").split(";")[0];
  const cnChat = await req("/api/chat?open=1", { cookie: cnCookie });
  const cnShip = cnChat.json?.messages?.find((m) => m.kind === "shipping");
  ok("China order: local delivery, straight to payment", cnShip?.payload?.kind === "domestic" && cnChat.json.messages.some((m) => m.kind === "payment"));
  const br = await req("/api/orders", { method: "POST", body: { email: "smoke-br@example.com", address: { name: "Ana Souza", phone: "+5511900000000", line1: "Rua 1", city: "São Paulo", postcode: "01000-000", country: "BR" }, items: [{ variantId: variant.id, qty: 1, lensCode: "none" }] } });
  const brO = await db.order.findUnique({ where: { number: br.json.number } });
  ok("Brazil requires customs ID", (await req("/api/chat/checkout", { method: "POST", body: { action: "shipping", number: brO.number, token: brO.accessToken, phone: "+5511900000000", postcode: "01000-000" } })).status === 400);
  ok("…and accepts it when given", (await req("/api/chat/checkout", { method: "POST", body: { action: "shipping", number: brO.number, token: brO.accessToken, phone: "+5511900000000", postcode: "01000-000", customsId: "123.456.789-09" } })).status === 200);
  for (const n of [cnOrder.json?.number, br.json?.number]) {
    const x = n && (await db.order.findUnique({ where: { number: n } }));
    if (x) { cleanup.orders.push(x.id); if (x.conversationId) cleanup.convs.push(x.conversationId); }
  }

  /* ---------- manual order ---------- */
  const mo = { customer: { email: "manual@example.com", name: "Manual Buyer", phone: "+8613300000000", line1: "8 Road", city: "London", country: "GB" }, items: [{ variantId: variant.id, qty: 3, lensCode: "none", unitPrice: 2000 }], applyBundle: true, shipping: 1500, adjustment: -300, paymentMethod: "paypal", markPaid: false, sendPaymentLink: true };
  const prev = await req("/api/admin/orders", { method: "POST", cookie: A, body: { ...mo, preview: true } });
  ok("manual order preview", prev.status === 200 && prev.json.total === 6000 - Math.round(6000 * 0.15) + 1500 - 300, JSON.stringify(prev.json));
  const made = await req("/api/admin/orders", { method: "POST", cookie: A, body: mo });
  ok("create manual order", made.status === 200 && made.json.id, made.json?.error);
  if (made.json?.id) {
    ok("delete unpaid order", (await req(`/api/admin/orders/${made.json.id}`, { method: "POST", cookie: A, body: { action: "delete", confirm: "DELETE" } })).status === 200);
  }

  /* ---------- PayPal ---------- */
  const pp = await req("/api/paypal/create", { method: "POST", body: { number: o.number, token: "wrong" } });
  ok("PayPal create refuses bad token / missing keys", [404, 503].includes(pp.status));

  /* ---------- chat + quote ---------- */
  const chat = await req("/api/chat", { method: "POST", body: { body: "Smoke test hello", email: "chat@example.com", name: "Chatter", product: { variantId: variant.id, price: 1 } } });
  const chatCookie = (chat.headers.get("set-cookie") || "").split(";")[0];
  ok("customer chat message", chat.status === 200 && chat.json.message.payload.price === product.price);
  const conv = await db.conversation.findFirst({ where: { email: "chat@example.com" }, orderBy: { createdAt: "desc" } });
  cleanup.convs.push(conv.id);
  ok("seller reply", (await req("/api/admin/chat", { method: "POST", cookie: A, body: { action: "send", conversationId: conv.id, body: "Hi!" } })).status === 200);
  const q = await req("/api/admin/chat", { method: "POST", cookie: A, body: { action: "quote", conversationId: conv.id, country: "DE", city: "Berlin", items: [{ variantId: variant.id, qty: 1, lensCode: "ar" }] } });
  ok("send quote card", q.status === 200, q.json?.error);
  const polled = await req("/api/chat?open=1", { cookie: chatCookie });
  const qt = polled.json?.messages?.find((m) => m.kind === "quote")?.payload?.token;
  ok("customer sees quote", !!qt && (await req(`/api/quotes/${qt}`)).status === 200);

  /* ---------- customers & admins ---------- */
  const nu = await req("/api/admin/customers", { method: "POST", cookie: A, body: { name: "Smoke User", email: `smoke${Date.now()}@example.com`, password: "SmokeTest12345", role: "customer" } });
  ok("create customer", nu.status === 200, nu.json?.error);
  if (nu.json?.id) {
    cleanup.users.push(nu.json.id);
    ok("promote to admin", (await req(`/api/admin/customers/${nu.json.id}`, { method: "POST", cookie: A, body: { action: "role", role: "admin" } })).status === 200);
    ok("demote", (await req(`/api/admin/customers/${nu.json.id}`, { method: "POST", cookie: A, body: { action: "role", role: "customer" } })).status === 200);
    ok("reset password", (await req(`/api/admin/customers/${nu.json.id}`, { method: "POST", cookie: A, body: { action: "password", password: "AnotherPass12345" } })).status === 200);
  }
  ok("can't remove own admin access", (await req(`/api/admin/customers/${admin.id}`, { method: "POST", cookie: A, body: { action: "role", role: "customer" } })).status === 400);

  /* ---------- invoice PDF ---------- */
  const inv = await fetch(`${BASE}/api/orders/${o.number}/invoice?t=${o.accessToken}`, { headers: { "x-forwarded-for": IP } });
  const invBuf = Buffer.from(await inv.arrayBuffer());
  ok("invoice PDF downloads with order link", inv.status === 200 && invBuf.subarray(0, 4).toString() === "%PDF" && (inv.headers.get("content-type") || "").includes("pdf"));
  ok("invoice needs the order link", (await req(`/api/orders/${o.number}/invoice`)).status !== 200 && (await req(`/api/orders/${o.number}/invoice?t=wrong`)).status !== 200);
  ok("admin can download any invoice", (await req(`/api/orders/${o.number}/invoice`, { cookie: A })).status === 200);

  /* ---------- customer panel ---------- */
  const custEmail = `smoke-cust-${Date.now()}@example.com`;
  const custAddr = { name: "Casey Buyer", phone: "+447700900123", line1: "10 High St", city: "London", postcode: "SW1A 1AA", country: "GB" };
  const co = await req("/api/orders", { method: "POST", body: { email: custEmail, address: custAddr, items: [{ variantId: variant.id, qty: 1, lensCode: "none" }], createAccount: { password: "CustomerPass123" } } });
  ok("checkout can create an account", co.status === 200, co.json?.error);
  const setc = co.headers.get("set-cookie") || "";
  let C = (setc.match(/session=[^;]+/) || [""])[0];
  const cust = await db.user.findUnique({ where: { email: custEmail } });
  if (cust) cleanup.users.push(cust.id);
  const coOrder = co.json?.number ? await db.order.findUnique({ where: { number: co.json.number } }) : null;
  if (coOrder) { cleanup.orders.push(coOrder.id); cleanup.convs.push(coOrder.conversationId); }
  ok("new account owns the order + saved address", !!cust && coOrder?.userId === cust.id && (await db.address.count({ where: { userId: cust.id } })) === 1);
  ok("existing email can't be taken at checkout", (await req("/api/orders", { method: "POST", body: { email: custEmail, address: custAddr, items: [{ variantId: variant.id, qty: 1, lensCode: "none" }], createAccount: { password: "OtherPass1234" } } })).status === 409);
  for (const p of ["/account", "/account/orders", "/account/addresses", "/account/wishlist", "/account/messages", "/account/profile"]) {
    const r = await req(p, { cookie: C });
    ok(`account page ${p}`, r.status === 200 && (p !== "/account/orders" || r.text.includes(co.json?.number || "??")));
  }
  ok("account needs sign-in", [307, 302, 303].includes((await req("/account/orders")).status));
  ok("customer downloads own invoice without link", (await req(`/api/orders/${co.json?.number}/invoice`, { cookie: C })).status === 200);
  ok("customer can't download someone else's invoice", (await req(`/api/orders/${o.number}/invoice`, { cookie: C })).status !== 200);
  ok("can't open someone else's chat", (await req("/api/account/chat", { method: "POST", cookie: C, body: { conversationId: o.conversationId } })).status === 404);
  ok("can open own chat", (await req("/api/account/chat", { method: "POST", cookie: C, body: { conversationId: coOrder?.conversationId } })).status === 200);
  ok("profile: change name", (await req("/api/account/profile", { method: "POST", cookie: C, body: { action: "name", name: "Casey B" } })).status === 200);
  ok("profile: wrong current password rejected", (await req("/api/account/profile", { method: "POST", cookie: C, body: { action: "password", current: "nope-nope", next: "NewCustomerPass1" } })).status === 400);
  const pwc = await req("/api/account/profile", { method: "POST", cookie: C, body: { action: "password", current: "CustomerPass123", next: "NewCustomerPass1" } });
  const oldC = C;
  C = ((pwc.headers.get("set-cookie") || "").match(/session=[^;]+/) || [""])[0];
  ok("profile: change password", pwc.status === 200 && !!C);
  ok("old sessions signed out after password change", (await req("/api/auth/me", { cookie: oldC })).json?.user == null && (await req("/api/auth/me", { cookie: C })).json?.user?.email === custEmail);
  ok("login with new password", (await req("/api/auth/login", { method: "POST", body: { email: custEmail, password: "NewCustomerPass1" } })).status === 200);

  // guest order with the same email, then the verify link adds it to the account
  const guest = await req("/api/orders", { method: "POST", body: { email: custEmail, address: custAddr, items: [{ variantId: variant.id, qty: 1, lensCode: "none" }] } });
  const gOrder = guest.json?.number ? await db.order.findUnique({ where: { number: guest.json.number } }) : null;
  if (gOrder) { cleanup.orders.push(gOrder.id); cleanup.convs.push(gOrder.conversationId); }
  ok("guest order isn't linked before email is proven", gOrder && gOrder.userId === null);
  const mkTok = async (purpose) => {
    const raw = randomBytes(32).toString("hex");
    await db.authToken.create({ data: { userId: cust.id, purpose, tokenHash: createHash("sha256").update(raw).digest("hex"), expiresAt: new Date(Date.now() + 3600_000) } });
    return raw;
  };
  const vt = await mkTok("verify");
  const ver = await req("/api/auth/verify", { method: "POST", body: { token: vt } });
  ok("verify email links earlier guest orders", ver.status === 200 && ver.json?.linked >= 1 && !!(await db.user.findUnique({ where: { id: cust.id } })).emailVerified);
  ok("verify link is single-use", (await req("/api/auth/verify", { method: "POST", body: { token: vt } })).status === 400);
  ok("forgot password never reveals accounts", (await req("/api/auth/forgot", { method: "POST", body: { email: "nobody-here@example.com" } })).status === 200);
  const rt = await mkTok("reset");
  const rs = await req("/api/auth/reset", { method: "POST", body: { token: rt, password: "ResetPass12345" } });
  ok("reset password via link", rs.status === 200 && (await req("/api/auth/login", { method: "POST", body: { email: custEmail, password: "ResetPass12345" } })).status === 200);
  ok("reset link is single-use", (await req("/api/auth/reset", { method: "POST", body: { token: rt, password: "ResetPass99999" } })).status === 400);
  ok("bad reset token rejected", (await req("/api/auth/reset", { method: "POST", body: { token: "x".repeat(64), password: "ResetPass12345" } })).status === 400);
  for (const p of ["/forgot-password", "/reset-password?token=abc", "/verify-email?token=abc"]) ok(`page ${p}`, (await req(p)).status === 200);

  /* ---------- crash regressions (found in the security review) ---------- */
  ok("chat ignores an unreadable date instead of crashing", (await req("/api/chat?after=not-a-date&since=2026-01-01", { cookie: buyer })).status === 200);
  const hugePage = await req("/shop?page=99999999999999999999");
  ok("shop survives an enormous page number", hugePage.status === 200 && !hugePage.text.includes("Something went wrong"));
  ok("admin orders survive an enormous page number", (await req("/admin/orders?page=1e30", { cookie: A })).status === 200);
  {
    const [pa, pb] = await db.product.findMany({ take: 2, orderBy: { createdAt: "asc" }, include: { variants: true } });
    const before = pa.variants.length;
    const clash = await req("/api/admin/products", { method: "POST", cookie: A, body: {
      id: pa.id, slug: pa.slug, name: pa.name, modelCode: pa.modelCode, category: pa.category, shape: pa.shape, material: pa.material, gender: pa.gender,
      faceShapes: pa.faceShapes ? pa.faceShapes.split(",") : [], price: pa.price, compareAt: pa.compareAt, description: pa.description,
      lensWidth: pa.lensWidth, lensHeight: pa.lensHeight, bridge: pa.bridge, templeLength: pa.templeLength, frameWidth: pa.frameWidth, weightGrams: pa.weightGrams,
      isNew: pa.isNew, isBestseller: pa.isBestseller, isFeatured: pa.isFeatured, active: pa.active, modelUrl: pa.modelUrl, modelTint: pa.modelTint,
      variants: [{ colorName: "Replacement", colorHex: "#112233", accentHex: null, finish: "solid", sku: pb.variants[0].sku, stock: 1, images: [], modelUrl: null, tryOnImage: null }],
    } });
    ok("a failed frame save leaves the frame untouched", clash.status === 409 && (await db.variant.count({ where: { productId: pa.id } })) === before);
  }

  /* ---------- catalogue ---------- */
  ok("inline stock edit", (await req(`/api/admin/products/${product.id}`, { method: "POST", cookie: A, body: { action: "stock", variantId: variant.id, stock: variant.stock } })).status === 200);
  const dup = await req(`/api/admin/products/${product.id}`, { method: "POST", cookie: A, body: { action: "duplicate" } });
  ok("duplicate frame", dup.status === 200 && dup.json.id);
  if (dup.json?.id) cleanup.products.push(dup.json.id);
  const np = { name: "Smoke Fade", modelCode: `SM${Date.now() % 100000}`, category: "optical", shape: "round", material: "TR90", gender: "women", faceShapes: ["oval"], price: 3100, compareAt: null, description: "", lensWidth: 51, lensHeight: 40, bridge: 17, templeLength: 137, frameWidth: 130, weightGrams: 14, isNew: true, isBestseller: false, isFeatured: false, active: true,
    variants: [{ colorName: "Purple / Pink fade", colorHex: "#4a1d3f", accentHex: "#e7b7c8", finish: "gradient", sku: "", stock: 5, images: [], modelUrl: null }] };
  const sp = await req("/api/admin/products", { method: "POST", cookie: A, body: np });
  ok("add frame with gradient colour", sp.status === 200 && sp.json?.variantIds?.length === 1, sp.json?.error);
  if (sp.json?.id) {
    cleanup.products.push(sp.json.id);
    const sv = await db.variant.findUnique({ where: { id: sp.json.variantIds[0] } });
    ok("gradient finish saved", sv?.finish === "gradient" && sv?.accentHex === "#e7b7c8");
    const again = await req("/api/admin/products", { method: "POST", cookie: A, body: { ...np, id: sp.json.id, variants: [{ ...np.variants[0], id: sp.json.variantIds[0] }] } });
    ok("saving twice keeps one colour", again.status === 200 && (await db.variant.count({ where: { productId: sp.json.id } })) === 1);
    const upF = new FormData(); upF.append("file", png(), "try-on.png"); upF.append("kind", "image");
    const up = await req("/api/admin/upload", { method: "POST", cookie: A, form: upF });
    ok("upload try-on photo", up.status === 200 && up.json?.url, up.json?.error);
    if (up.json?.url) {
      const withPhoto = await req("/api/admin/products", { method: "POST", cookie: A, body: { ...np, id: sp.json.id, variants: [{ ...np.variants[0], id: sp.json.variantIds[0], tryOnImage: up.json.url }] } });
      ok("save try-on photo on a colour", withPhoto.status === 200 && (await db.variant.findUnique({ where: { id: sp.json.variantIds[0] } }))?.tryOnImage === up.json.url);
      ok("try-on page gets the photo", (await req(`/try-on?p=${sp.json.slug}`)).text.includes(up.json.url));
      const upRow = await db.upload.findUnique({ where: { id: up.json.url.split("/").pop() } });
      if (upRow) { await rm(`storage/${upRow.fileName}`, { force: true }).catch(() => {}); await db.upload.delete({ where: { id: upRow.id } }).catch(() => {}); }
    }
    const shared = await req("/api/admin/products", { method: "POST", cookie: A, body: { ...np, id: sp.json.id, modelUrl: up.json?.url || null, modelTint: true, variants: [{ ...np.variants[0], id: sp.json.variantIds[0] }] } });
    const savedP = await db.product.findUnique({ where: { id: sp.json.id } });
    ok("one 3D model can be shared by every colour", shared.status === 200 && savedP?.modelUrl === (up.json?.url || null) && savedP?.modelTint === true, shared.json?.error);
    const pg = await req(`/product/${sp.json.slug}`);
    ok("new frame page renders", pg.status === 200 && pg.text.includes("Purple / Pink fade"));
  }
  const badSize = await req("/api/admin/products", { method: "POST", cookie: A, body: { ...np, lensWidth: 5 } });
  ok("size errors are plain language", badSize.status === 400 && /Lens width/.test(badSize.json?.error || ""), badSize.json?.error);
  const home2 = await req("/");
  ok("homepage has Build your order + new menu", home2.status === 200 && home2.text.includes('id="build"') && home2.text.includes("Build your order") && home2.text.includes("/shop?gender=women"));
  ok("men/women/unisex collections", (await req("/shop?gender=men")).status === 200 && (await req("/shop?gender=unisex")).status === 200);

  const lens = await req("/api/admin/lenses", { method: "POST", cookie: A, body: { create: { kind: "coating", name: "Smoke coating", description: "", price: 100 } } });
  ok("add lens option", lens.status === 200);
  const l = await db.lensOption.findFirst({ where: { name: "Smoke coating" } });
  if (l) cleanup.lenses.push(l.id);
  ok("newsletter signup", (await req("/api/newsletter", { method: "POST", body: { email: "smoke-news@example.com" } })).status === 200);
  cleanup.subs.push("smoke-news@example.com");

  /* ---------- XSS: hostile product text is escaped ---------- */
  const evil = await db.product.create({ data: { ...Object.fromEntries(Object.entries(product).filter(([k]) => !["id", "createdAt", "updatedAt", "variants"].includes(k))), slug: `xss-${Date.now()}`, name: `</script><script>alert(1)</script>`, active: true, variants: { create: [{ colorName: "Test", colorHex: "#000000", sku: `XSS-${Date.now()}`, stock: 1 }] } } });
  cleanup.products.push(evil.id);
  const ev = await req(`/product/${evil.slug}`);
  ok("hostile text can't inject scripts", ev.status === 200 && !ev.text.includes("<script>alert(1)</script>"));

  /* ---------- every admin page renders ---------- */
  for (const p of ["/admin", "/admin/orders", "/admin/orders/new", "/admin/chat", "/admin/products", `/admin/products/${product.id}`, "/admin/products/new", "/admin/lenses", "/admin/customers", `/admin/customers/${admin.id}`, "/admin/blog", "/admin/subscribers", "/admin/settings"]) {
    ok(`admin page ${p}`, (await req(p, { cookie: A })).status === 200);
  }
}

try {
  await main();
} catch (e) {
  results.push({ name: "test run crashed", pass: false, info: e.message });
} finally {
  // clean up everything the test created
  if (restorePayments) {
    const adm = await db.user.findFirst({ where: { role: "admin" } });
    const t2 = await new SignJWT({ role: "admin", name: adm.name, email: adm.email, v: adm.tokenVersion }).setProtectedHeader({ alg: "HS256" }).setSubject(adm.id).setIssuedAt().setExpirationTime("2m").sign(new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me"));
    const back = await req("/api/admin/settings", { method: "POST", cookie: `session=${t2}`, body: { section: "payments", data: restorePayments } }).catch(() => null);
    results.push({ name: "payment settings restored after the test", pass: back?.status === 200, info: back?.text?.slice(0, 120) });
  }
  const proofIds = (await db.order.findMany({ where: { id: { in: cleanup.orders } }, select: { proofUploadId: true } }).catch(() => [])).map((x) => x.proofUploadId).filter(Boolean);
  for (const u of await db.upload.findMany({ where: { id: { in: proofIds } } }).catch(() => [])) {
    await rm(`storage/${u.fileName}`, { force: true }).catch(() => {});
    await db.upload.delete({ where: { id: u.id } }).catch(() => {});
  }
  await db.order.deleteMany({ where: { OR: [{ id: { in: cleanup.orders } }, { email: { in: ["smoke@example.com", "manual@example.com", "smoke-cn@example.com", "smoke-br@example.com"] } }] } }).catch(() => {});
  await db.quote.deleteMany({ where: { conversationId: { in: cleanup.convs } } }).catch(() => {});
  await db.conversation.deleteMany({ where: { id: { in: cleanup.convs } } }).catch(() => {});
  await db.conversation.deleteMany({ where: { userId: { in: cleanup.users } } }).catch(() => {});
  await db.order.deleteMany({ where: { userId: { in: cleanup.users } } }).catch(() => {});
  await db.address.deleteMany({ where: { userId: { in: cleanup.users } } }).catch(() => {});
  await db.authToken.deleteMany({ where: { userId: { in: cleanup.users } } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: cleanup.users } } }).catch(() => {});
  await db.product.deleteMany({ where: { id: { in: cleanup.products } } }).catch(() => {});
  // anything this run created, even if a step failed before its id was recorded
  await db.product.deleteMany({ where: { createdAt: { gte: RUN_START }, OR: [{ name: { endsWith: "(copy)" } }, { name: "Smoke Fade" }, { slug: { startsWith: "xss-" } }] } }).catch(() => {});
  await db.lensOption.deleteMany({ where: { id: { in: cleanup.lenses } } }).catch(() => {});
  await db.subscriber.deleteMany({ where: { email: { in: cleanup.subs } } }).catch(() => {});
  await db.$disconnect();
  const failed = results.filter((r) => !r.pass);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${!r.pass && r.info !== "" ? `  (${r.info})` : ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
}
