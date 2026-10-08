# Jensen Design site

jensendesigncabinets.com (and telluridecabinets.com), moved off Houzz to Cloudflare Pages, with a
small admin page to add and remove galleries and photos.

- `tools/extract.py <site-url> archive/site`: every page, project and photo of the Houzz site into
  `archive/site/manifest.json`.
- `tools/download.py archive/site/manifest.json archive`: every photo at the largest size Houzz
  serves, and every video, into `archive/photos/<project>/`, with `index.json` keeping titles and
  descriptions. Resumable.
- `docs/MIGRATION-PLAN.md`: the plan, step by step, and the open questions.
