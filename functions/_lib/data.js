import { GALLERIES as KEY } from './storage.js';

/** The galleries and the R2 etag they were read at (for a write that must not lose another). */
export async function loadGalleries(env) {
  const obj = await env.MEDIA.get(KEY);
  if (!obj) return { data: { galleries: [] }, etag: null };
  return { data: await obj.json(), etag: obj.etag };
}

/** Writes the galleries only if nobody wrote them since they were read; false if somebody did. */
export async function saveGalleries(env, data, etag) {
  const options = { httpMetadata: { contentType: 'application/json' } };
  if (etag) options.onlyIf = { etagMatches: etag };
  const result = await env.MEDIA.put(KEY, JSON.stringify(data, null, 1), options);
  return result !== null;
}

export const coverOf = (g) => g.photos.find((p) => p.id === g.cover) || g.photos[0];

export const shortName = (name) => name.split(' | ')[0];
