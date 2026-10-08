// Photos are shrunk here, in the browser, before they go up (a 2000px copy and an 800px thumbnail),
// however large the camera made them; that also drops the camera's metadata, GPS included.
// The admin page: galleries (add, rename, reorder, remove), photos (add, caption, cover, reorder,
// remove) and the messages people sent from the contact form. Talks to /api/admin.

import { makeZip } from './zip.js';

const app = document.getElementById('app');
const WEB = 2000, THUMB = 800;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// The bucket layout is in functions/_lib/storage.js; this is its photos/ thumbnail address.
const thumb = (g, p) => `/media/photos/${encodeURIComponent(g.slug)}/${encodeURIComponent(p.id)}-t.jpg`;
const shortName = (name) => name.split(' | ')[0];

function toast(msg, bad = false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = bad ? 'show bad' : 'show';
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.className = ''; }, bad ? 6000 : 3000);
}

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { 'x-admin': '1' };
  if (body) headers['content-type'] = 'application/json';
  const r = await fetch(`/api/admin/${path}`, { method, headers, body: form || (body && JSON.stringify(body)) });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { location.reload(); throw new Error('Signed out'); }
  if (!r.ok) throw new Error(data.error || `Something went wrong (${r.status}).`);
  return data;
}

async function act(fn, done) {
  try { await fn(); if (done) toast(done); } catch (e) { toast(e.message, true); }
  render();
}

// ---- Downloading his photos -----------------------------------------------------------------

const folderName = (g) => shortName(g.name).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Gallery';

// The full-size photo where the bucket has one (the photos from Houzz), else the 2000px copy.
const fileFor = (g, p) => {
  const slug = encodeURIComponent(g.slug), id = encodeURIComponent(p.id);
  if (p.original) return [`/api/admin/originals/${slug}/${id}.${p.original}`, p.original];
  if (p.kind === 'video') return [`/media/photos/${slug}/${id}.mp4`, 'mp4'];
  return [`/media/photos/${slug}/${id}-w.jpg`, 'jpg'];
};

async function galleryZip(g, progress) {
  const folder = folderName(g), files = [], list = [];
  for (const [i, p] of g.photos.entries()) {
    progress(`${shortName(g.name)}: photo ${i + 1} of ${g.photos.length}`);
    const [url, ext] = fileFor(g, p);
    const r = await fetch(url, { headers: { 'x-admin': '1' } });
    if (!r.ok) throw new Error(`Photo ${i + 1} of ${shortName(g.name)} could not be fetched (${r.status}).`);
    const name = `${String(i + 1).padStart(2, '0')}.${ext}`;
    files.push({ name: `${folder}/${name}`, data: new Uint8Array(await r.arrayBuffer()) });
    list.push([name, p.title, p.caption].filter(Boolean).join('  -  '));
  }
  const about = [g.name, g.description, '', ...list].filter((x, i) => x || i > 1).join('\r\n');
  files.push({ name: `${folder}/photos.txt`, data: new TextEncoder().encode(about) });
  return makeZip(files);
}

function save(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

async function download(galleries, status) {
  const show = (t) => { status.textContent = t; };
  try {
    for (const g of galleries.filter((x) => x.photos.length)) save(await galleryZip(g, show), `${folderName(g)}.zip`);
    show('');
    toast(galleries.length > 1 ? 'Done: one zip file per gallery is in your Downloads folder.' : 'Done: the zip file is in your Downloads folder.');
  } catch (e) {
    show(''); toast(e.message, true);
  }
}

// ---- Galleries -------------------------------------------------------------------------------

let state = { galleries: [] };

async function listView() {
  state = await api('galleries');
  app.innerHTML = `
<h1>Galleries</h1>
<p class="hint">These are the projects on the website, in the order they appear. The first ${5} are also the slideshow on the home page.</p>
<div class="card download">
  <div><strong>Your photos</strong><br><span class="hint">Download every gallery to this computer: one zip file per gallery, full size where we have it. Your browser may ask once to allow several downloads.</span></div>
  <button id="download-all">Download all photos</button>
  <span class="progress" id="download-status"></span>
</div>
<form class="card new" id="new">
  <h2>Add a new gallery</h2>
  <label>Name <input name="name" required maxlength="120" placeholder="e.g. Aspen Kitchen | Telluride, CO"></label>
  <label>Description (optional) <textarea name="description" rows="2" maxlength="2000"></textarea></label>
  <button class="big">Add gallery</button>
</form>
<ol class="galleries">${state.galleries.map((g, i) => {
    const cover = g.photos.find((p) => p.id === g.cover) || g.photos[0];
    return `<li class="card gallery" data-id="${esc(g.id)}">
  <a href="#gallery/${esc(g.id)}" class="gallery__open">
    ${cover ? `<img src="${thumb(g, cover)}" alt="">` : '<div class="empty">No photos yet</div>'}
    <span><strong>${esc(shortName(g.name))}</strong><br>${g.photos.length} photo${g.photos.length === 1 ? '' : 's'}</span>
  </a>
  <div class="buttons">
    <a class="button" href="#gallery/${esc(g.id)}">Open</a>
    <button data-download ${g.photos.length ? '' : 'disabled'}>Download</button>
    <button data-move="${i - 1}" ${i === 0 ? 'disabled' : ''} title="Move up">&uarr;</button>
    <button data-move="${i + 1}" ${i === state.galleries.length - 1 ? 'disabled' : ''} title="Move down">&darr;</button>
    <button class="danger" data-delete>Delete</button>
  </div>
</li>`;
  }).join('')}</ol>`;

  const status = document.getElementById('download-status');
  document.getElementById('download-all').onclick = () => download(state.galleries, status);
  document.getElementById('new').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    act(async () => {
      const g = await api('galleries', { method: 'POST', body: { name: f.get('name'), description: f.get('description') } });
      location.hash = `gallery/${g.id}`;
    }, 'Gallery added. Now add its photos.');
  };
  app.querySelectorAll('.gallery').forEach((li) => {
    const id = li.dataset.id, g = state.galleries.find((x) => x.id === id);
    li.querySelectorAll('[data-move]').forEach((b) => { b.onclick = () => act(() => api(`galleries/${id}/move`, { method: 'POST', body: { to: Number(b.dataset.move) } })); });
    li.querySelector('[data-download]').onclick = () => download([g], status);
    li.querySelector('[data-delete]').onclick = () => {
      if (!confirm(`Delete the gallery "${shortName(g.name)}" and all ${g.photos.length} of its photos from the website? This cannot be undone.`)) return;
      act(() => api(`galleries/${id}`, { method: 'DELETE' }), 'Gallery deleted.');
    };
  });
}

