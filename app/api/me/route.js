import { sessionFromRequest } from '../../../lib/session.js';

// Who is signed in, for cosmetic client-side gating: the card page shows its
// manage shortcut only to the owner, and the check must not cost a redirect
// or an error path. Deliberately returns 200 with a null login rather than a
// 401 -- the caller is a page deciding whether to render a link, not a route
// guarding itself, and the /manage route enforces the session for real.
export function GET(request) {
  const session = sessionFromRequest(request, process.env.SESSION_SECRET);
  return Response.json(
    { login: session?.login ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
