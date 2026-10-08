import { AREA, esc, hero, html, media, page, site } from '../_lib/html.js';
import { coverOf, loadGalleries, shortName } from '../_lib/data.js';

export async function onRequestGet({ env }) {
  const { data } = await loadGalleries(env);
  const tiles = data.galleries.filter((g) => g.photos.length).map((g, i) => {
    const c = coverOf(g), key = `g/${g.slug}/${c.id}`;
    return `<a class="project-tile" href="/projects/${esc(g.slug)}">
  <img ${i > 1 ? 'loading="lazy" ' : ''}src="${media(key)}" srcset="${media(key, '-t')} 800w, ${media(key)} 2000w" sizes="100vw" alt="${esc(c.alt || shortName(g.name))}">
  <span class="project-tile__caption">${esc(shortName(g.name))}</span>
</a>`;
  }).join('');
  const body = `${hero('OUR WORK', site.heroes.projects, 'short')}
<p class="intro">Custom kitchens, baths, bars, closets and whole-home cabinetry we designed and built in ${AREA}.</p>
<div class="projects">${tiles}</div>`;
  return html(page({ title: 'Projects: Custom Cabinetry in Telluride, CO', path: '/projects', body,
    description: `Photos of ${data.galleries.length} custom cabinetry projects by Jensen Design: kitchens, bathroom vanities, bars, closets and whole homes in ${AREA}.` }));
}
