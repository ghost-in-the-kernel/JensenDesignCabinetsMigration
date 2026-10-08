import { ORIGIN, esc, html, media, page } from '../_lib/html.js';
import { coverOf, loadGalleries, shortName } from '../_lib/data.js';
import { photoKey } from '../_lib/storage.js';

export async function onRequestGet({ request, env, params, next }) {
  const { data } = await loadGalleries(env);
  // Old Houzz links were /projects/<id>-<name>; a renamed gallery keeps its id, so match on that too.
  const id = String(params.slug).split('-')[0];
  const g = data.galleries.find((x) => x.slug === params.slug) || data.galleries.find((x) => x.id === id);
  if (!g) return next();
  if (g.slug !== params.slug) return Response.redirect(new URL(`/projects/${g.slug}`, request.url).toString(), 301);

  // Only the first photo comes with the page; site.js loads each photo just before it is shown,
  // so a 70-photo project costs one photo up front, not seventy.
  const slides = g.photos.map((p, i) => {
    const key = photoKey(g, p);
    const src = i ? 'data-src' : 'fetchpriority="high" src';
    const inner = p.kind === 'video'
      ? `<video controls preload="none" playsinline ${i ? 'data-poster' : 'poster'}="${media(key)}" src="${media(key, '', 'mp4')}"></video>`
      : `<img ${src}="${media(key)}" alt="${esc(p.alt || p.title || shortName(g.name))}" width="${p.w}" height="${p.h}">`;
    return `<figure class="slide" data-title="${esc(p.title)}" data-caption="${esc(p.caption)}">${inner}</figure>`;
  }).join('');
  // Every photo is also a plain link, so search engines and people without JavaScript reach them all.
  const list = g.photos.filter((p) => p.kind !== 'video').map((p) =>
    `<li><a href="${media(photoKey(g, p))}">${esc(p.alt || p.title || shortName(g.name))}</a></li>`).join('');

  const place = g.name.includes(' | ') ? g.name.split(' | ')[1] : 'Telluride, CO';
  const description = g.description
    || `${shortName(g.name)}: custom cabinetry designed and built by Jensen Design in ${place}. ${g.photos.length} photos.`;
  const body = `
<section class="section section--wide project-page">
  <h1 class="project-title">${esc(g.name)}</h1>
  ${g.description ? `<p class="project-description">${esc(g.description)}</p>` : ''}
  <div class="slideshow slideshow--project">${slides}
    <button class="slideshow__prev" aria-label="Previous photo"></button><button class="slideshow__next" aria-label="Next photo"></button>
    <div class="slideshow__progress"><span></span></div>
  </div>
  <div class="slideshow__text"><p class="slideshow__title"></p><p class="slideshow__caption"></p><p class="slideshow__count"></p></div>
  <p><a class="back" href="/projects">&larr; All projects</a></p>
  <details class="photo-list"><summary>All ${g.photos.length} photos as a list</summary><ol>${list}</ol></details>
</section>`;
  const cover = coverOf(g);
  const ld = {
    '@context': 'https://schema.org', '@type': 'ImageGallery', name: g.name, description,
    url: `${ORIGIN}/projects/${g.slug}`, author: { '@id': `${ORIGIN}/#business` }, contentLocation: { '@type': 'Place', name: place },
    image: g.photos.filter((p) => p.kind !== 'video').slice(0, 30).map((p) => ({
      '@type': 'ImageObject', contentUrl: `${ORIGIN}${media(photoKey(g, p))}`, caption: p.alt || p.title, width: p.w, height: p.h,
    })),
  };
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Projects', item: `${ORIGIN}/projects` },
      { '@type': 'ListItem', position: 2, name: shortName(g.name), item: `${ORIGIN}/projects/${g.slug}` },
    ],
  };
  return html(page({ title: g.name, path: '/projects', canonical: `/projects/${g.slug}`, body, description,
    image: cover ? media(photoKey(g, cover)) : '', ld: [ld, crumbs] }));
}