async function resize(file, edge) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, edge / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
  return { blob, w: bmp.width, h: bmp.height };
}

async function upload(g, files, progress) {
  let done = 0, failed = [];
  for (const file of files) {
    progress.textContent = `Uploading photo ${done + failed.length + 1} of ${files.length}: ${file.name}`;
    try {
      const web = await resize(file, WEB), small = await resize(file, THUMB);
      const form = new FormData();
      form.append('web', web.blob, 'web.jpg');
      form.append('thumb', small.blob, 'thumb.jpg');
      form.append('w', web.w); form.append('h', web.h);
      form.append('title', shortName(g.name));
      await api(`galleries/${g.id}/photos`, { method: 'POST', form });
      done++;
    } catch (e) {
      failed.push(`${file.name} (${e.message.includes('decode') || e.name === 'InvalidStateError' ? 'this kind of photo cannot be read here; try a JPEG' : e.message})`);
    }
  }
  progress.textContent = '';
  if (failed.length) toast(`${done} added. These did not upload: ${failed.join('; ')}`, true);
  else toast(`${done} photo${done === 1 ? '' : 's'} added.`);
  render();
}

async function galleryView(id) {
  state = await api('galleries');
  const g = state.galleries.find((x) => x.id === id);
  if (!g) { location.hash = ''; return; }
  app.innerHTML = `
<p><a href="#galleries">&larr; All galleries</a></p>
<form class="card" id="details">
  <label>Name <input name="name" required maxlength="120" value="${esc(g.name)}"></label>
  <label>Description (optional) <textarea name="description" rows="3" maxlength="2000">${esc(g.description)}</textarea></label>
  <div class="buttons"><button class="big">Save name and description</button>
  <a class="button" href="/projects/${esc(g.slug)}" target="_blank">See it on the site</a>
  <button type="button" id="download" ${g.photos.length ? '' : 'disabled'}>Download these photos</button>
  <span class="progress" id="download-status"></span></div>
</form>
<label class="card drop" id="drop">
  <strong>Add photos</strong>
  <span>Click here to choose photos, or drag them onto this box. You can pick many at once.</span>
  <input type="file" accept="image/*" multiple hidden>
  <span id="progress" class="progress"></span>
</label>
<h2>${g.photos.length} photo${g.photos.length === 1 ? '' : 's'} <small>(the first is shown first; the starred one is the gallery's picture)</small></h2>
<ol class="photos">${g.photos.map((p, i) => `
<li class="card photo${g.cover === p.id ? ' is-cover' : ''}" data-pid="${esc(p.id)}">
  <img loading="lazy" src="${thumb(g, p)}" alt="">${p.kind === 'video' ? '<span class="tag">Video</span>' : ''}
  <input class="caption" value="${esc(p.caption || '')}" placeholder="Caption (optional)" maxlength="1000">
  <div class="buttons">
    <button data-move="${i - 1}" ${i === 0 ? 'disabled' : ''} title="Move earlier">&larr;</button>
    <button data-move="${i + 1}" ${i === g.photos.length - 1 ? 'disabled' : ''} title="Move later">&rarr;</button>
    <button data-cover title="Use as the gallery's picture">${g.cover === p.id ? '&#9733;' : '&#9734;'}</button>
    <button class="danger" data-delete>Delete</button>
  </div>
</li>`).join('')}</ol>`;

  document.getElementById('details').onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    act(() => api(`galleries/${id}`, { method: 'PATCH', body: { name: f.get('name'), description: f.get('description') } }), 'Saved.');
  };
  document.getElementById('download').onclick = () => download([g], document.getElementById('download-status'));
  const drop = document.getElementById('drop'), input = drop.querySelector('input'), progress = document.getElementById('progress');
  input.onchange = () => input.files.length && upload(g, [...input.files], progress);
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => {
    e.preventDefault(); drop.classList.remove('over');
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) upload(g, files, progress);
  };
  app.querySelectorAll('.photo').forEach((li) => {
    const pid = li.dataset.pid, path = `galleries/${id}/photos/${pid}`;
    li.querySelectorAll('[data-move]').forEach((b) => { b.onclick = () => act(() => api(`${path}/move`, { method: 'POST', body: { to: Number(b.dataset.move) } })); });
    li.querySelector('[data-cover]').onclick = () => act(() => api(`galleries/${id}`, { method: 'PATCH', body: { cover: pid } }), 'Gallery picture set.');
    li.querySelector('[data-delete]').onclick = () => {
      if (!confirm('Delete this photo from the website? This cannot be undone.')) return;
      act(() => api(path, { method: 'DELETE' }), 'Photo deleted.');
    };
    const cap = li.querySelector('.caption');
    cap.onchange = async () => { try { await api(path, { method: 'PATCH', body: { caption: cap.value } }); toast('Caption saved.'); } catch (e) { toast(e.message, true); } };
  });
}

