// Where everything lives in the R2 bucket, spelled out here and nowhere else in functions/.
// (public/admin.js and tools/ use the same layout; their copies point back here.)
//
//   photos/<gallery slug>/<id>-w.jpg   his photos, 2000px    \
//   photos/<gallery slug>/<id>-t.jpg   and 800px thumbnails   } public, served at /media/...
//   photos/<gallery slug>/<id>.mp4     videos                 |
//   site/<id>-w.jpg, -t.jpg            page header photos    /
//   data/galleries.json                the galleries and their photos, in order   \  private:
//   data/settings.json                 his choices from the admin page's Settings  } never served,
//   messages/<time>-<id>.json          contact-form messages (deleted after a year) /  never imported over
//
// The bucket is his data, not the code: deploying the site never touches it. Only the admin page
// changes it, plus the one-time import (tools/upload_r2.sh), which will not overwrite data/.

export const GALLERIES = 'data/galleries.json';
export const SETTINGS = 'data/settings.json';
export const MESSAGES = 'messages/';
export const PHOTOS = 'photos/';
export const SITE_IMAGES = 'site/';
export const PUBLIC = [PHOTOS, SITE_IMAGES];

export const galleryPrefix = (g) => `${PHOTOS}${g.slug}/`;
export const photoKey = (g, p) => `${galleryPrefix(g)}${typeof p === 'string' ? p : p.id}`;

/** The address of a stored file on the site: the web size by default, '-t' for the thumbnail. */
export const media = (key, size = '-w', ext = 'jpg') =>
  `/media/${key.split('/').map(encodeURIComponent).join('/')}${size}.${ext}`;
