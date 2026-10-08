"""The one-time import: send what build_content.py staged to the R2 bucket, keyed by its path.

    python3 tools/upload_r2.py archive/r2              to the live bucket
    python3 tools/upload_r2.py archive/r2 --preview    to the preview bucket (for trying changes)

Needs CLOUDFLARE_API_TOKEN (R2 edit) and CLOUDFLARE_ACCOUNT_ID in the environment. (For the local
bucket of `npm run dev`, use tools/load_local.mjs.) Uploads 8 files at a time through Cloudflare's
API, the photos first and data/galleries.json last, so the site never lists a photo that is not there
yet. A file already in the bucket at the same size is skipped, and when Cloudflare says to slow down
(its API allows about 1,200 calls in 5 minutes) it waits; after a failure, just run it again.

After launch the galleries are his: if the bucket already has data/galleries.json this stops, so
re-running it can never wipe what he added in the admin page. Only with --replace-galleries, and
only after `python3 tools/backup.py`, does it overwrite them.
"""
import argparse, concurrent.futures, json, os, sys, time, urllib.error, urllib.parse, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument('folder')
ap.add_argument('--preview', action='store_true')
ap.add_argument('--replace-galleries', action='store_true')
args = ap.parse_args()

token, account = os.environ.get('CLOUDFLARE_API_TOKEN'), os.environ.get('CLOUDFLARE_ACCOUNT_ID')
if not token or not account: sys.exit('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID first.')
bucket = 'jensen-design-media-preview' if args.preview else 'jensen-design-media'
api = f'https://api.cloudflare.com/client/v4/accounts/{account}/r2/buckets/{bucket}/objects/'
TYPES = {'.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.json': 'application/json'}
GALLERIES = 'data/galleries.json'  # the layout is in functions/_lib/storage.js

def request(method, key, body=None, ctype=None, query=''):
    url = (api + urllib.parse.quote(key) if key else api.rstrip('/')) + query  # the listing has no trailing slash
    headers = {'Authorization': f'Bearer {token}', **({'Content-Type': ctype} if ctype else {})}
    for attempt in range(8):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=body, method=method, headers=headers), timeout=300) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 7: raise
            time.sleep(int(e.headers.get('Retry-After') or 0) or min(60, 5 * 2 ** attempt))  # slow down, as asked

def already_there():
    """Every key in the bucket and its size."""
    sizes, cursor = {}, None
    while True:
        page = json.loads(request('GET', '', query='?per_page=1000' + (f'&cursor={urllib.parse.quote(cursor)}' if cursor else '')))
        sizes.update({o['key']: int(o['size']) for o in page['result']})
        info = page.get('result_info') or {}
        if not info.get('is_truncated'): return sizes
        cursor = info['cursor']

try:
    request('GET', GALLERIES)  # the API has no HEAD; the gallery list is small
    exists = True
except urllib.error.HTTPError as e:
    if e.code != 404: sys.exit(f'Could not check the bucket ({e.code}); is the token right?')
    exists = False
if exists and not args.replace_galleries:
    sys.exit(f'{bucket} already has its galleries ({GALLERIES}): stopping, so nothing he added is lost.\n'
             'To replace them anyway: python3 tools/backup.py first, then add --replace-galleries.')

folder = os.path.abspath(args.folder)
keys = sorted(os.path.relpath(os.path.join(d, f), folder).replace(os.sep, '/')
              for d, _, files in os.walk(folder) for f in files)
there = already_there()
photos = [k for k in keys if k != GALLERIES and there.get(k) != os.path.getsize(os.path.join(folder, k))]
print(f'{len(keys) - 1 - len(photos)} files already in {bucket}; {len(photos)} to send', file=sys.stderr)

def put(key):
    with open(os.path.join(folder, key), 'rb') as f: body = f.read()
    try:
        request('PUT', key, body, TYPES.get(os.path.splitext(key)[1].lower(), 'application/octet-stream'))
    except Exception as e:
        return f'{key}: {e}'

failed, done = [], 0
with concurrent.futures.ThreadPoolExecutor(8) as pool:
    for result in pool.map(put, photos):
        done += 1
        if result: failed.append(result)
        if done % 200 == 0: print(f'{done} of {len(photos)} sent', file=sys.stderr)
if failed:
    print('\n'.join(failed), file=sys.stderr)
    sys.exit(f'{len(failed)} files failed; run this again (the gallery list was not sent yet).')
if GALLERIES in keys:
    error = put(GALLERIES)
    if error: sys.exit(f'The gallery list failed ({error}); run this again.')
print(f'All {len(keys)} files are in {bucket}.')
