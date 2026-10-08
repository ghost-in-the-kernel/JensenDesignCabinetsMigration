"""Download every photo (largest size Houzz serves) and every video in a manifest from extract.py.

Resumable: a file already on disk is skipped. Writes photos/index.json: project -> photos, with
the original title, description and the size it came down at, so nothing is lost on the way."""
import json, os, struct, subprocess, sys, time, urllib.parse, urllib.request, urllib.error

MANIFEST, OUT = sys.argv[1], sys.argv[2]
# Houzz size codes, largest first (checked Oct 2026: 14 = 2560px wide, 16 = 1600, 9 = 990; Houzz's public
# servers serve nothing larger, the camera originals are only in his Houzz account).
SIZE_CODES = [14, 16, 9]

def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (site migration for owner)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()

def jpeg_size(b):
    i = 2
    while i < len(b) - 9:
        if b[i] != 0xFF: i += 1; continue
        m = b[i + 1]
        if m in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack('>HH', b[i + 5:i + 9]); return w, h
        i += 2 + struct.unpack('>H', b[i + 2:i + 4])[0]
    return None

def best_image(img):
    best = None
    for code in SIZE_CODES:
        url = f"https://st.hzcdn.com/simgs/{img['externalId']}_{code}-{img.get('contentModified') or '0000'}/home-design.jpg"
        try: b = fetch(url)
        except urllib.error.HTTPError: continue
        return (url, b, jpeg_size(b) or (0, 0))  # the largest that answers
    return best

m = json.load(open(MANIFEST))
os.makedirs(os.path.join(OUT, 'photos'), exist_ok=True)
index, failed = [], []
for proj in m['projects'].values():
    slug = (proj.get('path') or str(proj['id'])).split('/')[-1]
    d = os.path.join(OUT, 'photos', slug); os.makedirs(d, exist_ok=True)
    entry = {'id': proj['id'], 'name': proj['name'], 'description': proj.get('description'), 'slug': slug,
             'cover': ((proj.get('coverPhoto') or {}).get('image') or {}).get('externalId'), 'photos': []}
    for n, ph in enumerate(proj.get('photos') or [], 1):
        img, vid = ph.get('image') or {}, ph.get('video')
        rec = {'order': n, 'title': ph.get('title'), 'comments': ph.get('comments'),
               'autoDescription': ph.get('autoDescription'), 'externalId': img.get('externalId'),
               'originalWidth': img.get('width'), 'originalHeight': img.get('height')}
        if vid:
            f = os.path.join(d, f'{n:03d}-{img.get("externalId") or vid["id"]}.mp4')
            rec['file'] = os.path.relpath(f, OUT)
            if not os.path.exists(f):
                r = subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', vid['servingUrl'], '-c', 'copy', f])
                if r.returncode: failed.append(vid['servingUrl'])
        else:
            f = os.path.join(d, f'{n:03d}-{img["externalId"]}.jpg')
            rec['file'] = os.path.relpath(f, OUT)
            if not os.path.exists(f):
                best = best_image(img)
                if not best: failed.append(img['externalId']); continue
                with open(f, 'wb') as fh: fh.write(best[1])
                rec['downloadedSize'], rec['sourceUrl'] = best[2], best[0]
                time.sleep(0.2)
        entry['photos'].append(rec)
    index.append(entry)
    print(f"{slug}: {len(entry['photos'])}", file=sys.stderr)
# Photos outside any project (page header backgrounds) and the logos.
extra = os.path.join(OUT, 'photos', '_site'); os.makedirs(extra, exist_ok=True)
for ext_id, img in (m.get('extraImages') or {}).items():
    f = os.path.join(extra, f'{ext_id}.jpg')
    if not os.path.exists(f):
        best = best_image(img)
        if not best: failed.append(ext_id); continue
        with open(f, 'wb') as fh: fh.write(best[1])
header = ((m.get('site') or {}).get('sharedBlocks') or {}).get('header') or {}
logos = {header.get('props', {}).get('src'),
         'https://st.hzcdn.com/siteuploads/site_7600032/JD%20Logo%20square%20no%20phone.png_1671579302_12324.png'}
for url in filter(None, logos):
    name = urllib.parse.unquote(url.split('/')[-1].split('?')[0])
    f = os.path.join(extra, name)
    if not os.path.exists(f):
        try:
            with open(f, 'wb') as fh: fh.write(fetch(url.replace(' ', '%20')))
        except Exception: failed.append(url)
json.dump(index, open(os.path.join(OUT, 'photos', 'index.json'), 'w'), indent=1)
print(f'done; {len(failed)} failed: {failed}', file=sys.stderr)
