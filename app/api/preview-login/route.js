import { timingSafeEqual } from 'node:crypto';
import { SESSION_TTL_MS, signSession } from '../../../lib/session.js';

// DEMO-ONLY for the Hyperstudio preview deployment: GitHub OAuth can never
// complete on a vercel.app host (the registry's OAuth app only calls back to
// runs-on.dev), so the preview has no way to reach a signed-in /manage. This
// route is the bridge: opening a link with the right one-time key sets the
// same session cookie the real callback would.
//
// Dead by construction anywhere the env var is absent: without
// PREVIEW_LOGIN_KEY it answers 404, exactly like a missing route. The key
// lives only in the preview project's Vercel env; deleting the env var kills
// the link instantly, and the session it mints has no registry write powers
// on this project (no REGISTRY_TOKEN is set there).
const PREVIEW_LOGIN = 'Hawkay002';

function keyMatches(provided) {
  const expected = process.env.PREVIEW_LOGIN_KEY;
  if (!expected || !provided || provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function GET(request) {
  if (!keyMatches(new URL(request.url).searchParams.get('key'))) {
    return new Response('not found', { status: 404 });
  }

  const session = signSession({ login: PREVIEW_LOGIN }, process.env.SESSION_SECRET);
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  const headers = new Headers();
  headers.append('Location', '/manage');
  // The key rode in on the URL; never leak it onward through Referer.
  headers.append('Referrer-Policy', 'no-referrer');
  headers.append(
    'Set-Cookie',
    `session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
  );
  return new Response(null, { status: 302, headers });
}
