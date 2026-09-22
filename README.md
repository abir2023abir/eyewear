# Wenzhou Kangjing Shopy — worldwide eyewear store with 3D virtual try-on

Next.js 15 · React 19 · Prisma (SQLite locally / Postgres in production) · three.js · MediaPipe Face Landmarker.

Almost everything is edited in the **admin panel → Store settings** (store name, contact details, homepage text, ticker, FAQ, bundle discounts, PayPal, bank transfer, DHL, shipping prices, email, Google Analytics/Ads, policy pages). No code changes needed.

## Run it locally

```bash
npm install
npm run setup        # creates the database + seeds 60 frames / 300 SKUs, lenses, blog posts, admin user
npm run build
npm start
```

Open http://localhost:3000 · Admin: http://localhost:3000/admin (sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env` — **change that password before going live**).

## Connecting the real services

Enter keys in **Admin → Store settings** (each section has a Test button). Values in `.env` are used as defaults until you save something in the admin panel.

Everything works without keys (DHL shows estimated rates, emails print to the console). Fill these in to go live:

| Feature | Variables | Where to get them |
|---|---|---|
| PayPal (instant payment) | `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV=live` | developer.paypal.com → Apps & Credentials |
| XTransfer bank details | `XTRANSFER_*` | the client's XTransfer receiving account |
| Order emails & receipts | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | any SMTP provider (Google Workspace, Zoho, Resend, SES…) |
| Seller alerts (offline chat, new orders) | `SELLER_ALERT_EMAIL`, `CALLMEBOT_PHONE`, `CALLMEBOT_APIKEY` | callmebot.com (free WhatsApp alerts) |
| WhatsApp / Messenger buttons | `NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_MESSENGER`, `NEXT_PUBLIC_PHONE` | your numbers / page name |
| Google Analytics & Ads | `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_GADS_ID`, `NEXT_PUBLIC_GADS_PURCHASE_LABEL` | analytics.google.com, ads.google.com |

## What's where

- **Storefront** — `src/app/(store)`: home, shop (filters: shape, colour, material, gender, price, face shape, search), product (360° 3D, swatches, lenses, prescription), cart, checkout, order page, account, wishlist, lenses, blog, policies.
- **3D try-on** — `src/components/TryOnStudio.tsx`, `src/lib/frame3d.ts`, `src/lib/face.ts`. Runs fully in the browser; the camera image is never uploaded. Uploaded `.glb` models (admin → Frames → colour → Upload .glb) replace the auto-generated 3D frame.
- **Chat** — customer widget `src/components/ChatWidget.tsx`, seller inbox `/admin/chat`. The seller shows as "online" while the inbox is open.
- **Admin** — `src/app/admin`: sales overview, orders (verify transfers, DHL labels, tracking), chat inbox with quote cards, frames & stock, lens pricing, blog, newsletter export.

## Deploying to production

1. Use Postgres: in `prisma/schema.prisma` set `provider = "postgresql"`, set `DATABASE_URL`, then `npx prisma db push && npm run db:seed`.
2. Uploaded files are stored in `./storage` — use a host with a persistent disk (VPS, Railway, Render with a disk) or move `src/lib/uploads.ts` to S3/R2.
3. Set `NEXT_PUBLIC_SITE_URL` to your domain and a long random `AUTH_SECRET`.
4. The try-on camera needs HTTPS.
5. Rate limiting is in-memory (fine for one server; use Redis if you run several).

## Notes

- Product images are generated artwork until you upload real photos per colour in the admin panel.
- Policy pages (`src/app/(store)/policies/[slug]/page.tsx`) are starter templates — review them for your business and jurisdiction.
- Prices are stored and charged in USD; the local currency shown next to prices is an estimate from live exchange rates.

## Checkout (Alibaba-style, in the chat)

1. The customer fills in contact + delivery address and presses **Confirm order** (no payment on the page).
2. The chat opens automatically with the order summary.
3. Outside China: a **DHL Express** card shows the price and estimated arrival and asks for the details customs needs (phone, postcode, and a tax/ID number for countries listed in Settings). Inside China: local delivery, no DHL.
4. The assistant asks **“How would you like to pay?”** — PayPal or XTransfer — and payment happens in the chat.
5. After payment a thank-you card appears (and the email receipt is sent). Your team can reply personally in the same chat.

There is no courier API: book DHL yourself and paste the tracking number on the order (the customer is notified by email and in the chat). Prices, delivery days and customs countries are set in **Store settings → Shipping & delivery**; chat texts in **Chat assistant**; logos in **Logos**.

## Customer accounts & invoices

- **My account** (`/account`): overview (latest order + progress, orders to pay), My orders (status, tracking, invoice PDF, pay / continue in chat), Addresses & prescriptions, Wishlist, Messages (continue any past chat on any device), Profile & security (name, password, sign out other devices).
- Customers can create an account at checkout (tick "Create an account") or at `/register`. A confirmation email is sent; confirming it (or resetting the password) also attaches earlier guest orders placed with that email.
- Forgot password: `/forgot-password` → emailed link (1 hour, single use) → `/reset-password`.
- **Emails:** order confirmed (with invoice PDF attached), transfer receipt received, payment received (paid invoice attached), shipped. Emails only send once SMTP is filled in under Admin → Store settings → Email; until then they are printed in the server log.
- Invoice PDF: `/api/orders/<number>/invoice` — opens for the customer (their account or order link) and for admins ("Invoice PDF" on the admin order page).

## Virtual try-on: real photo + 3D

- **Real photo** (default when available): each colour can have a *Try-on photo* — Admin → Frames → colour → “Try-on photo”. Upload a straight-on front photo of the open frame on a plain light background; the background and lens openings are made see-through in the browser, and the result is shown on the customer’s face at the frame’s real width, following the head. Customers can fine-tune with ▲ ▼ + −.
- **3D model**: always available; built automatically from the frame size and colours (or from an uploaded .glb). Used when a colour has no try-on photo.

## Admin panel (super admin)

- **Orders & payments** — confirm bank transfers, check PayPal payments, edit address/shipping/discount, resend any email, DHL labels & tracking, packing slip/invoice, delete test orders.
- **Create manual order** — for WhatsApp/phone customers, with price overrides and a payment link by email.
- **Chat inbox** — reply as the seller, send quote cards with a Pay Now button.
- **Frames & stock** — add/edit frames, colours, photos, 3D models; edit stock inline; duplicate; archive or delete.
- **Lens pricing**, **Blog**, **Newsletter** (CSV export), **Customers & admins** (roles, password resets, sign-out everywhere).
- **Store settings** — everything listed above, plus changing your own password.

PayPal webhook (recommended): in PayPal Developer → your app → Webhooks add `https://YOUR-DOMAIN/api/paypal/webhook` with the events CHECKOUT.ORDER.APPROVED, PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED, PAYMENT.CAPTURE.REFUNDED, then paste the Webhook ID into Store settings → Payments.

## Automated tests

With the server running, `npm run test:smoke` checks every page, checkout, payments, admin actions and the security rules (78 checks) and removes its own test data. Run it after any change.

## After changing code

Always **stop the server (Ctrl+C), run `npm run build`, then `npm start` again**. If you rebuild while an old server is still running, pages stay stuck on "Loading…" because the old server points to files the new build replaced.
