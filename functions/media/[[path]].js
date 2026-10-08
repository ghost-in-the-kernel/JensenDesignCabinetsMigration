import { PUBLIC } from '../_lib/storage.js';

// Photos and videos from R2: only what is under the public prefixes (never data/ or messages/).
export async function onRequestGet({ request, env, params }) {
  const key = (params.path || []).map(decodeURIComponent).join('/');
  if (!PUBLIC.some((prefix) => key.startsWith(prefix)) || key.includes('..')) return new Response('Not found', { status: 404 });
  const obj = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers });
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  if (!headers.get('content-type')) headers.set('content-type', key.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
  if (!('body' in obj)) return new Response(null, { status: 304, headers });
  if (obj.range && request.headers.has('range')) {
    const { offset = 0, length = obj.size - offset } = obj.range;
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${obj.size}`);
    headers.set('content-length', String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  return new Response(obj.body, { headers });
}
