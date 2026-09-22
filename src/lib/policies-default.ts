// Starter policy text — editable in Admin → Settings → Policies. "{store}" is replaced by the store name.
export const POLICY_META_AND_BODY: Record<string, { title: string; description: string; body: string }> = {
  shipping: {
    title: "Shipping & Customs",
    description: "Worldwide DHL Express delivery times, costs, tracking, and import duty information.",
    body: `We ship to more than 60 countries with **DHL Express**, door to door.

## Processing time
- Frames only: dispatched within 1–2 business days of payment.
- Prescription lenses: 3–5 business days to cut, fit and check your lenses before dispatch.
- Bank transfer (XTransfer) orders are processed once payment is confirmed.

## Delivery time
Most parcels arrive 3–6 business days after dispatch. Remote areas may take longer.

## Shipping cost
Shipping is calculated live from DHL at checkout based on your country, city and the number of frames. The price you see is the price you pay us for shipping.

## Tracking
You’ll receive an email with your DHL tracking number as soon as your parcel ships. You can also track it any time from your account.

## Customs, duties and taxes
Orders ship **DAP (Delivered At Place)**. Import duties, VAT/GST or clearance fees may be charged by your country’s customs authority and are collected by DHL on delivery. These charges are not included in our prices and are the responsibility of the recipient. If you refuse a parcel because of import charges, the return shipping cost will be deducted from any refund.

## Address problems
Please double-check your address and phone number — DHL uses your phone number to arrange delivery. We can’t be responsible for delays caused by an incorrect address.`,
  },
  returns: {
    title: "Returns & Exchanges",
    description: "14-day returns on unworn frames. How to request a return or exchange.",
    body: `We want you to love your glasses.

## Frames
Unworn frames in their original condition and packaging can be returned or exchanged within **14 days of delivery**. Use the virtual try-on and fit check to choose confidently before you buy.

## Prescription lenses
Lenses are made to your personal prescription and cannot be resold, so they are non-refundable — unless they are faulty or made incorrectly, in which case we will remake them free of charge.

## Faulty or damaged items
If anything arrives damaged or faulty, message us within 7 days of delivery with photos. We’ll send a replacement or refund at no cost to you.

## How to return
1. Start a chat or email us with your order number.
2. We’ll confirm the return and send instructions.
3. Refunds are issued to your original payment method within 5 business days of receiving the return.

Return shipping is paid by the customer unless the item is faulty or we made an error.`,
  },
  privacy: {
    title: "Privacy Policy",
    description: "How we collect, use and protect your personal data — including our on-device virtual try-on.",
    body: `This policy explains what personal data {store} collects and how we use it.

## Virtual try-on
The virtual try-on runs **entirely in your browser**. Camera frames and selfies are processed on your device and are **never uploaded, stored or shared**. Face measurements (face width, PD, face shape) are calculated locally and discarded when you leave the page, unless you choose to add your PD to an order.

## What we collect
- Account details: name, email, password (stored as a secure hash).
- Order details: shipping address, phone number, items, prescription values or prescription images you provide.
- Payment: processed by PayPal or by bank transfer. We never see or store card numbers. For bank transfers we store the receipt you upload.
- Chat messages you send to our team.
- Analytics: if enabled, Google Analytics and Google Ads use cookies to measure visits and ad performance.

## How we use it
To process and ship orders, make your lenses, provide customer support, send order emails, and (only if you subscribe) send marketing emails. Your address and phone number are shared with DHL to deliver your parcel.

## Your rights
You can ask us to access, correct or delete your personal data at any time by contacting us. You can unsubscribe from marketing emails at any time.

## Retention
Order records are kept as required for tax and accounting. Prescription data is kept only as long as needed to fulfil your order or, if you save it, until you delete it from your account.`,
  },
  terms: {
    title: "Terms of Service",
    description: "Terms that apply to orders placed on our website.",
    body: `By placing an order with {store} you agree to these terms.

## Prices and payment
All prices are in US dollars (USD). Amounts shown in other currencies are estimates for convenience only; you are charged in USD. Payment is by PayPal or international bank transfer via XTransfer.

## Orders
An order is accepted when we send an order confirmation email. We may cancel an order if an item is out of stock or a prescription cannot be made, in which case you receive a full refund.

## Prescriptions
You are responsible for providing an accurate, valid prescription. Our opticians check prescriptions for obvious errors but do not replace an eye examination. Glasses bought online are not a substitute for regular eye tests.

## Virtual try-on and fit estimates
Try-on visuals, fit badges, face-shape suggestions and PD estimates are guides only and may differ from the real product on your face.

## Shipping and customs
See our Shipping & Customs policy. Import duties and taxes are the buyer’s responsibility.

## Liability
Our liability for any order is limited to the amount you paid for that order, to the extent permitted by law.`,
  },
};


export const DEFAULT_POLICIES = {
  shipping: POLICY_META_AND_BODY.shipping.body,
  returns: POLICY_META_AND_BODY.returns.body,
  privacy: POLICY_META_AND_BODY.privacy.body,
  terms: POLICY_META_AND_BODY.terms.body,
};
