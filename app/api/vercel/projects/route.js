import { sessionFromRequest } from '../../../../lib/session.js';
import { createRateLimiter } from '../../../../lib/throttle.js';

// Lists the user's Vercel projects so the manage page can show a dropdown
// instead of making them type the project name. Uses the session's Vercel
// token (OAuth in production, env token in the POC).

const PROJECTS_WINDOW_MS = 60 * 1000;
const PROJECTS_MAX = 5;
const takeProjects = createRateLimiter({ windowMs: PROJECTS_WINDOW_MS, max: PROJECTS_MAX });

export async function GET(request) {
  const session = sessionFromRequest(request, process.env.SESSION_SECRET);
  if (!session?.login) {
    return Response.json({ error: 'signin_required' }, { status: 401 });
  }

  const budget = takeProjects(session.login.toLowerCase());
  if (!budget.ok) {
    const seconds = Math.ceil(budget.retryAfterMs / 1000);
    return Response.json(
      { error: 'rate_limited', retryInMs: budget.retryAfterMs },
      { status: 429, headers: { 'Retry-After': String(seconds) } },
    );
  }

  const vercelToken = session.vercelToken ?? process.env.VERCEL_TOKEN;
  if (!vercelToken) {
    return Response.json({ error: 'vercel_not_connected' }, { status: 400 });
  }

  const res = await fetch('https://api.vercel.com/v9/projects?limit=100', {
    headers: { Authorization: `Bearer ${vercelToken}` },
  }).catch(() => null);

  if (!res) {
    return Response.json({ error: 'vercel_unreachable' }, { status: 502 });
  }

  if (res.status === 401 || res.status === 403) {
    return Response.json({ error: 'vercel_token_invalid' }, { status: 401 });
  }

  const body = await res.json().catch(() => ({}));
  const projects = (body.projects ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    url: p.url ?? null,
  }));

  return Response.json({ projects });
}
