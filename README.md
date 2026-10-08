# Jensen Design site

jensendesigncabinets.com (and telluridecabinets.com), moved off Houzz to Cloudflare: the same pages
and look, the same project addresses, and a small admin page where he adds and removes galleries and
photos himself. Free on Cloudflare's free tier; the only cost left is the domain renewals.

## How it is built

- **Cloudflare Pages** serves the site. Each page is put together on request by a Pages Function
  (`functions/`) from `content/site.json` (the words) and `data/galleries.json` in R2 (the projects).
- **R2** (bucket `jensen-design-media`) holds the photos (a 2000px web copy and an 800px thumbnail of
  each), the videos, the gallery list and the contact-form messages.
- **Cloudflare Access** guards `/admin` and `/api/admin`: he signs in with a one-time code sent to
  his email; nobody else gets in. Sign out is a link on the admin page.
- **The admin page** (`/admin`): add, rename, reorder and delete galleries; add photos (many at once,
  shrunk in his browser first however big the camera made them, and with the camera's GPS removed),
  caption, reorder, choose the gallery's picture, delete; read the contact-form messages.
- **Speed**: a page loads only the photos on screen; a project slideshow loads each photo just before
  it is shown; phones get the smaller copies.
- **Search**: one address (www and telluridecabinets.com redirect to it), a title and description on
  every page that say what he does and where, descriptive alt text on every photo, business and
  gallery data for Google (schema.org), a sitemap with every photo, and the old Houzz project
  addresses unchanged so their place in search results carries over. Any other address (the
  pages.dev review copy) tells search engines to stay away.

## Moving the site (once)

1. **Copy everything off Houzz** (needs `st.hzcdn.com` and `vst.hzcdn.com` reachable, and ffmpeg):
   ```
   python3 tools/extract.py https://jensendesigncabinets.com archive/site
   python3 tools/download.py archive/site/manifest.json archive
   python3 tools/build_content.py archive
   ```
   The bucket then holds his full-size photos too (privately): he downloads any gallery, or all of
   them, from the admin page. (`archive/for-dad/` has the same as plain folders, if he wants a USB
   stick instead.) `archive/` never goes into git.
2. **Cloudflare** (`npm install`; a Cloudflare API token with Workers R2 Storage: Edit and Cloudflare
   Pages: Edit in `CLOUDFLARE_API_TOKEN`, and the account's id in `CLOUDFLARE_ACCOUNT_ID`):
   ```
   npx wrangler r2 bucket create jensen-design-media
   npx wrangler r2 bucket lifecycle add jensen-design-media delete-old-messages messages/ --expire-days 365
   python3 tools/upload_r2.py archive/r2
   npx wrangler pages project create jensen-design --production-branch main
   npm run deploy
   ```
   The site is then at https://jensen-design.pages.dev for him to review.
3. **Admin sign-in**: Cloudflare dashboard, Zero Trust, Access, Applications, Add, Self-hosted. Add
   the paths `jensen-design.pages.dev/admin` and `jensen-design.pages.dev/api/admin` (later the same
   two on jensendesigncabinets.com), with a policy that allows his email and yours. Put the team name
   (from `<team>.cloudflareaccess.com`) and the application's Audience (AUD) tag in `wrangler.toml`
   as `ACCESS_TEAM` and `ACCESS_AUD`, then `npm run deploy` again.
4. **Domains**: he adds both domains to Cloudflare and changes their nameservers where he bought
   them. Before the switch, copy every existing DNS record (Cloudflare's import usually finds them;
   check for MX and TXT records in particular). Then the Pages project's Custom domains gets
   `jensendesigncabinets.com`, `www.jensendesigncabinets.com`, `telluridecabinets.com` and
   `www.telluridecabinets.com`, and the Access application gets the two admin paths on
   jensendesigncabinets.com. Allow up to 48 hours for the change to settle before cancelling Houzz.
5. **Contact-form email (required)**: his main way of hearing from the site. On the
   jensendesigncabinets.com zone: Email, Email Routing, enable (it adds the records it needs; his own
   mail is at rmi.net, so nothing of his changes), and add `jdesign@rmi.net` as a destination address:
   he must click the link in the email Cloudflare sends him. Then uncomment the `send_email` lines and
   `MAIL_FROM` in `wrangler.toml`, `npm run deploy`, and press "Send me a test" in the admin's
   Settings. Every notice comes from `website@jensendesigncabinets.com` with the subject "Website
   message from <name>", so one rule in his inbox files them all; replying answers the sender.
6. **Phone notices (optional)**: he can also turn on phone notices in Settings, once a channel is
   set up. Free push notification: he installs the ntfy app and subscribes to a long random topic
   name; `npx wrangler pages secret put NTFY_URL` with `https://ntfy.sh/<that name>`. (Real text
   messages through Twilio are also built in: the `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and
   `TWILIO_FROM` secrets, his number in Settings, and the carriers' business registration first.)
7. **After launch**: in Google Search Console, verify jensendesigncabinets.com (a DNS record,
   one click on Cloudflare) and submit `https://jensendesigncabinets.com/sitemap.xml`. In his Google
   Business Profile, set the website to https://jensendesigncabinets.com. Then `npm run backup`.

## Looking after it

**His data and the code are kept apart.** The code (this repository) is deployed to Pages; his
photos, galleries, settings and messages live in the R2 bucket, laid out as written at the top of
`functions/_lib/storage.js`. Deploying the code never touches the bucket. Images that belong to
the code (the logos, in `public/img/`) are in git; his photos never are.

- **Deploy a change**: `npm run deploy`. Safe at any time; his galleries are unaffected.
- **Try a change first**: `npm run deploy:preview` publishes it at preview.jensen-design.pages.dev
  with its own bucket (`jensen-design-media-preview`, created once with `npx wrangler r2 bucket
  create`; `python3 tools/upload_r2.py archive/r2 --preview` fills it), so nothing he sees or owns changes.
  Add the preview's admin paths to the Access application to use its admin page.
- **His downloads**: the admin page's "Download all photos" and each gallery's "Download" build a
  zip in his browser (`public/zip.js`): a folder per gallery, numbered photos, full size where the
  bucket has them (`originals/`, private, through `/api/admin/originals/`), and a photos.txt of the
  titles and captions.
- **Back up**: `npm run backup` copies the galleries, settings and every photo into `backups/`
  (only what is new since the last time). Do it after launch, before anything that changes the
  bucket, and every so often.
- **Never re-import over his galleries**: `tools/upload_r2.py` stops if the bucket already has
  them. `--replace-galleries` overrides that; back up first.
- **Locally**: `npm run dev` runs the site at http://localhost:8788 with a local bucket;
  `node tools/load_local.mjs archive/r2` fills it. With `DEV_ADMIN_EMAIL=you@example.com` in
  `.dev.vars`, `/admin` works on localhost without Access (never anywhere else).
