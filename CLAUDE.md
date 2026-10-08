# Jensen Design site: for an agent working in this repository

The website of Jensen Design (custom cabinetry, Montrose and Telluride, CO), moved off Houzz to
Cloudflare. We look after it for the owner, who is not technical: he adds and removes galleries in
`/admin` and should never need anything else. Read `README.md` for how it is built and launched.

## The rule that matters most: his data is not the code

His photos, galleries (`data/galleries.json`), settings and contact messages live in the R2 bucket
`jensen-design-media`, laid out as `functions/_lib/storage.js` says. That file is the only place a
bucket path is spelled out in `functions/`; use its helpers (`photoKey`, `galleryPrefix`, `media`).

- Deploying the code never touches the bucket. Nothing in the code may write the bucket except the
  admin API (`functions/api/admin/`) and the contact form.
- Never overwrite or delete `data/` in the live bucket from a tool or a script. `tools/upload_r2.sh`
  refuses to; keep it that way. Before anything that changes the live bucket: `npm run backup`.
- Try changes on the preview (`npm run deploy:preview`, its own bucket) or locally (`npm run dev`),
  never against his live bucket.
- His photos, the Houzz archive (`archive/`) and backups (`backups/`) never go into git. Images that
  belong to the code (logos) go in `public/img/`.

## Where things are

| What | Where |
| --- | --- |
| Pages and their HTML | `functions/*.js`, `functions/projects/`; the shared layout in `functions/_lib/html.js` |
| The words on the pages | `content/site.json` (written once by `tools/build_content.py`; edit by hand after) |
| Look | `public/styles.css` (his Houzz theme's colours and fonts; fonts served from `public/fonts/`) |
| Slideshows, phone menu, click-to-load map | `public/site.js` |
| Admin page and its API | `functions/admin/`, `public/admin.js`, `public/admin.css`, `functions/api/admin/` |
| His photo downloads (zip in the browser) | `public/zip.js`, `download()` in `public/admin.js`; full-size photos are private under `originals/` |
| Who may use the admin | Cloudflare Access; checked again in `functions/_lib/access.js` |
| Contact form and its notices | `functions/contact.js`, `functions/_lib/notify.js` (email by default, phone if he turns it on), `functions/_lib/settings.js` |
| Redirects and search engines | `functions/_middleware.js` (one canonical host), `functions/sitemap.xml.js`, `public/robots.txt` |
| Moving off Houzz, backups | `tools/` |

## Promises the site makes; keep them true

- The privacy page (`functions/privacy.js`) says: no tracking or analytics, nothing loaded from
  other companies unless the visitor clicks the map, messages deleted after a year. A change that
  adds a third-party script, font or embed, or keeps messages longer, changes that page too.
- A page loads only the photos on screen; slideshows load each photo as it is shown. Photos are
  stored at 2000px and 800px, shrunk in the browser before upload, with their GPS removed.
- Old Houzz addresses (`/projects/<id>-<name>`) keep working.
- The admin page is for someone who is not technical: plain words, big buttons, confirm before
  deleting, and say what happened.

## Before calling work done

Run it: `npm run dev` (with `DEV_ADMIN_EMAIL=you@example.com` in `.dev.vars`), fill the local
bucket with `node tools/load_local.mjs <staged folder>`, and check the change in a browser,
including on a phone-sized window. Check every page still answers 200 and the admin still adds and
deletes a photo.
