import "server-only";
import { sendMail, layout, esc } from "./mail";
import { getSettings } from "./settings";
import { site } from "./site";

/** Alert the seller on email + WhatsApp (CallMeBot) — used when chat is offline and for new orders. Never throws. */
export async function alertSeller(subject: string, text: string, link?: string) {
  try {
    const { email } = await getSettings();
    const url = link ? site.url + link : site.url + "/admin";
    const jobs: Promise<unknown>[] = [];
    if (email.sellerAlertEmail) {
      jobs.push(sendMail(email.sellerAlertEmail, subject, await layout(subject, `<p style="white-space:pre-wrap">${esc(text)}</p><p><a href="${esc(url)}" style="background:#1d5bd8;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Open</a></p>`)));
    }
    if (email.callmebotPhone && email.callmebotKey) {
      const msg = `${subject}\n${text}\n${url}`.slice(0, 900);
      const q = new URLSearchParams({ phone: email.callmebotPhone, text: msg, apikey: email.callmebotKey });
      jobs.push(fetch(`https://api.callmebot.com/whatsapp.php?${q}`, { signal: AbortSignal.timeout(10_000) }).catch((e) => console.error("[whatsapp] failed", e)));
    }
    if (!jobs.length) console.log(`[alert:dev] ${subject}: ${text}`);
    await Promise.allSettled(jobs);
  } catch (e) {
    console.error("[alert] failed", e);
  }
}
