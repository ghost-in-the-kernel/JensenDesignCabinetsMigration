import { esc, hero, html, page, site } from './_lib/html.js';

const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const month = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export async function onRequestGet() {
  const reviews = site.reviews.map((r) => `
<figure class="review">
  <div class="review__stars" aria-label="${r.rating} out of 5 stars">${stars(r.rating)}</div>
  <blockquote>${esc(r.body).replace(/\n+/g, '<br>')}</blockquote>
  <figcaption>${esc(r.name)} &middot; ${esc(month(r.date))}</figcaption>
</figure>`).join('');
  const body = `${hero('ABOUT US', site.heroes.about)}
<section class="section section--grey section--narrow about">${site.about.map((p) => `<p class="body-2">${esc(p)}</p>`).join('')}</section>
<section class="section section--white section--narrow">
  <h2 class="title-2">TESTIMONIALS</h2>
  <div class="reviews">${reviews}</div>
</section>`;
  return html(page({ title: 'About Jensen Design: Custom Cabinetmakers', path: '/about', body, description: site.about[0] }));
}
