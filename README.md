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
   `archive/for-dad/` is then every project as a folder of numbered photos under its own name, for
   him to keep (a USB stick, or a Google Drive link). `archive/` never goes into git.
2. **Cloudflare** (`npm install`, then `npx wrangler login` once):
   ```
   npx wrangler r2 bucket create jensen-design-media
   npx wrangler r2 bucket lifecycle add jensen-design-media delete-old-messages messages/ --expire-days 365
   tools/upload_r2.sh archive/r2
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
   them. Then the Pages project's Custom domains gets `jensendesigncabinets.com`,
   `www.jensendesigncabinets.com`, `telluridecabinets.com` and `www.telluridecabinets.com`.
   Allow up to 48 hours for the change to settle before cancelling Houzz.
5. **Messages to his phone**: the contact form tells him by email (on by default) and, if he turns it
   on in the admin page's Settings, on his phone, as Houzz did. Phone needs one of these set up.
   Free push notification: he installs the ntfy app and subscribes to a long random topic name;
   `npx wrangler pages secret put NTFY_URL` with `https://ntfy.sh/<that name>`. Or real text messages
   through Twilio (a few dollars a month, after the carriers approve the business registration): the
   `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` and `NOTIFY_PHONE` secrets. Either way the
   message is also in the admin page under Messages.
6. **After launch**: in Google Search Console, verify jensendesigncabinets.com (a DNS record,
   one click on Cloudflare) and submit `https://jensendesigncabinets.com/sitemap.xml`. In his Google
   Business Profile, set the website to https://jensendesigncabinets.com. Optionally turn on Email
   Routing and the `send_email` lines in `wrangler.toml` so contact-form messages also arrive by
   email (until then they are in the admin page under Messages).

## Working on it

`npm run dev` runs the site at http://localhost:8788 with a local R2; `node tools/load_local.mjs
archive/r2` fills it. With `DEV_ADMIN_EMAIL=you@example.com` in `.dev.vars`, `/admin` works on
localhost without Access (never anywhere else).
