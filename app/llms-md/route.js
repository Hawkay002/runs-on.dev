import { buildLlmsTxt } from '../../lib/llms.js';

// The same agent index as /llms.txt, served as text/markdown for requests
// that negotiate for it (Accept: text/markdown). proxy.js rewrites page
// requests that prefer markdown here, and stamps Vary: Accept on every
// HTML response so caches never serve one variant for the other.
export const dynamic = 'force-static';

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
}
