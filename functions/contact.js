import { contactBlock, esc, hero, html, page, site, socialLinks } from './_lib/html.js';

function form(values = {}, note = '') {
  const v = (k) => esc(values[k] || '');
  return `<form class="contact-form" method="post" action="/contact">
  ${note}
  <label>Name<input name="name" required maxlength="200" value="${v('name')}" autocomplete="name"></label>
  <label>Email<input name="email" type="email" required maxlength="200" value="${v('email')}" autocomplete="email"></label>
  <label>Phone<input name="phone" maxlength="50" value="${v('phone')}" autocomplete="tel"></label>
  <label>Message<textarea name="message" required maxlength="5000" rows="6">${v('message')}</textarea></label>
  <label class="hp" aria-hidden="true">Leave this empty<input name="website" tabindex="-1" autocomplete="off"></label>
  <button type="submit">Send</button>
</form>`;
}

function render(formHtml, status = 200) {
  const map = `https://www.google.com/maps?q=${encodeURIComponent(site.mapAddress)}&output=embed`;
  const body = `${hero('CONTACT US', site.heroes.contact)}
<section class="section section--white section--wide">
  <div class="columns">
    <div>
      <h2 class="title-2">${esc(site.legalName)}</h2>
      ${contactBlock()}
      ${socialLinks()}
      <iframe class="map" title="Map of ${esc(site.mapAddress)}" loading="lazy" src="${esc(map)}"></iframe>
    </div>
    <div>
      <h3 class="title-3">CONTACT FORM</h3>
      ${formHtml}
    </div>
  </div>
</section>`;
  return html(page({ title: 'Contact Jensen Design', path: '/contact', body,
    description: `Contact Jensen Design about custom cabinetry: ${site.contact.formattedPhone}, ${site.contact.email}, ${site.contact.formattedAddress}.` }),
  status, { 'cache-control': 'no-store' });
}

export const onRequestGet = () => render(form());

export async function onRequestPost({ request, env }) {
  const f = await request.formData();
  const values = Object.fromEntries(['name', 'email', 'phone', 'message', 'website'].map((k) => [k, String(f.get(k) || '').trim()]));
  if (values.website) return render('<p class="form-note">Thank you. We will be in touch soon.</p>'); // a bot filled the hidden field
  if (!values.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email) || !values.message
      || values.message.length > 5000 || values.name.length > 200) {
    return render(form(values, '<p class="form-note form-note--error">Please fill in your name, a valid email address and a message.</p>'), 400);
  }
  delete values.website;
  const message = { ...values, received: new Date().toISOString() };
  const id = `${message.received.replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;
  await env.MEDIA.put(`messages/${id}.json`, JSON.stringify(message), { httpMetadata: { contentType: 'application/json' } });
  if (env.MAILER && env.MAIL_FROM) {
    try {
      const { EmailMessage } = await import('cloudflare:email');
      const clean = (s) => s.replace(/[\r\n]+/g, ' ');
      const raw = [
        `From: Jensen Design website <${env.MAIL_FROM}>`, `To: ${site.contact.email}`,
        `Reply-To: ${clean(values.email)}`, `Subject: Website message from ${clean(values.name)}`,
        `Message-ID: <${id}@${env.MAIL_FROM.split('@')[1]}>`, `Date: ${new Date().toUTCString()}`,
        'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '',
        `Name: ${values.name}`, `Email: ${values.email}`, `Phone: ${values.phone || '-'}`, '', values.message,
      ].join('\r\n');
      await env.MAILER.send(new EmailMessage(env.MAIL_FROM, site.contact.email, raw));
    } catch (e) {
      console.error('contact email failed (message is kept in R2):', e);
    }
  }
  return render('<p class="form-note">Thank you. We will be in touch soon.</p>');
}
