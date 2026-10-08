#!/usr/bin/env bash
# Send everything build_content.py staged to the R2 bucket, keyed by its path under the folder.
#   tools/upload_r2.sh archive/r2            (to Cloudflare; run `npx wrangler login` first)
#   tools/upload_r2.sh archive/r2 --local    (to the local bucket `npm run dev` uses)
# Safe to run again: it just puts each file again.
set -euo pipefail
DIR=$(cd "$1" && pwd); WHERE=${2:---remote}; BUCKET=jensen-design-media
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
put() {
  key=$1
  case "$key" in *.mp4) type=video/mp4 ;; *.json) type=application/json ;; *.png) type=image/png ;; *) type=image/jpeg ;; esac
  npx wrangler r2 object put "$BUCKET/$key" --file "$DIR/$key" --content-type "$type" "$WHERE" >/dev/null 2>&1 \
    && echo "ok $key" || echo "FAILED $key"
}
export -f put; export DIR WHERE BUCKET
# data/galleries.json last, so the site never lists a photo that is not there yet.
(cd "$DIR" && find . -type f ! -path './data/*' | sed 's#^\./##') | xargs -P 12 -I{} bash -c 'put "$@"' _ {} | tee /tmp/r2-upload.log | grep -c '^ok' | sed 's/$/ files sent/'
put data/galleries.json
grep '^FAILED' /tmp/r2-upload.log && { echo "Some files failed; run this again."; exit 1; } || echo "All sent."
