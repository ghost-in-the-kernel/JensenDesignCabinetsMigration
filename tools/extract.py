"""Pull every page of a Houzz Pro site into one manifest: pages, projects, photos, theme, contact."""
import json, re, sys, time, urllib.request, os

BASE = sys.argv[1].rstrip('/') + '/'
OUT = sys.argv[2]
os.makedirs(os.path.join(OUT, 'html'), exist_ok=True)

def get(path):
    url = BASE + path
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (site migration for owner)'})
    with urllib.request.urlopen(req, timeout=30) as r:
        html = r.read().decode('utf-8')
    with open(os.path.join(OUT, 'html', (path or 'home').replace('/', '__') + '.html'), 'w') as f:
        f.write(html)
    time.sleep(0.5)
    return html

def next_data(html):
    return json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S).group(1))

def find_projects(node, acc):
    if isinstance(node, dict):
        p = node.get('project')
        if isinstance(p, dict) and 'photos' in p:
            acc[p['id']] = p
        for v in node.values(): find_projects(v, acc)
    elif isinstance(node, list):
        for v in node: find_projects(v, acc)

manifest = {'base': BASE, 'pages': {}, 'projects': {}}
first = next_data(get(''))
pp = first['props']['pageProps']
sd = json.loads(pp['siteDataJson'])
manifest['theme'] = pp.get('theme')
manifest['head'] = json.loads(pp['headContent']) if isinstance(pp.get('headContent'), str) else pp.get('headContent')
manifest['site'] = {k: sd.get(k) for k in ('displayName', 'siteId', 'bindingData', 'pages', 'sharedBlocks', 'siteOwnerUserName')}

paths = ['', 'projects', 'about', 'contact', 'privacy']
listing = get('projects')
paths += sorted(set(re.findall(r'href="/?(projects/\d+[^"]*)"', listing)))
seen = set()
for path in paths:
    if path in seen: continue
    seen.add(path)
    html = get(path)
    d = next_data(html)
    p = d['props']['pageProps']
    s = json.loads(p['siteDataJson'])
    manifest['pages'][path or '/'] = {'head': json.loads(p['headContent']), 'tree': s['currentPage']}
    acc = {}
    find_projects(s['currentPage'], acc)
    for pid, proj in acc.items():
        old = manifest['projects'].get(pid)
        if not old or len(proj.get('photos') or []) > len(old.get('photos') or []):
            proj = dict(proj, path=path if path.startswith('projects/') else (old or {}).get('path'))
            manifest['projects'][pid] = proj
    print(f'{path or "/"}: {len(acc)} project(s)', file=sys.stderr)

photos = {}
for proj in manifest['projects'].values():
    for ph in (proj.get('photos') or []) + ([proj['coverPhoto']] if proj.get('coverPhoto') else []):
        img = ph.get('image') or {}
        if img.get('externalId'): photos[img['externalId']] = img
manifest['photoCount'] = len(photos)
with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
    json.dump(manifest, f, indent=1)
print(f"{len(manifest['pages'])} pages, {len(manifest['projects'])} projects, {len(photos)} unique photos", file=sys.stderr)
