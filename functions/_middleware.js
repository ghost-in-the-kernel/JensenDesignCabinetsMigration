import { ORIGIN } from './_lib/html.js';

// One address for search engines: www and telluridecabinets.com redirect to jensendesigncabinets.com
// for good (301), so Google counts one site, not four. Any other host (the pages.dev staging address,
// a preview) still works but asks search engines to stay away, so it never competes with the real one.
const REDIRECT = new Set(['www.jensendesigncabinets.com', 'telluridecabinets.com', 'www.telluridecabinets.com']);
const CANONICAL = new URL(ORIGIN).hostname;

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (REDIRECT.has(url.hostname)) return Response.redirect(`${ORIGIN}${url.pathname}${url.search}`, 301);
  const response = await next();
  if (url.hostname === CANONICAL) return response;
  const marked = new Response(response.body, response);
  marked.headers.set('x-robots-tag', 'noindex, nofollow');
  return marked;
}
