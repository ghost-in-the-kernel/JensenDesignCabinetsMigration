"""A copy of the live site's galleries, settings and photos on this computer.

    python3 tools/backup.py                         (from https://jensendesigncabinets.com)
    python3 tools/backup.py --site https://jensen-design.pages.dev

Writes backups/<date>/galleries.json and settings.json (read from the bucket with wrangler; run
`npx wrangler login` first) and every photo the galleries list into backups/media/, which is shared
between backups: a photo already there is not fetched again. Photos come through the public site,
the same files visitors see. Contact-form messages are not copied (they are private and expire).
Run it before any change that touches the bucket, and now and then anyway. backups/ is not in git.
"""
import argparse, datetime, json, os, subprocess, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('--site', default='https://jensendesigncabinets.com')
ap.add_argument('--bucket', default='jensen-design-media')
ap.add_argument('--out', default=os.path.join(ROOT, 'backups'))
ap.add_argument('--local', action='store_true', help='read the local bucket of `npm run dev` (for testing this script)')
args = ap.parse_args()

day = os.path.join(args.out, datetime.date.today().isoformat())
media = os.path.join(args.out, 'media')
os.makedirs(day, exist_ok=True)

def get_object(key, dest):
    r = subprocess.run(['npx', 'wrangler', 'r2', 'object', 'get', f'{args.bucket}/{key}', '--local' if args.local else '--remote', '--file', dest],
                       cwd=ROOT, capture_output=True, text=True)
    return r.returncode == 0

if not get_object('data/galleries.json', os.path.join(day, 'galleries.json')):
    sys.exit('Could not read data/galleries.json from the bucket; is `npx wrangler login` done?')
get_object('data/settings.json', os.path.join(day, 'settings.json'))  # absent until he saves Settings

galleries = json.load(open(os.path.join(day, 'galleries.json')))['galleries']
site = json.load(open(os.path.join(ROOT, 'content', 'site.json')))
# The layout is in functions/_lib/storage.js.
keys = [f"photos/{g['slug']}/{p['id']}{end}" for g in galleries for p in g['photos']
        for end in (('-w.jpg', '-t.jpg', '.mp4') if p.get('kind') == 'video' else ('-w.jpg', '-t.jpg'))]
keys += [f'{k}{end}' for k in site.get('heroes', {}).values() for end in ('-w.jpg', '-t.jpg')]

got = had = failed = 0
for key in keys:
    dest = os.path.join(media, key)
    if os.path.exists(dest): had += 1; continue
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        with urllib.request.urlopen(f"{args.site}/media/{urllib.request.quote(key)}", timeout=60) as r, open(dest + '.part', 'wb') as f:
            f.write(r.read())
        os.replace(dest + '.part', dest); got += 1
    except Exception as e:
        failed += 1; print(f'failed {key}: {e}', file=sys.stderr)
print(f'{len(galleries)} galleries saved in {day}; photos: {got} new, {had} already backed up, {failed} failed')
sys.exit(1 if failed else 0)
