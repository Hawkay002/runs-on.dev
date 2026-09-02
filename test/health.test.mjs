import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyClaim } from '../lib/health.js';

const base = { name: 'lucas', owner: { github: 'zordhalo' }, claimedAt: '2026-08-30T00:00:00Z' };

test('no records: the card is the intended state', () => {
  assert.equal(classifyClaim({ ...base, records: {} }, null), 'card');
});

test('a URL record is an app-served redirect', () => {
  assert.equal(classifyClaim({ ...base, records: { URL: 'https://example.com' } }, null), 'redirect');
});

test('pointed name with a foreign page answering is ok', () => {
  assert.equal(
    classifyClaim(
      { ...base, records: { CNAME: 'cname.vercel-dns.com' } },
      { ok: true, finalHost: 'lucas.runs-on.dev', title: 'Lucas — portfolio' },
    ),
    'ok',
  );
});

test('pointed name that redirected away from the registry host is ok', () => {
  assert.equal(
    classifyClaim(
      { ...base, records: { CNAME: 'cname.vercel-dns.com' } },
      { ok: true, finalHost: 'lucas.vercel.app', title: 'Lucas' },
    ),
    'ok',
  );
});

test('pointed name still answering with the profile card is stuck', () => {
  assert.equal(
    classifyClaim(
      { ...base, records: { CNAME: 'cname.vercel-dns.com' } },
      { ok: true, finalHost: 'lucas.runs-on.dev', title: 'Lucas (lucas.runs-on.dev)' },
    ),
    'stuck',
  );
});

test('pointed name with nothing answering is down', () => {
  assert.equal(
    classifyClaim({ ...base, records: { CNAME: 'cname.vercel-dns.com' } }, { ok: false }),
    'down',
  );
  assert.equal(classifyClaim({ ...base, records: { A: ['1.2.3.4'] } }, undefined), 'down');
});
