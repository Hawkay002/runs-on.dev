import { sessionFromRequest } from '../../../lib/session.js';
import { validateName } from '../../../lib/name.js';
import { isReserved } from '../../../lib/blocklist.js';
import { getRecord, getContentsMeta, putRecord, putRecordUpdate } from '../../../lib/registry.js';
import { createRateLimiter } from '../../../lib/throttle.js';

// Swaps the user's claimed name for a new one. Copies all records (CNAME,
// subdomains, profile) to the new name, then deletes the old one. Vercel-
// specific records (_vercel TXT) are stripped since the verification token
// is domain-specific and won't work on the new name — the client triggers
// the Vercel setup flow for the new domain immediately after the swap.

const SWAP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SWAP_MAX = 2;
const takeSwap = createRateLimiter({ windowMs: SWAP_WINDOW_MS, max: SWAP_MAX });

export async function POST(request) {
  const session = sessionFromRequest(request, process.env.SESSION_SECRET);
  if (!session?.login) {
    return Response.json({ error: 'signin_required' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const from = typeof body.from === 'string' ? body.from.trim().toLowerCase() : '';
  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
  const confirm = typeof body.confirm === 'string' ? body.confirm.trim().toLowerCase() : '';

  if (!validateName(from).ok || !validateName(to).ok) {
    return Response.json({ error: 'invalid_name' }, { status: 400 });
  }
  if (from === to) {
    return Response.json({ error: 'same_name', detail: 'pick a different name to swap to' }, { status: 400 });
  }
  if (confirm !== to) {
    return Response.json({ error: 'confirm_mismatch', detail: 'type the new name exactly to confirm' }, { status: 400 });
  }

  const budget = takeSwap(session.login.toLowerCase());
  if (!budget.ok) {
    const seconds = Math.ceil(budget.retryAfterMs / 1000);
    return Response.json(
      { error: 'rate_limited', retryInMs: budget.retryAfterMs },
      { status: 429, headers: { 'Retry-After': String(seconds) } },
    );
  }

  const uncachedFetch = (url, init) => fetch(url, init, { cache: 'no-store' });
  const token = process.env.REGISTRY_TOKEN;

  // Read the current record to verify ownership
  const meta = await getContentsMeta(`domains/${from}.json`, {
    token,
    fetchImpl: uncachedFetch,
  }).catch(() => null);

  if (!meta) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  if (meta.data.owner?.github?.toLowerCase() !== session.login.toLowerCase()) {
    return Response.json({ error: 'not_owner' }, { status: 403 });
  }

  // Check the new name is available
  const existing = await getRecord(to, { token, fetchImpl: uncachedFetch }).catch(() => null);
  if (existing) {
    return Response.json({ error: 'taken', detail: `${to}.runs-on.dev is already claimed` }, { status: 409 });
  }

  // Check the new name isn't reserved
  const reserved = isReserved(to);
  if (reserved.reserved) {
    return Response.json({ error: 'reserved', detail: `${to} is reserved (${reserved.list})` }, { status: 403 });
  }

  // Build the new record: copy everything except name-specific fields
  const newRecord = {
    name: to,
    owner: meta.data.owner,
    claimedAt: new Date().toISOString(),
    records: { ...(meta.data.records ?? {}) },
  };

  // Copy subdomains but strip the _vercel TXT — the verification token is
  // bound to the old domain and won't work on the new one. The Vercel setup
  // flow (triggered by the client after swap) adds a fresh one.
  if (meta.data.subdomains) {
    const subs = { ...meta.data.subdomains };
    delete subs._vercel;
    if (Object.keys(subs).length > 0) {
      newRecord.subdomains = subs;
    }
  }

  // Copy profile
  if (meta.data.profile) {
    newRecord.profile = meta.data.profile;
  }

  // Step 1: Create the new record (putRecord refuses to overwrite, so this
  // fails safely if someone claimed the name between our check and now)
  const createResult = await putRecord(newRecord, { token, fetchImpl: uncachedFetch });
  if (!createResult.ok) {
    return Response.json({
      error: createResult.reason === 'exists' ? 'taken' : 'create_failed',
      detail: createResult.reason === 'exists' ? `${to} was just claimed by someone else` : 'could not create the new record',
    }, { status: createResult.reason === 'exists' ? 409 : 500 });
  }

  // Step 2: Delete the old record (using the SHA from our read, so if
  // something changed it fails safely and the new record still exists)
  const deleteRes = await fetch(
    `https://api.github.com/repos/${process.env.REGISTRY_REPO ?? 'zordhalo/runs-on.dev'}/contents/domains/${from}.json`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `swap: ${from} → ${to} by @${session.login}`,
        sha: meta.sha,
      }),
    },
  ).catch(() => null);

  if (!deleteRes || !deleteRes.ok) {
    // The new record was created but the old one couldn't be deleted.
    // The user now owns both names temporarily — not ideal but recoverable.
    // They can release the old one manually from /manage.
    return Response.json({
      ok: true,
      name: to,
      oldName: from,
      warning: 'new name created but old name could not be deleted, release it manually from /manage',
    });
  }

  return Response.json({
    ok: true,
    name: to,
    oldName: from,
    message: `swapped ${from}.runs-on.dev → ${to}.runs-on.dev`,
  });
}
