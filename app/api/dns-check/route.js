import dns from 'node:dns/promises';
import { validateName } from '../../../lib/name.js';
import { getRecord } from '../../../lib/registry.js';
import { classifyClaim } from '../../../lib/health.js';

// Node runtime for node:dns — edge has no resolver. Dynamic because the
// answer is a live DNS reading; caching it would turn "did it work?" into
// "did it work five minutes ago".
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZONE = 'runs-on.dev';
const PROBE_TIMEOUT_MS = 8000;

// Everything this endpoint returns is already public: DNS answers and the
// page a name serves. It accepts any grammar-valid name for that reason —
// but it still reads the record through the same short revalidate window the
// card uses, so a poll loop costs the registry's GitHub quota almost
// nothing rather than one authenticated read per poll.
async function safe(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function flattenTxt(records) {
  return (records ?? []).map((chunks) => chunks.join(''));
}

async function probe(name) {
  try {
    const res = await fetch(`https://${name}.${ZONE}/`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { 'user-agent': 'runs-on-dev-dns-check (github.com/zordhalo/runs-on.dev)' },
    });
    const body = await res.text();
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(body)?.[1]?.trim() ?? '';
    return { ok: true, finalHost: new URL(res.url).hostname, title, finalUrl: res.url };
  } catch {
    return { ok: false };
  }
}

export async function GET(request) {
  const name = (new URL(request.url).searchParams.get('name') ?? '').trim().toLowerCase();
  if (!validateName(name).ok) {
    return Response.json({ error: 'invalid_name' }, { status: 400 });
  }

  const token = process.env.CARD_TOKEN ?? process.env.REGISTRY_TOKEN;
  const fetchImpl = (url, init) => fetch(url, { ...init, next: { revalidate: 30 } });
  const record = await safe(() => getRecord(name, { token, fetchImpl }), null);
  if (!record) return Response.json({ error: 'not_found' }, { status: 404 });

  const [cname, a, txtName, txtVercelLabel, txtVercelZone, servingProbe] = await Promise.all([
    safe(() => dns.resolveCname(`${name}.${ZONE}`), []),
    safe(() => dns.resolve4(`${name}.${ZONE}`), []),
    safe(() => dns.resolveTxt(`${name}.${ZONE}`), []),
    safe(() => dns.resolveTxt(`_vercel.${name}.${ZONE}`), []),
    // The zone-level host the mirror publishes to: reading it here is what
    // lets the panel say "published at the zone" instead of making the owner
    // trust a green checkmark they cannot see anywhere.
    safe(() => dns.resolveTxt(`_vercel.${ZONE}`), []),
    probe(name),
  ]);

  return Response.json({
    name,
    cname,
    a,
    txt: {
      name: flattenTxt(txtName),
      vercelLabel: flattenTxt(txtVercelLabel),
      zoneVercel: flattenTxt(txtVercelZone),
    },
    serving: {
      status: classifyClaim(record, servingProbe),
      title: servingProbe.ok ? servingProbe.title : null,
      finalUrl: servingProbe.ok ? servingProbe.finalUrl : null,
    },
  });
}
