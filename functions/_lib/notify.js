// Telling him a contact-form message arrived, the ways he chose in the admin page's Settings:
// by email (on unless he turns it off; his main way, he files them into inbox folders, so the sender
// and subject stay the same every time) and to his phone (off unless he turns it on).
//
// Email: the mailer Worker (mailer/), bound as MAILER in wrangler.toml, through Cloudflare Email
// Routing to his verified inbox.
// Phone, either way, set as secrets (`npx wrangler pages secret put NAME`):
// - Push notification through the free ntfy app: NTFY_URL = https://ntfy.sh/<a long random topic name>,
//   and he subscribes to that topic in the app.
// - Text message through Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM (the Twilio
//   number); the number to text is his, in Settings. US texting needs a one-time business
//   registration with the carriers before it is delivered.
// A notice that fails is logged and nothing else: the message itself is already saved for /admin.
import { channels, loadSettings } from './settings.js';

export function notice(m) {
  const how = [m.phone, m.email].filter(Boolean).join(', ');
  const text = m.message.replace(/\s+/g, ' ');
  return `Website message from ${m.name} (${how}): ${text.length > 280 ? `${text.slice(0, 280)}...` : text}`;
}

async function email(env, m) {
  // The mailer Worker (mailer/) does the sending; Pages cannot.
  const r = await env.MAILER.fetch('https://mailer/send', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: m.name, email: m.email, phone: m.phone, message: m.message }),
  });
  if (!r.ok) throw new Error(`mailer answered ${r.status}: ${await r.text()}`);
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
