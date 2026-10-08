import site from '../../content/site.json';

export { site };

// The one address search engines should know the site by; every other hostname redirects here
// or (staging, pages.dev) is marked noindex in _middleware.js.
export const ORIGIN = 'https://jensendesigncabinets.com';
export const AREA = 'Telluride, Mountain Village and Montrose, Colorado';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

import { media } from './storage.js';

export { media };

const NAV = [['/', 'Jensen Design'], ['/projects', 'Projects'], ['/about', 'About'], ['/contact', 'Contact']];

const ICONS = {
  address: '<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>',
  phone: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/>',
  email: '<path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z"/>',
  facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v8h4v-8h3l1-4h-4V8z"/>',
  instagram: '<path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm5.5-9.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4zM7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3z"/>',
  twitter: '<path d="M18.2 2h3.4l-7.4 8.5L23 22h-6.8l-5.3-7-6.1 7H1.4l7.9-9.1L1 2h7l4.8 6.4zm-1.2 18h1.9L7.1 3.9H5.1z"/>',
  linkedin: '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C21.6 8.65 22 11.3 22 14.7V21h-4v-5.6c0-1.34-.03-3.06-1.86-3.06-1.87 0-2.15 1.46-2.15 2.96V21h-4z"/>',
  pinterest: '<path d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.3-5.5s-.3-.7-.3-1.6c0-1.5.9-2.7 2-2.7.9 0 1.4.7 1.4 1.6 0 1-.6 2.4-.9 3.7-.3 1.1.6 2 1.7 2 2 0 3.5-2.1 3.5-5.2 0-2.7-2-4.6-4.8-4.6-3.3 0-5.2 2.5-5.2 5 0 1 .4 2.1.9 2.7l.1.4-.3 1.3c0 .2-.2.3-.4.2-1.5-.7-2.4-2.8-2.4-4.6 0-3.7 2.7-7.2 7.9-7.2 4.1 0 7.3 3 7.3 6.9 0 4.1-2.6 7.4-6.2 7.4-1.2 0-2.4-.6-2.8-1.4l-.7 2.9c-.3 1-1 2.3-1.5 3.1A10 10 0 1 0 12 2z"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon">${ICONS[name] || ''}</svg>`;

export function contactBlock() {
  const c = site.contact;
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.formattedAddress)}`;
  return `<address class="contact-block">
    <a href="${esc(map)}" target="_blank" rel="noopener">${icon('address')}<span>${esc(c.formattedAddress)}</span></a>
    <a href="tel:${esc(c.formattedPhone.replace(/[^\d+]/g, ''))}">${icon('phone')}<span>${esc(c.formattedPhone)}</span></a>
    <a href="mailto:${esc(c.email)}">${icon('email')}<span>${esc(c.email)}</span></a>
  </address>`;
}

export function socialLinks() {
  return `<ul class="social-links">${Object.entries(site.social).map(([k, url]) =>
    `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(k)}">${icon(k)}</a></li>`).join('')}</ul>`;
}

export function hero(title, key, size = 'standard') {
  const bg = key ? ` style="background-image:url('${media(key)}')"` : '';
  return `<section class="hero hero--${size}"${bg}><div class="hero__shade"></div><h1 class="title-1">${esc(title)}</h1></section>`;
}

/** Who he is, for search engines: the business, where it is, what it does and where. */
export function business() {
  const [street, city, rest] = site.contact.formattedAddress.split(', ');
  const [region, postalCode] = (rest || '').split(' ');
  return {
    '@context': 'https://schema.org', '@type': 'HomeAndConstructionBusiness', '@id': `${ORIGIN}/#business`,
    name: site.name, legalName: site.legalName, url: `${ORIGIN}/`, logo: `${ORIGIN}/img/logo-square.png`,
    image: `${ORIGIN}/img/logo.jpg`, description: site.seoDescription,
    telephone: site.contact.formattedPhone, email: site.contact.email,
    address: { '@type': 'PostalAddress', streetAddress: street, addressLocality: city, addressRegion: region, postalCode, addressCountry: 'US' },
    areaServed: ['Telluride, CO', 'Mountain Village, CO', 'Montrose, CO', 'Ridgway, CO', 'Ouray, CO', 'San Miguel County, CO'].map((name) => ({ '@type': 'Place', name })),
    knowsAbout: ['Custom cabinetry', 'Kitchen cabinets', 'Bathroom vanities', 'Closets', 'Built-ins', 'Trim packages', 'Custom furniture'],
    sameAs: Object.values(site.social),
  };
}

/** The whole page: head, header with the menu, the body given, footer. */
export function page({ title, path, canonical = path, body, description = '', image = '', noindex = false, ld = [] }) {
  const nav = NAV.map(([href, label]) =>
    `<li><a class="nav__link${href === path ? ' nav__link--active' : ''}" href="${href}">${esc(label)}</a></li>`).join('');
  const fullTitle = title === site.name ? site.seoTitle : `${title} | ${site.name}`;
  const desc = (description || site.seoDescription).replace(/\s+/g, ' ').slice(0, 300);
  const img = image ? new URL(image, ORIGIN).toString() : `${ORIGIN}/img/logo.jpg`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(ORIGIN + canonical)}">`}
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(ORIGIN + canonical)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/img/logo-square.png">
<link rel="preload" href="/fonts/unna-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/playfair-display-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/styles.css">
${[business(), ...ld].map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body>
<a class="skip" href="#main">Skip to main content</a>
<header class="header">
  <a class="logo" href="/"><img src="/img/logo.jpg" alt="Jensen Design logo" width="360"></a>
  <button class="nav-toggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
  <nav class="nav"><ul>${nav}</ul></nav>
</header>
<main id="main">
${body}
</main>
<footer class="footer">
  ${contactBlock()}
  ${socialLinks()}
  <p class="footer__links"><a href="/privacy">Privacy Policy</a></p>
</footer>
<script src="/site.js" defer></script>
</body>
</html>`;
}

export const html = (body, status = 200, headers = {}) => new Response(body, {
  status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60', ...headers },
});
