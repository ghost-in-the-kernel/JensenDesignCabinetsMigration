#!/usr/bin/env bash
# The one-time import: send what build_content.py staged to the R2 bucket, keyed by its path.
#   tools/upload_r2.sh archive/r2                 to the live bucket (run `npx wrangler login` first)
#   tools/upload_r2.sh archive/r2 --preview       to the preview bucket (for trying changes)
#   tools/upload_r2.sh archive/r2 --local         to the local bucket `npm run dev` uses
# After launch the galleries are his: if the bucket already has data/galleries.json this stops, so
# re-running it can never wipe what he added in the admin page. Only with --replace-galleries, and
# only after `python3 tools/backup.py`, does it overwrite them.
set -euo pipefail
DIR=$(cd "$1" && pwd); shift
WHERE=--remote; BUCKET=jensen-design-media; REPLACE=no
for a in "$@"; do case "$a" in
  --local) WHERE=--local ;;
  --preview) BUCKET=jensen-design-media-preview ;;
  --replace-galleries) REPLACE=yes ;;
  *) echo "unknown option $a"; exit 2 ;;
esac; done
cd "$(dirname "$0")/.."
if npx wrangler r2 object get "$BUCKET/data/galleries.json" --pipe "$WHERE" >/dev/null 2>&1 && [ "$REPLACE" != yes ]; then
  echo "$BUCKET already has its galleries (data/galleries.json): stopping, so nothing he added is lost."
  echo "To replace them anyway: python3 tools/backup.py first, then add --replace-galleries."
  exit 1
fi
put() {
  key=$1
  case "$key" in *.mp4) type=video/mp4 ;; *.json) type=application/json ;; *.png) type=image/png ;; *) type=image/jpeg ;; esac
  npx wrangler r2 object put "$BUCKET/$key" --file "$DIR/$key" --content-type "$type" "$WHERE" >/dev/null 2>&1 \
    && echo "ok $key" || echo "FAILED $key"
}
export -f put; export DIR WHERE BUCKET
LOG=$(mktemp)
# Photos first, data/galleries.json last, so the site never lists a photo that is not there yet.
(cd "$DIR" && find . -type f ! -path './data/*' | sed 's#^\./##') | xargs -P 12 -I{} bash -c 'put "$@"' _ {} | tee "$LOG" | grep -c '^ok' | sed 's/$/ files sent/'
if grep -q '^FAILED' "$LOG"; then grep '^FAILED' "$LOG"; echo "Some files failed; run this again (the galleries were not written yet)."; exit 1; fi
put data/galleries.json | tee -a "$LOG"
grep -q '^FAILED' "$LOG" && { echo "The gallery list failed; run this again."; exit 1; } || echo "All sent."
