// Telling him a contact-form message arrived, the ways he chose in the admin page's Settings:
// by email (on unless he turns it off) and to his phone (off unless he turns it on).
//
// Email: Cloudflare Email Routing, once the domain is on Cloudflare; the send_email binding MAILER
// and MAIL_FROM in wrangler.toml.
// Phone, either way, set as secrets (`npx wrangler pages secret put NAME`):
// - Push notification through the free ntfy app: NTFY_URL = https://ntfy.sh/<a long random topic name>,
//   and he subscribes to that topic in the app.
// - Text message through Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (the Twilio
//   number); the number to text is his, in Settings. US texting needs a one-time business
//   registration with the carriers before it is delivered.
// A notice that fails is logged and nothing else: the message itself is already saved for /admin.
import { site } from './html.js';
import { channels, loadSettings } from './settings.js';

export function notice(m) {
  const how = [m.phone, m.email].filter(Boolean).join(', ');
  const text = m.message.replace(/\s+/g, ' ');
  return `Website message from ${m.name} (${how}): ${text.length > 280 ? `${text.slice(0, 280)}...` : text}`;
}

async function email(env, m) {
  const { EmailMessage } = await import('cloudflare:email');
  const clean = (s) => s.replace(/[\r\n]+/g, ' ');
  const raw = [
    `From: Jensen Design website <${env.MAIL_FROM}>`, `To: ${site.contact.email}`,
    `Reply-To: ${clean(m.email)}`, `Subject: Website message from ${clean(m.name)}`,
    `Message-ID: <${crypto.randomUUID()}@${env.MAIL_FROM.split('@')[1]}>`, `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '',
    `Name: ${m.name}`, `Email: ${m.email}`, `Phone: ${m.phone || '-'}`, '', m.message,
  ].join('\r\n');
  await env.MAILER.send(new EmailMessage(env.MAIL_FROM, site.contact.email, raw));
}

async function push(env, m) {
  const r = await fetch(env.NTFY_URL, {
    method: 'POST', body: notice(m),
    headers: { Title: 'New website message', Tags: 'envelope',
      ...(m.phone ? { Actions: `view, Call ${m.phone.replace(/[,;]/g, ' ')}, tel:${m.phone.replace(/[^\d+]/g, '')}` } : {}) },
  });
  if (!r.ok) throw new Error(`ntfy answered ${r.status}`);
}

async function text(env, m, to) {
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}` },
    body: new URLSearchParams({ From: env.TWILIO_FROM, To: to, Body: notice(m) }),
  });
  if (!r.ok) throw new Error(`Twilio answered ${r.status}`);
}

/** Sends the notices he chose; returns what was tried and how it went (the admin's test button shows it). */
export async function notifyOwner(env, m, settings) {
  settings = settings || await loadSettings(env);
  const have = channels(env), tries = [];
  if (settings.notifyEmail && have.email) tries.push(['email', email(env, m)]);
  if (settings.notifyPhone && have.push) tries.push(['phone (push)', push(env, m)]);
  if (settings.notifyPhone && have.text && settings.phoneNumber) tries.push(['phone (text)', text(env, m, settings.phoneNumber)]);
  const results = await Promise.allSettled(tries.map(([, p]) => p));
  return tries.map(([how], i) => {
    const ok = results[i].status === 'fulfilled';
    if (!ok) console.error(`notice by ${how} failed:`, results[i].reason);
    return { how, ok, error: ok ? undefined : String(results[i].reason?.message || results[i].reason) };
  });
}
