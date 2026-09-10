import { siteTokenFromRequest, SITE_TOKEN_SCOPE } from './tokens.js';
import { getOwnerIndex } from './owners.js';
import { validateName } from './name.js';

const TOKEN = () => process.env.REGISTRY_TOKEN;

// The front door every /api/sites/* endpoint shares: verify the bearer token,
// spend the route's own throttle budget, read the owner index, and settle on
// the one name the action targets. Centralized so the three routes cannot
// drift into three different answers to "who is this and whose name is it".
//
// Returns { login, name } to proceed with, or { response } to return as-is.
export async function authorizeSiteAction(request, { explicitName, takeBudget }) {
  const payload = siteTokenFromRequest(request, process.env.SITE_TOKEN_SECRET);
  if (!payload?.login || payload.scope !== SITE_TOKEN_SCOPE) {
    return { response: Response.json({ error: 'invalid_token' }, { status: 401 }) };
  }

  // The budget limiter belongs to the calling route (deploys and reads get
  // different allowances), so it arrives as a function.
  const budget = takeBudget(payload.login.toLowerCase());
  if (!budget.ok) {
    const seconds = Math.ceil(budget.retryAfterMs / 1000);
    return {
      response: Response.json(
        { error: 'rate_limited', retryInMs: budget.retryAfterMs },
        { status: 429, headers: { 'Retry-After': String(seconds) } },
      ),
    };
  }

  // Fail closed, like /api/records: an index that could not be read must not
  // read as "this account owns nothing" (which would be a 403 for a person
  // who owns a name) nor as permission to act.
  let index;
  try {
    index = await getOwnerIndex(payload.login, { token: TOKEN() });
  } catch {
    return { response: Response.json({ error: 'busy' }, { status: 503, headers: { 'Retry-After': '4' } }) };
  }
  if (!index || !Array.isArray(index.names) || index.names.length === 0) {
    return { response: Response.json({ error: 'no_claimed_name' }, { status: 403 }) };
  }

  // v1 accounts hold exactly one name, so it can be implied. The explicit
  // form exists so the day MAX_NAMES_PER_ACCOUNT changes, callers that send a
  // name keep working and the ambiguity is surfaced rather than guessed away.
  let name;
  if (explicitName !== null && explicitName !== undefined && explicitName !== '') {
    name = String(explicitName).trim().toLowerCase();
    if (!validateName(name).ok || !index.names.includes(name)) {
      return { response: Response.json({ error: 'not_your_name' }, { status: 403 }) };
    }
  } else if (index.names.length === 1) {
    name = index.names[0];
  } else {
    return { response: Response.json({ error: 'name_required' }, { status: 400 }) };
  }

  return { login: payload.login, name };
}
