import { loadGalleries, saveGalleries } from '../../_lib/data.js';
import { channels, loadSettings, saveSettings } from '../../_lib/settings.js';
import { notifyOwner } from '../../_lib/notify.js';
import { site } from '../../_lib/html.js';
import { MESSAGES, ORIGINALS, galleryPrefix, originalKey, originalsPrefix, photoKey } from '../../_lib/storage.js';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
const fail = (error, status = 400) => json({ error }, status);

class Problem extends Error { constructor(msg, status = 400) { super(msg); this.status = status; } }

/** Load, change, save the gallery list; tries again if another change landed in between. */
async function mutate(env, change) {
  for (let i = 0; i < 4; i++) {
    const { data, etag } = await loadGalleries(env);
    const result = await change(data);
    if (await saveGalleries(env, data, etag)) return result;
  }
  throw new Problem('The galleries were busy; please try again.', 409);
}

const kebab = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60);
const text = (v, max) => String(v ?? '').trim().slice(0, max);
const gallery = (data, id) => data.galleries.find((g) => g.id === id) || (() => { throw new Problem('No such gallery.', 404); })();
const move = (list, from, to) => { const [x] = list.splice(from, 1); list.splice(Math.max(0, Math.min(to, list.length)), 0, x); };

async function deletePrefix(env, prefix) {
  let cursor;
  do {
    const page = await env.MEDIA.list({ prefix, cursor });
    if (page.objects.length) await env.MEDIA.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

async function addPhoto(request, env, id) {
  const f = await request.formData();
  const web = f.get('web'), thumb = f.get('thumb');
  if (!(web instanceof File) || !(thumb instanceof File)) throw new Problem('The photo did not arrive; please try again.');
  if (web.size > 8e6 || thumb.size > 2e6) throw new Problem('That photo is too large.');
  const { data } = await loadGalleries(env);
  const g = gallery(data, id);
  const pid = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const key = photoKey(g, pid);
  const jpeg = { httpMetadata: { contentType: 'image/jpeg' } };
  await env.MEDIA.put(`${key}-w.jpg`, web.stream(), jpeg);
  await env.MEDIA.put(`${key}-t.jpg`, thumb.stream(), jpeg);
  const photo = { id: pid, kind: 'image', title: text(f.get('title'), 200), caption: text(f.get('caption'), 1000),
    alt: text(f.get('title'), 200), w: Number(f.get('w')) || 0, h: Number(f.get('h')) || 0, added: new Date().toISOString() };
  try {
    return await mutate(env, (d) => {
      const target = gallery(d, id);
      target.photos.push(photo);
      if (!target.cover) target.cover = pid;
      return photo;
    });
  } catch (e) {
    await deletePrefix(env, key); // the gallery went away meanwhile: leave nothing behind
    throw e;
  }
}

async function route(request, env, parts) {
  const method = request.method;
  const body = () => request.json().catch(() => ({}));
  const [area, id, sub, pid, action] = parts;

  if (area === 'galleries') {
    if (!id && method === 'GET') return (await loadGalleries(env)).data;
    if (!id && method === 'POST') {
      const b = await body();
      const name = text(b.name, 120);
      if (!name) throw new Problem('A gallery needs a name.');
      return mutate(env, (d) => {
        let n = Date.now() % 1e9;
        while (d.galleries.some((g) => g.id === String(n))) n++;
        const g = { id: String(n), slug: `${n}-${kebab(name) || 'gallery'}`, name, description: text(b.description, 2000), cover: null, photos: [] };
        d.galleries.unshift(g);
        return g;
      });
    }
    if (id && !sub && method === 'PATCH') {
      const b = await body();
      return mutate(env, (d) => {
        const g = gallery(d, id);
        if ('name' in b) { const name = text(b.name, 120); if (!name) throw new Problem('A gallery needs a name.'); g.name = name; }
        if ('description' in b) g.description = text(b.description, 2000);
        if ('cover' in b) { if (!g.photos.some((p) => p.id === b.cover)) throw new Problem('No such photo.'); g.cover = b.cover; }
        return g;
      });
    }
    if (id && !sub && method === 'DELETE') {
      const g = await mutate(env, (d) => { const g = gallery(d, id); d.galleries = d.galleries.filter((x) => x !== g); return g; });
      await deletePrefix(env, galleryPrefix(g));
      await deletePrefix(env, originalsPrefix(g));
      return { deleted: g.id };
    }
    if (id && sub === 'move' && method === 'POST') {
      const { to } = await body();
      return mutate(env, (d) => { move(d.galleries, d.galleries.indexOf(gallery(d, id)), Number(to)); return { ok: true }; });
    }
    if (id && sub === 'photos' && !pid && method === 'POST') return addPhoto(request, env, id);
    if (id && sub === 'photos' && pid) {
      const find = (d) => { const g = gallery(d, id); const p = g.photos.find((x) => x.id === pid); if (!p) throw new Problem('No such photo.', 404); return [g, p]; };
      if (!action && method === 'PATCH') {
        const b = await body();
        return mutate(env, (d) => {
          const [g, p] = find(d);
          if ('title' in b) p.title = text(b.title, 200);
          if ('caption' in b) { p.caption = text(b.caption, 1000); if (p.caption) p.alt = `${p.caption}, by Jensen Design`; }
          return p;
        });
      }
      if (!action && method === 'DELETE') {
        const g = await mutate(env, (d) => {
          const [g, p] = find(d);
          g.photos = g.photos.filter((x) => x !== p);
          if (g.cover === pid) g.cover = g.photos[0]?.id || null;
          return g;
        });
        await deletePrefix(env, photoKey(g, pid));
        await deletePrefix(env, originalKey(g, pid));
        return { deleted: pid };
      }
      if (action === 'move' && method === 'POST') {
        const { to } = await body();
        return mutate(env, (d) => { const [g, p] = find(d); move(g.photos, g.photos.indexOf(p), Number(to)); return { ok: true }; });
      }
    }
  }

  if (area === 'messages') {
    if (!id && method === 'GET') {
      const page = await env.MEDIA.list({ prefix: MESSAGES });
      const keys = page.objects.map((o) => o.key).sort().reverse().slice(0, 200);
      return Promise.all(keys.map(async (key) => ({ key, ...(await (await env.MEDIA.get(key)).json()) })));
    }
    if (id && method === 'DELETE') {
      if (!/^[\w-]+\.json$/.test(id)) throw new Problem('No such message.', 404);
      await env.MEDIA.delete(`${MESSAGES}${id}`);
      return { deleted: id };
    }
  }

  // His full-size photos, for the admin page's download buttons; private, so only through here.
  if (area === 'originals' && method === 'GET' && id && sub && !pid) {
    if (!/^[\w-]+$/.test(id) || !/^[\w-]+\.\w+$/.test(sub)) throw new Problem('No such photo.', 404);
    const obj = await env.MEDIA.get(`${ORIGINALS}${id}/${sub}`);
    if (!obj) throw new Problem('No such photo.', 404);
    const headers = new Headers({ 'cache-control': 'private, no-store' });
    obj.writeHttpMetadata(headers);
    return new Response(obj.body, { headers });
  }

  if (area === 'settings') {
    const view = async (s) => ({ settings: s, channels: channels(env), email: site.contact.email });
    if (!id && method === 'GET') return view(await loadSettings(env));
    if (!id && method === 'PUT') {
      const b = await body(), s = await loadSettings(env);
      if ('notifyEmail' in b) s.notifyEmail = Boolean(b.notifyEmail);
      if ('notifyPhone' in b) s.notifyPhone = Boolean(b.notifyPhone);
      if ('phoneNumber' in b) {
        const digits = String(b.phoneNumber).replace(/[^\d+]/g, '');
        const e164 = digits.startsWith('+') ? digits : digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits[0] === '1' ? `+${digits}` : '';
        if (b.phoneNumber && !e164) throw new Problem('Please enter a 10-digit phone number.');
        s.phoneNumber = e164;
      }
      await saveSettings(env, s);
      return view(s);
    }
    if (id === 'test' && method === 'POST') {
      const s = await loadSettings(env);
      const results = await notifyOwner(env, { name: 'Test', email: site.contact.email, phone: '',
        message: 'This is a test from the website admin. Messages from the contact form will look like this.' }, s);
      return { results };
    }
  }

  if (area === 'me' && method === 'GET') return null;
  throw new Problem('Not found.', 404);
}

export async function onRequest({ request, env, params, data }) {
  try {
    const result = await route(request, env, params.route || []);
    if (result instanceof Response) return result;
    return json(result ?? { email: data.email });
  } catch (e) {
    if (e instanceof Problem) return fail(e.message, e.status);
    console.error(e);
    return fail('Something went wrong on the server.', 500);
  }
}
