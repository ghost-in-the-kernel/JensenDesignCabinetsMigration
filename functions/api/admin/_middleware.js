import { adminEmail } from '../../_lib/access.js';

async function signedIn(context) {
  const email = await adminEmail(context.request, context.env);
  if (!email) return Response.json({ error: 'Please sign in.' }, { status: 401 });
  context.data.email = email;
  return context.next();
}

// Every change must come from the admin page itself: a form on another site cannot set this header.
function fromAdminPage(context) {
  if (context.request.method !== 'GET' && context.request.headers.get('x-admin') !== '1') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  return context.next();
}

export const onRequest = [signedIn, fromAdminPage];
