# Site migration: jensendesigncabinets.com off Houzz

Deadline: before Oct 15. Today: Oct 8.

## What the current site is (found Oct 8)

- A Houzz Pro "next-pro-site" (Next.js, served by Houzz's nginx). The account is in good standing
  (`isProInArrear: false`, `disabledSince: null`), so the site stays up while we copy it.
- 5 pages: Home, Projects, About, Contact, Privacy Policy. Plus 31 project galleries.
- 677 gallery items: 673 photos and 4 videos. Every photo's original width and height (mostly
  3872×2592, from the camera) and its title and Houzz description are in the page data.
- Photos come from `st.hzcdn.com/simgs/<id>_<size>-<rev>/home-design.jpg`. 637 are flagged hi-res.
- Videos are HLS streams on `vst.hzcdn.com` (ffmpeg copies them to .mp4).
- The look is in the page data: colors (#e1c57c gold titles), fonts (Playfair Display for titles,
  Unna for captions, Open Sans for body, Lato for the logo), sizes and letter spacing. Logos are in
  `st.hzcdn.com/siteuploads/site_7600032/`.
- Contact: jdesign@rmi.net, (970) 249-9877, 1835 Launa Dr, Montrose, CO 81401. The contact form
  posts to Houzz, so it needs a replacement.
- Email is on rmi.net, not on his domain. Moving the domain's DNS shouldn't affect his mail, but we
  copy any MX/TXT records anyway.
- telluridecabinets.com answers with a 301 to `http://www.jensendesigncabinets.com/`.

## Steps

1. **Photos first** (the leverage). `extract.py` (done: manifest of every page, project and photo)
   then `download.py` (largest size Houzz serves, resumable, writes `photos/index.json` with every
   title and description). Then zip it and put a copy somewhere he controls, like Google Drive or a
   USB stick, before anything else happens.
2. **Rebuild the look**: a static site with the same pages, same fonts, colors and gallery layout
   (slideshow per project, grid on /projects). Old URLs (`/projects/2021331-painted-shaker-...`)
   stay the same, so Google links and anything he has shared keep working.
3. **Backend: the simplest one that works.**
   - Hosting: Cloudflare Pages (free).
   - Photos: Cloudflare R2 (free up to 10 GB; the whole archive should fit).
   - Gallery list: one JSON file in R2, or D1 if it grows.
   - Login and logout: **Cloudflare Access** in front of `/admin`, which emails him a one-time code.
     We write no password code, it costs nothing up to 50 users, and you can be added as an admin.
   - `/admin` page: add gallery, remove gallery, add photos (drag and drop, several at once), remove
     a photo, reorder. A few Pages Functions, about 150 lines.
   - Contact form: a Pages Function that emails jdesign@rmi.net.
4. **Staging**: deploy to `<name>.pages.dev` or a subdomain of ours. He reviews it there.
5. **Domains**: find the registrar for both (WHOIS: he'll have a login somewhere, maybe at Houzz,
   GoDaddy or Network Solutions). Add both domains to Cloudflare, copy the existing DNS records,
   change the nameservers at the registrar, then attach both to the Pages project. www goes to apex
   (or the other way round), and telluridecabinets.com 301s to jensendesigncabinets.com. Do it
   before the 15th: DNS changes can take up to 48 hours to settle.
6. He cancels Houzz **after** the new site is live on both domains and he has his photo archive.

## Questions for him

- Who registered the domains, and does he have that login? If Houzz registered them, the transfer
  is the long pole: start it now.
- Does Houzz bill on the 15th? If so, cancelling the same day the DNS moves is fine.
- Does he want the Houzz reviews and the Houzz badge kept, linked or dropped?
