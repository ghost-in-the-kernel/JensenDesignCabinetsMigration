import { adminEmail } from '../_lib/access.js';

export async function onRequest(context) {
  const email = await adminEmail(context.request, context.env);
  if (!email) return new Response('Please sign in.', { status: 401 });
  context.data.email = email;
  return context.next();
}
