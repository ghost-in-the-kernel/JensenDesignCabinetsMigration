// Photos are shrunk here, in the browser, before they go up (a 2000px copy and an 800px thumbnail),
// however large the camera made them; that also drops the camera's metadata, GPS included.
// The admin page: galleries (add, rename, reorder, remove), photos (add, caption, cover, reorder,
// remove) and the messages people sent from the contact form. Talks to /api/admin.

const app = document.getElementById('app');
const WEB = 2000, THUMB = 800;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const thumb = (g, p) => `/media/g/${encodeURIComponent(g.slug)}/${encodeURIComponent(p.id)}-t.jpg`;
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

// ---- Galleries -------------------------------------------------------------------------------

let state = { galleries: [] };

async function listView() {
  state = await api('galleries');
  app.innerHTML = `
<h1>Galleries</h1>
<p class="hint">These are the projects on the website, in the order they appear. The first ${5} are also the slideshow on the home page.</p>
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
    <button data-move="${i - 1}" ${i === 0 ? 'disabled' : ''} title="Move up">&uarr;</button>
    <button data-move="${i + 1}" ${i === state.galleries.length - 1 ? 'disabled' : ''} title="Move down">&darr;</button>
    <button class="danger" data-delete>Delete</button>
  </div>
</li>`;
  }).join('')}</ol>`;

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
  <a class="button" href="/projects/${esc(g.slug)}" target="_blank">See it on the site</a></div>
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

// ---- Routing ---------------------------------------------------------------------------------

async function render() {
  const [view, id] = location.hash.replace(/^#/, '').split('/');
  try {
    if (view === 'gallery' && id) await galleryView(id);
    else if (view === 'messages') await messagesView();
    else await listView();
  } catch (e) {
    app.innerHTML = `<p class="error">${esc(e.message)}</p>`;
  }
}
window.addEventListener('hashchange', render);
render();
