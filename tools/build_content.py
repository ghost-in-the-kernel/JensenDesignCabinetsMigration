"""Turn the downloaded archive into what the new site serves.

    python3 tools/build_content.py archive

Reads archive/site/manifest.json and archive/photos/ (from extract.py and download.py) and writes:
- content/site.json: the words on the pages (about text, reviews, contact, links). Committed.
- public/img/: the logos. Committed.
- archive/r2/: everything that goes to the R2 bucket, laid out by key: each photo as a web size
  and a thumbnail (public) and full size (private, for him to download from the admin page), each video with a poster, and data/galleries.json. upload_r2.sh sends it.
- archive/for-dad/: every project as a folder of numbered photos under its own name, to hand over.
"""
import json, os, re, shutil, subprocess, sys
from PIL import Image, ImageOps

ARCHIVE = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
R2 = os.path.join(ARCHIVE, 'r2')
WEB, THUMB = 2000, 800  # longest side, in pixels

shutil.rmtree(R2, ignore_errors=True)  # a fresh copy each time: nothing left over from an earlier run gets uploaded
shutil.rmtree(os.path.join(ARCHIVE, 'for-dad'), ignore_errors=True)
m = json.load(open(os.path.join(ARCHIVE, 'site', 'manifest.json')))
index = json.load(open(os.path.join(ARCHIVE, 'photos', 'index.json')))
b = m['bindings']

def sizes(src, key):
    """A web size and a thumbnail of one photo, under one R2 key. Re-encoding drops the camera's
    metadata (GPS included); originals are not published, they go to his own copy only."""
    os.makedirs(os.path.dirname(os.path.join(R2, key)), exist_ok=True)
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert('RGB')
        for suffix, edge in (('-w', WEB), ('-t', THUMB)):
            out = im.copy(); out.thumbnail((edge, edge), Image.LANCZOS)
            out.save(os.path.join(R2, key + suffix + '.jpg'), quality=85, optimize=True, progressive=True)
        return im.size

def poster(video, key):
    frame = os.path.join(R2, key + '-frame.jpg')
    os.makedirs(os.path.dirname(frame), exist_ok=True)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', '1', '-i', video, '-frames:v', '1', frame], check=True)
    size = sizes(frame, key)
    os.remove(frame)
    return size

def alt_text(desc, gallery_name):
    """Houzz's photo description as alt text: without its filler and its wrong place ("in Denver"),
    with the project's own place instead."""
    if not desc: return ''
    d = re.sub(r'^(Inspiration for an?|Example of an?|Photo of an?|This is an example of an?)\s+', '', desc.strip())
    d = re.sub(r'^[A-Z][\w /&-]* - ', '', d)  # "Bedroom - large rustic ..."
    d = re.sub(r'\s+(photo|remodel|design|idea|picture)s?\s+in\s+[A-Z][A-Za-z .]*?(?=\s+with\b|,|$)', '', d)
    d = re.sub(r'\s+in\s+(Denver|Other|New York)\b', '', d)
    place = gallery_name.split(' | ')[1] if ' | ' in gallery_name else 'Telluride, CO'
    return f"{d[:1].upper()}{d[1:]}, by Jensen Design in {place}"[:300]

AUTO = {ph['image']['externalId']: ph.get('autoDescription')
        for proj in m['projects'].values() for ph in proj.get('photos') or [] if (ph.get('image') or {}).get('externalId')}

def safe(name):
    return re.sub(r'[\\/:*?"<>|]+', '-', name).strip(' .')

