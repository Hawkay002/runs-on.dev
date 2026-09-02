import { readFile, readdir } from 'node:fs/promises';
import {
  planDnsChanges,
  planZoneVerificationRecords,
  reconcileZoneVerification,
  listPath,
  createPath,
  removePath,
  ZONE_VERIFICATION_LABEL,
} from '../lib/dns.js';

const DOMAIN = 'runs-on.dev';
const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID;
const changed = (process.env.CHANGED_FILES ?? '').split('\n').filter(Boolean);

const REQUIRED = { VERCEL_TOKEN: TOKEN, VERCEL_TEAM_ID: TEAM };
const missing = Object.entries(REQUIRED)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  console.error(`sync-dns: missing required environment variable(s): ${missing.join(', ')}`);
  process.exit(1);
}

const vercel = (path, init = {}) =>
  fetch(`https://api.vercel.com${path}${path.includes('?') ? '&' : '?'}teamId=${TEAM}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  });

async function existingFor(name) {
  // Page through every record. A single limit=100 call silently misses a name's records
  // once the zone grows past one page: the delete loop then removes nothing while the
  // create loop still runs, leaving duplicate and orphaned records instead of a clean
  // replace, with no error to explain the wrong DNS.
  const found = [];
  let cursor = '';

  for (;;) {
    const res = await vercel(listPath(DOMAIN, cursor));
    if (!res.ok) {
      console.error(`sync-dns: failed to list records for ${DOMAIN}: ${res.status} ${res.statusText}`);
      process.exit(1);
    }

    const body = await res.json();
    // `name` here can never be '*' or '' — it comes from the ^domains/([a-z0-9-]+)\.json$
    // match below, so the wildcard record can never be selected for deletion. Preserve
    // that invariant if this ever stops deriving the name from the filename.
    //
    // Also match single-level nested records (`<label>.<name>`, e.g.
    // `_atproto.lucas`), so a subdomain that gets removed or renamed is
    // cleaned up along with the root name instead of orphaned in DNS. The
    // leading dot in the suffix means this can only match a genuine child of
    // `name`, never an unrelated record that happens to end with the same
    // characters.
    found.push(...body.records.filter((r) => r.name === name || r.name.endsWith(`.${name}`)));

    const next = body.pagination?.next;
    if (!next) return found;
    cursor = next;
  }
}

async function deleteStale(name) {
  for (const stale of await existingFor(name)) {
    const res = await vercel(removePath(DOMAIN, stale.id), { method: 'DELETE' });
    // A rejected delete must stop the sync here: continuing on to create the new
    // records would leave the stale ones live alongside them, with a green
    // workflow log claiming everything is in sync.
    if (!res.ok) {
      console.error(`sync-dns: failed to delete ${stale.type} ${stale.name}: ${res.status} ${res.statusText}`);
      process.exit(1);
    }
    console.log(`deleted ${stale.type} ${stale.name}`);
  }
}

for (const file of changed) {
  const match = /^domains\/([a-z0-9-]+)\.json$/.exec(file);
  if (!match) continue;

  const name = match[1];

  let record;
  try {
    record = JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // The record file is gone (owner released the name, or a maintainer removed
    // it). Without this, readFile throws and the workflow crashes here, leaving
    // the ex-owner's DNS live indefinitely.
    await deleteStale(name);
    console.log(`${name}: record removed, DNS cleared`);
    continue;
  }

  const desired = planDnsChanges(record);

  await deleteStale(name);

  for (const change of desired) {
    const body = { type: change.type, name: change.name, value: change.value, ttl: 3600 };
    // Vercel's records API takes MX priority as a separate field, not folded
    // into `value`.
    if (change.type === 'MX') body.mxPriority = change.priority;
    const res = await vercel(createPath(DOMAIN), {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`failed to create ${change.type} ${change.name}: ${res.status}`);
      process.exit(1);
    }
    console.log(`created ${change.type} ${change.name} -> ${change.value}`);
  }

  if (desired.length === 0) console.log(`${name}: no records, wildcard serves the profile card`);
}

// Zone-level verification mirror (see lib/dns.js for why planDnsChanges can
// never publish this host). The desired set is the union across ALL claims,
// not CHANGED_FILES: any other name's sync must preserve every claim's
// mirrored TXT, so reconciling against only the changed files would delete
// the rest as "unclaimed".
const claims = [];
for (const file of await readdir('domains')) {
  if (!file.endsWith('.json')) continue;
  try {
    claims.push(JSON.parse(await readFile(`domains/${file}`, 'utf8')));
  } catch (err) {
    // validate blocks unparsable claims from reaching main; crashing here
    // instead would leave the names above already applied and the run half
    // finished with no record of what was skipped.
    console.error(`zone mirror: skipping unreadable ${file}: ${err.message}`);
  }
}

// `_vercel.<name>` children belong to their claim's own sync pass above; the
// mirror only owns the zone-level host itself.
const existingVerification = (await existingFor(ZONE_VERIFICATION_LABEL)).filter(
  (record) => record.name === ZONE_VERIFICATION_LABEL,
);
const { create: toMirror, remove: toUnmirror } = reconcileZoneVerification(
  planZoneVerificationRecords(claims),
  existingVerification,
);

for (const stale of toUnmirror) {
  const res = await vercel(removePath(DOMAIN, stale.id), { method: 'DELETE' });
  if (!res.ok) {
    console.error(`sync-dns: failed to delete ${stale.type} ${stale.name}: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  console.log(`deleted ${stale.type} ${stale.name}`);
}

for (const change of toMirror) {
  const res = await vercel(createPath(DOMAIN), {
    method: 'POST',
    body: JSON.stringify({ type: change.type, name: change.name, value: change.value, ttl: 3600 }),
  });
  if (!res.ok) {
    console.error(`failed to create ${change.type} ${change.name}: ${res.status}`);
    process.exit(1);
  }
  console.log(`created ${change.type} ${change.name} -> ${change.value}`);
}

if (toMirror.length === 0 && toUnmirror.length === 0) {
  console.log('zone verification: in sync');
}
