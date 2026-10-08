import { esc, html, page, site } from './_lib/html.js';

export async function onRequestGet() {
  const c = site.contact;
  const body = `
<section class="section section--white section--narrow privacy">
  <h1 class="title-1 title--dark">Privacy Policy</h1>
  <p>${esc(site.legalName)} runs this website. It does not track visitors: no analytics, no advertising and no tracking cookies. We do not sell or share information about you.</p>
  <p>If you send us a message through the contact form, we receive your name, email address, phone number (if you give one) and your message. We use them only to answer you. A copy of your message may be sent to us by email or as a notice to our phone so we can answer quickly. Messages are deleted automatically after one year.</p>
  <p>The map on the Contact page comes from Google and loads only if you click "Show map"; Google's privacy policy then applies to it.</p>
  <p>The site is hosted by Cloudflare, which processes basic request information (such as your IP address) to deliver and protect the site. Its policy is at <a href="https://www.cloudflare.com/privacypolicy/">cloudflare.com/privacypolicy</a>.</p>
  <p>To ask about or remove information you sent us, write to <a href="mailto:${esc(c.email)}">${esc(c.email)}</a> or call ${esc(c.formattedPhone)}.</p>
</section>`;
  return html(page({ title: 'Privacy Policy', path: '/privacy', body, noindex: true }));
}