# Galleries, in the order the Projects page showed them.
order = [p['id'] for p in b.get('projects') or []]
index.sort(key=lambda g: order.index(g['id']) if g['id'] in order else len(order))
galleries = []
for g in index:
    photos, dad = [], os.path.join(ARCHIVE, 'for-dad', safe(g['name'].split(' | ')[0]))
    os.makedirs(dad, exist_ok=True)
    for p in g['photos']:
        src = os.path.join(ARCHIVE, p['file'])
        if not os.path.exists(src): print('missing', src, file=sys.stderr); continue
        pid = p['externalId'] or os.path.splitext(os.path.basename(src))[0].split('-', 1)[1]
        key = f"photos/{g['slug']}/{pid}"  # the layout is in functions/_lib/storage.js
        if src.endswith('.mp4'):
            w, h = poster(src, key)
            shutil.copyfile(src, os.path.join(R2, key + '.mp4'))
            kind = 'video'
        else:
            w, h = sizes(src, key)
            kind = 'image'
            # The full-size photo, private (only the admin can download it): the bucket is his archive.
            orig = os.path.join(R2, f"originals/{g['slug']}/{pid}.jpg")
            os.makedirs(os.path.dirname(orig), exist_ok=True)
            shutil.copyfile(src, orig)
        photo = {'id': pid, 'kind': kind, 'title': p.get('title') or '', 'caption': p.get('comments') or '',
                 'alt': alt_text(AUTO.get(pid), g['name']), 'w': w, 'h': h}
        if kind == 'image': photo['original'] = 'jpg'
        photos.append(photo)
        shutil.copyfile(src, os.path.join(dad, f"{p['order']:02d}{os.path.splitext(src)[1]}"))
    cover = g.get('cover') if any(x['id'] == g.get('cover') for x in photos) else (photos[0]['id'] if photos else None)
    galleries.append({'id': str(g['id']), 'slug': g['slug'], 'name': g['name'],
                      'description': g.get('description') or '', 'cover': cover, 'photos': photos})
    print(f"{g['slug']}: {len(photos)}", file=sys.stderr)

os.makedirs(os.path.join(R2, 'data'), exist_ok=True)
json.dump({'galleries': galleries}, open(os.path.join(R2, 'data', 'galleries.json'), 'w'), indent=1)

# Page header photos and logos.
heroes = {}
for ext_id, img in (m.get('extraImages') or {}).items():
    src = os.path.join(ARCHIVE, 'photos', '_site', ext_id + '.jpg')
    if os.path.exists(src):
        sizes(src, f'site/{ext_id}')
        heroes[img['usedOn']] = f'site/{ext_id}'
os.makedirs(os.path.join(ROOT, 'public', 'img'), exist_ok=True)
for f in os.listdir(os.path.join(ARCHIVE, 'photos', '_site')):
    if f.startswith('JD Logo'):
        dest = 'logo.jpg' if 'White' in f else 'logo-square.png'
        shutil.copyfile(os.path.join(ARCHIVE, 'photos', '_site', f), os.path.join(ROOT, 'public', 'img', dest))

home = m['pages']['/']['tree']
home_html = next((n['props']['contentHtml'] for s in home['children'] for n in s.get('children') or []
                  if n.get('type') == 'Paragraph'), '')
social = (m['site']['sharedBlocks']['footer']['children'][1]['props'])
site = {
    'name': m['site'].get('displayName') or 'Jensen Design',
    'legalName': 'Jensen Design, LLC.',
    'contact': b['contact'],
    'mapAddress': (b.get('map') or {}).get('formattedAddress') or b['contact']['formattedAddress'],
    'social': {k: v for k, v in social.items() if k not in ('direction', 'houzz') and v},
    'home': {'heading': 'OUR VISION FOR YOUR HOME', 'text': re.sub(r'<[^>]+>', '', home_html).strip(), 'slideshow': 5,
             'services': 'We design and build high-end custom cabinetry for the whole house: kitchens, bathroom vanities, '
                         'bars, closets and built-ins, plus trim packages and custom furniture, working with builders, '
                         'architects, designers and homeowners in Telluride, Mountain Village and Montrose, Colorado.'},
    # What search results show: what he does and where, in his own words from the About page.
    'seoTitle': 'Jensen Design | Custom Cabinetry in Telluride & Montrose, CO',
    'seoDescription': 'Jensen Design designs and builds high-end custom cabinetry for the whole house: kitchens, baths, '
                      'closets, trim packages and custom furniture, for homes in Telluride, Mountain Village and Montrose, Colorado.',
    'about': [p.strip() for p in b['about-me'].replace('\r', '').split('\n \n') if p.strip()],
    'reviews': [{'name': r['user']['displayName'], 'date': r['projectDate'], 'rating': r['rating'], 'body': r['body']}
                for r in b['reviews']],
    'heroes': heroes,
}
os.makedirs(os.path.join(ROOT, 'content'), exist_ok=True)
json.dump(site, open(os.path.join(ROOT, 'content', 'site.json'), 'w'), indent=1, ensure_ascii=False)
print(f'{len(galleries)} galleries, {sum(len(g["photos"]) for g in galleries)} photos staged in {R2}', file=sys.stderr)