// ---- Messages --------------------------------------------------------------------------------

async function messagesView() {
  const list = await api('messages');
  app.innerHTML = `<h1>Messages</h1>
<p class="hint">What people sent from the contact form, newest first.</p>
${list.length ? '' : '<p>No messages yet.</p>'}
${list.map((m) => `<article class="card message" data-key="${esc(m.key.split('/')[1])}">
  <p><strong>${esc(m.name)}</strong> &middot; <a href="mailto:${esc(m.email)}">${esc(m.email)}</a>${m.phone ? ` &middot; <a href="tel:${esc(m.phone)}">${esc(m.phone)}</a>` : ''}
  <br><small>${esc(new Date(m.received).toLocaleString())}</small></p>
  <p class="message__body">${esc(m.message)}</p>
  <button class="danger" data-delete>Delete</button>
</article>`).join('')}`;
  app.querySelectorAll('.message').forEach((a) => {
    a.querySelector('[data-delete]').onclick = () => {
      if (confirm('Delete this message?')) act(() => api(`messages/${a.dataset.key}`, { method: 'DELETE' }), 'Message deleted.');
    };
  });
}

// ---- Settings: how he hears about new messages ----------------------------------------------

async function settingsView() {
  const { settings: s, channels: c, email } = await api('settings');
  const phoneReady = c.push || c.text;
  const notReady = '<p class="hint warn">Not set up yet on the website\'s side, so nothing will be sent this way until it is.</p>';
  app.innerHTML = `<h1>Settings</h1>
<form class="card" id="settings">
  <h2>When someone sends a message from the website, tell me&hellip;</h2>
  <label class="check"><input type="checkbox" name="notifyEmail" ${s.notifyEmail ? 'checked' : ''}> By email, to ${esc(email)}</label>
  ${c.email ? '' : notReady}
  <label class="check"><input type="checkbox" name="notifyPhone" ${s.notifyPhone ? 'checked' : ''}> On my phone${c.push && !c.text ? ' (a notification from the ntfy app)' : c.text ? ' (a text message)' : ''}</label>
  ${phoneReady ? '' : notReady}
  ${c.text ? `<label>My cell phone number <input name="phoneNumber" type="tel" value="${esc(s.phoneNumber)}" placeholder="(970) 555-1234"></label>` : ''}
  <p class="hint">Every message is also kept here under Messages for a year, whatever you choose.</p>
  <div class="buttons"><button class="big">Save</button><button type="button" id="test">Send me a test</button></div>
</form>`;
  const form = document.getElementById('settings');
  form.onsubmit = (e) => {
    e.preventDefault();
    const f = new FormData(form), body = { notifyEmail: f.has('notifyEmail'), notifyPhone: f.has('notifyPhone') };
    if (f.has('phoneNumber')) body.phoneNumber = f.get('phoneNumber');
    act(() => api('settings', { method: 'PUT', body }), 'Saved.');
  };
  document.getElementById('test').onclick = async () => {
    try {
      const { results } = await api('settings/test', { method: 'POST' });
      if (!results.length) toast('Nothing to send: no way of telling you is both chosen and set up.', true);
      else toast(results.map((r) => `${r.how}: ${r.ok ? 'sent' : `failed (${r.error})`}`).join('; '), results.some((r) => !r.ok));
    } catch (e) { toast(e.message, true); }
  };
}

// ---- Routing ---------------------------------------------------------------------------------

async function render() {
  const [view, id] = location.hash.replace(/^#/, '').split('/');
  try {
    if (view === 'gallery' && id) await galleryView(id);
    else if (view === 'messages') await messagesView();
    else if (view === 'settings') await settingsView();
    else await listView();
  } catch (e) {
    app.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}
window.addEventListener('hashchange', render);
render();
