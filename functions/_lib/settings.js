// His choices from the admin page's Settings, kept in R2 next to the galleries.
const KEY = 'data/settings.json';

// Email on, phone off, until he changes them in Settings.
export const DEFAULTS = { notifyEmail: true, notifyPhone: false, phoneNumber: '' };

export async function loadSettings(env) {
  const obj = await env.MEDIA.get(KEY);
  return { ...DEFAULTS, ...(obj ? await obj.json() : {}) };
}

export async function saveSettings(env, settings) {
  await env.MEDIA.put(KEY, JSON.stringify(settings), { httpMetadata: { contentType: 'application/json' } });
}

/** Which ways of telling him are set up on Cloudflare (secrets and bindings), whatever he chose. */
export function channels(env) {
  return {
    email: Boolean(env.MAILER && env.MAIL_FROM),
    push: Boolean(env.NTFY_URL),
    text: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM),
  };
}
