// Sends one contact-form message to his inbox, as plain text: the same sender and subject pattern
// every time so one inbox rule files them, and Reply-To set to the person who wrote.
import { EmailMessage } from 'cloudflare:email';

const oneLine = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200);
// Header words in UTF-8 (names with accents), as RFC 2047 asks.
const word = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(s)))}?=`);

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Not found', { status: 404 });
    const m = await request.json();
    const name = oneLine(m.name), email = oneLine(m.email), phone = oneLine(m.phone);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !m.message) return new Response('Bad message', { status: 400 });
    const body = `Name: ${name}\r\nEmail: ${email}\r\nPhone: ${phone || '-'}\r\n\r\n${String(m.message).slice(0, 5000).replace(/\r?\n/g, '\r\n')}\r\n`;
    const raw = [
      `From: ${word('Jensen Design website')} <${env.MAIL_FROM}>`,
      `To: <${env.MAIL_TO}>`,
      `Reply-To: ${word(name)} <${email}>`,
      `Subject: ${word(`Website message from ${name}`)}`,
      `Message-ID: <${crypto.randomUUID()}@${env.MAIL_FROM.split('@')[1]}>`,
      `Date: ${new Date().toUTCString()}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      btoa(String.fromCharCode(...new TextEncoder().encode(body))).replace(/.{76}/g, '$&\r\n'),
    ].join('\r\n');
    await env.SEND.send(new EmailMessage(env.MAIL_FROM, env.MAIL_TO, raw));
    return new Response('sent');
  },
};
