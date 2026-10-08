import { ORIGIN, esc, media } from './_lib/html.js';
import { loadGalleries } from './_lib/data.js';
import { photoKey } from './_lib/storage.js';

// Every page and every project, with its photos, so search engines find them all.
export async function onRequestGet({ env }) {
  const { data } = await loadGalleries(env);
  const page = (path, extra = '') => `<url><loc>${esc(ORIGIN + path)}</loc>${extra}</url>`;
  const urls = ['/', '/projects', '/about', '/contact'].map((p) => page(p));
  for (const g of data.galleries.filter((x) => x.photos.length)) {
    const images = g.photos.filter((p) => p.kind !== 'video').slice(0, 1000)
      .map((p) => `<image:image><image:loc>${esc(ORIGIN + media(photoKey(g, p)))}</image:loc></image:image>`).join('');
    urls.push(page(`/projects/${g.slug}`, images));
  }
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join('\n')}
</urlset>`, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
