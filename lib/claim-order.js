import { readRegistry } from './registry-files.js';

// The claim ordinal: which number a name is in the whole registry's claimed
// history, earliest claim first. Computed off the registry on disk (the same
// read the homepage's claim map uses), ranked by claimedAt -- the field every
// record has carried since the first one -- with the name breaking ties, so
// the numbering is stable and identical for the historic claims and for every
// new one. Callers must ship `domains/**` in outputFileTracingIncludes or the
// read comes up empty in the lambda.
const orderCache = new Map();

function buildOrder() {
  const claims = readRegistry()
    .filter((claim) => claim?.name)
    .sort((a, b) =>
      String(a.claimedAt ?? '').localeCompare(String(b.claimedAt ?? '')) ||
      String(a.name).localeCompare(String(b.name)),
    );
  const order = new Map(claims.map((claim, i) => [claim.name, i + 1]));
  return order;
}

// Memoised per lambda lifetime: the registry on disk is a deploy-time
// snapshot anyway, so re-reading per banner render would only burn disk reads
// on the same answer.
export function claimNumber(name) {
  if (!orderCache.has('order')) {
    try {
      orderCache.set('order', buildOrder());
    } catch {
      orderCache.set('order', new Map());
    }
  }
  return orderCache.get('order').get(name) ?? null;
}
