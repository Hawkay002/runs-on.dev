import { appendFile, readFile, readdir } from 'node:fs/promises';
import { classifyClaim } from '../lib/health.js';

const TIMEOUT_MS = 10_000;
const CONCURRENCY = 8;

// A stuck name keeps the registry's own 200 and certificate, so nothing
// errors anywhere: the owner believes it works until someone reads the page.
// The title check is what separates the two worlds — a verified name is
// served BY the provider ON our hostname, so the hostname alone can't tell
// them apart, but the provider's page never carries the card's
// "<name> (name.runs-on.dev)" title.
async function probe(name) {
  try {
    const res = await fetch(`https://${name}.runs-on.dev/`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'runs-on-dev-health-check (github.com/zordhalo/runs-on.dev)' },
    });
    const body = await res.text();
    const title = /<title[^>]*>([^<]*)<\/title>/i.exec(body)?.[1]?.trim() ?? '';
    return { ok: true, finalHost: new URL(res.url).hostname, title };
  } catch {
    return { ok: false };
  }
}

const claims = [];
for (const file of await readdir('domains')) {
  if (!file.endsWith('.json')) continue;
  try {
    claims.push(JSON.parse(await readFile(`domains/${file}`, 'utf8')));
  } catch (err) {
    console.error(`health: skipping unreadable ${file}: ${err.message}`);
  }
}

const queue = claims
  .filter((claim) => claim.records?.CNAME || (claim.records?.A ?? []).length)
  .map((claim) => claim.name);
const probes = new Map();

async function worker() {
  while (queue.length > 0) {
    const name = queue.shift();
    probes.set(name, await probe(name));
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));

const SEVERITY = { stuck: 0, down: 1, ok: 2, redirect: 3, card: 4 };
const rows = claims
  .map((claim) => ({ name: claim.name, status: classifyClaim(claim, probes.get(claim.name)) }))
  .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || a.name.localeCompare(b.name));

const counts = {};
for (const { status } of rows) counts[status] = (counts[status] ?? 0) + 1;

const lines = [
  `# DNS health — ${new Date().toISOString()}`,
  '',
  `${rows.length} claims: ${Object.entries(counts)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ')}`,
  '',
  '| name | status |',
  '| --- | --- |',
  ...rows.map((row) => `| ${row.name} | ${row.status} |`),
  '',
];

const stuck = rows.filter((row) => row.status === 'stuck');
if (stuck.length > 0) {
  lines.push(
    '## Stuck on the profile card despite pointing elsewhere',
    '',
    'These names have provider records, but the wildcard profile card still',
    'answers, which means provider-side ownership verification has not',
    'completed. For Vercel that is the zone-level `_vercel` challenge — see',
    'issue #26 and the zone mirror in `scripts/sync-dns.mjs`.',
    '',
    ...stuck.map((row) => `- ${row.name}`),
    '',
  );
}

const report = lines.join('\n');
process.stdout.write(report);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, report, 'utf8');
}

if (stuck.length > 0) {
  console.error(`health: ${stuck.length} name(s) stuck on the profile card`);
  process.exit(1);
}
console.log('health: every pointed name serves something other than the card');
