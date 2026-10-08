import { esc, html, media, page, site } from './_lib/html.js';
import { coverOf, loadGalleries, shortName } from './_lib/data.js';
import { photoKey } from './_lib/storage.js';

export async function onRequestGet({ env }) {
  const { data } = await loadGalleries(env);
  const slides = data.galleries.filter((g) => g.photos.length).slice(0, site.home.slideshow).map((g, i) => {
    const c = coverOf(g);
    const src = media(photoKey(g, c));
    // Only the first photo loads with the page; site.js loads each next one just before it shows.
    return `<a class="slide" href="/projects/${esc(g.slug)}"><img ${i ? 'data-' : 'fetchpriority="high" '}src="${src}" alt="${esc(c.alt || shortName(g.name))}"></a>`;
  }).join('');
  const body = `
<div class="slideshow slideshow--home" data-autoplay="4000">${slides}
  <button class="slideshow__prev" aria-label="Previous"></button><button class="slideshow__next" aria-label="Next"></button>
</div>
<section class="section section--white section--narrow">
  <h1 class="title-1 title--dark">${esc(site.home.heading)}</h1>
  <p class="body-2">${esc(site.home.text)}</p>
  <p class="body-2">${esc(site.home.services)}</p>
  <p><a class="button-link" href="/projects">See our projects</a></p>
</section>`;
  return html(page({ title: site.name, path: '/', body }));
}
