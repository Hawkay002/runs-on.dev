// The machine-readable agent surfaces must agree with each other: the RFC
// 9728 scopes, the OpenAPI security schemes, and the version policy are
// three views of one truth. If they drift, an agent requesting
// least-privilege access gets lied to.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const spec = JSON.parse(await readFile(new URL('../public/openapi.json', import.meta.url), 'utf8'));
const rfc9728 = JSON.parse(
  await readFile(new URL('../public/.well-known/oauth-protected-resource', import.meta.url), 'utf8'),
);

test('RFC 9728 metadata has the required fields', () => {
  assert.equal(rfc9728.resource, 'https://runs-on.dev');
  assert.ok(Array.isArray(rfc9728.scopes_supported) && rfc9728.scopes_supported.length >= 5);
  assert.ok(rfc9728.resource_documentation.includes('openapi.json'));
  assert.deepEqual(rfc9728.bearer_methods_supported, ['header']);
});

test('scopes_supported covers every scope named in the OpenAPI schemes', () => {
  const openapiScopes = new Set();
  for (const scheme of Object.values(spec.components.securitySchemes)) {
    for (const scope of Object.keys(scheme.scopes ?? {})) openapiScopes.add(scope);
  }
  for (const scope of openapiScopes) {
    assert.ok(
      rfc9728.scopes_supported.includes(scope),
      `scope ${scope} is in OpenAPI but missing from RFC 9728 scopes_supported`,
    );
  }
});

test('the API version policy is published and signaled', () => {
  assert.equal(spec.info['x-api-version'], '1');
  assert.ok(spec.info.description.includes('X-API-Version: 1'));
  assert.ok(spec.info.description.includes('Deprecation'));
  assert.ok(spec.info.description.includes('Sunset'));
  assert.ok(spec.info.description.includes('/api/v2/'));
});
