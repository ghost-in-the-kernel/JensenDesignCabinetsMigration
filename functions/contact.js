import { contactBlock, esc, hero, html, page, site, socialLinks } from './_lib/html.js';
import { notifyOwner } from './_lib/notify.js';

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
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.mapAddress)}`;
  const body = `${hero('CONTACT US', site.heroes.contact)}
<section class="section section--white section--wide">
  <div class="columns">
    <div>
      <h2 class="title-2">${esc(site.legalName)}</h2>
      ${contactBlock()}
      ${socialLinks()}
      <div class="map map--off" data-map="${esc(map)}" data-title="Map of ${esc(site.mapAddress)}">
        <button type="button">Show map</button>
        <p>The map comes from Google, so it loads only if you ask for it. Or <a href="${esc(directions)}" target="_blank" rel="noopener">open the address in Google Maps</a>.</p>
      </div>
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

export async function onRequestPost({ request, env, waitUntil }) {
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
  waitUntil(notifyOwner(env, message)); // the visitor does not wait for it
  return render('<p class="form-note">Thank you. We will be in touch soon.</p>');
}
