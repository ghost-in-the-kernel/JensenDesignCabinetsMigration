// Fill the local R2 bucket that `npm run dev` uses from a folder staged by build_content.py,
// in one process (much faster than upload_r2.sh --local).   node tools/load_local.mjs archive/r2
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { getPlatformProxy } from 'wrangler';

const dir = process.argv[2];
const types = { mp4: 'video/mp4', json: 'application/json', png: 'image/png' };
async function* files(d) {
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) yield* files(p); else yield p;
  }
}
const { env, dispose } = await getPlatformProxy();
let n = 0, last = null;
for await (const f of files(dir)) {
  const key = relative(dir, f).split('\\').join('/');
  if (key === 'data/galleries.json') { last = f; continue; }
  await env.MEDIA.put(key, await readFile(f), { httpMetadata: { contentType: types[key.split('.').pop()] || 'image/jpeg' } });
  n++;
}
if (last) await env.MEDIA.put('data/galleries.json', await readFile(last), { httpMetadata: { contentType: 'application/json' } });
console.log(`${n + (last ? 1 : 0)} files in the local bucket`);
await dispose();
