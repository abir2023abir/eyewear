import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { getSettings } from "./settings";
import { site } from "./site";

let transport: { key: string; t: Transporter } | null = null;

async function getTransport() {
  const { email } = await getSettings();
  if (!email.smtpHost) return null;
  const key = `${email.smtpHost}|${email.smtpPort}|${email.smtpUser}|${email.smtpPass}`;
  if (transport?.key !== key) {
    transport = {
      key,
      t: nodemailer.createTransport({
        host: email.smtpHost,
        port: email.smtpPort || 587,
        secure: email.smtpPort === 465,
        auth: email.smtpUser ? { user: email.smtpUser, pass: email.smtpPass } : undefined,
        connectionTimeout: 15_000,
      }),
    };
  }
  return transport.t;
}

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function layout(title: string, inner: string) {
  const { store } = await getSettings();
  return `<!doctype html><html><body style="margin:0;background:#eef4ff;font-family:Arial,Helvetica,sans-serif;color:#0b1f44">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden">
  <tr><td style="background:#0a2463;color:#fff;padding:20px 28px;font-size:20px;font-weight:bold">${esc(store.name)}</td></tr>
  <tr><td style="padding:28px"><h1 style="font-size:22px;margin:0 0 16px">${esc(title)}</h1>${inner}</td></tr>
  <tr><td style="padding:16px 28px;background:#f5f8ff;font-size:12px;color:#5a6b8c">${esc(store.name)} · ${esc(store.email)} · ${esc(store.phone)}<br>${esc(site.url)}</td></tr>
  </table></td></tr></table></body></html>`;
}

/** Sends an email, or logs it to the console when SMTP is not configured. Never throws. */
export type Attachment = { filename: string; content: Buffer; contentType?: string };

export async function sendMail(to: string, subject: string, html: string, attachments?: Attachment[]): Promise<boolean> {
  try {
    const t = await getTransport();
    if (!t) {
      console.log(`[mail:dev] to=${to} subject="${subject}"${attachments?.length ? ` attachments=${attachments.map((a) => a.filename).join(",")}` : ""} (SMTP not configured)`);
      return false;
    }
    const { email, store } = await getSettings();
    await t.sendMail({ from: email.mailFrom || `${store.name} <${store.email}>`, to, subject, html, replyTo: store.email || undefined, attachments });
    return true;
  } catch (e) {
    console.error("[mail] failed", e);
    return false;
  }
}

/** Used by Admin → Settings → "Send test email". Returns the error text instead of swallowing it. */
export async function sendTestMail(to: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const t = await getTransport();
    if (!t) return { ok: false, error: "SMTP host is not set." };
    await t.verify();
    const { email, store } = await getSettings();
    await t.sendMail({ from: email.mailFrom || `${store.name} <${store.email}>`, to, subject: `Test email from ${store.name}`, html: await layout("Email is working", "<p>Your store can send order confirmations and receipts.</p>") });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Could not send" };
  }
}
