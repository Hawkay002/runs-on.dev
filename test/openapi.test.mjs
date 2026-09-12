// The published OpenAPI spec is a public contract: if it drifts from valid
// OpenAPI 3.1 shape (or an operation loses its id/description), agents and
// generator tools break silently. These tests walk the structural contract.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const spec = JSON.parse(await readFile(new URL('../public/openapi.json', import.meta.url), 'utf8'));

test('is a valid OpenAPI 3.1 document with identity metadata', () => {
  assert.equal(spec.openapi, '3.1.0');
  assert.ok(spec.info.title.length > 3);
  assert.ok(spec.info.description.length > 50);
  assert.ok(Array.isArray(spec.servers) && spec.servers[0].url === 'https://runs-on.dev');
});

test('every operation has a unique operationId, tags, and responses', () => {
  const ids = new Set();
  for (const [path, methods] of Object.entries(spec.paths)) {
    assert.ok(path.startsWith('/'), `${path} must be a path`);
    for (const [method, op] of Object.entries(methods)) {
      assert.ok(op, `${method} ${path} missing`);
      assert.equal(typeof op.operationId, 'string', `${method} ${path} needs an operationId`);
      assert.ok(!ids.has(op.operationId), `duplicate operationId: ${op.operationId}`);
      ids.add(op.operationId);
      assert.ok(op.summary, `${op.operationId} needs a summary`);
      assert.ok(op.description, `${op.operationId} needs a description`);
      assert.ok(op.responses && Object.keys(op.responses).length > 0, `${op.operationId} needs responses`);
    }
  }
  assert.ok(ids.size >= 11, `expected the full surface, got ${ids.size} operations`);
});

test('declares scoped security schemes (essential for agents)', () => {
  const schemes = spec.components.securitySchemes;
  assert.ok(schemes.githubSession, 'session scheme missing');
  assert.ok(schemes.siteToken, 'deploy token scheme missing');
  assert.ok(schemes.githubSession.description.includes('names:claim'));
  assert.ok(schemes.siteToken.description.includes('sites:publish'));
  assert.match(schemes.githubSession.scopes['records:write'], /record/i);
});

test('write paths declare their security requirements explicitly', () => {
  assert.deepEqual(spec.paths['/api/claim'].post.security, [{ githubSession: ['names:claim'] }]);
  assert.deepEqual(spec.paths['/api/records'].post.security, [{ githubSession: ['records:write'] }]);
  assert.deepEqual(spec.paths['/api/sites/deploy'].post.security, [{ siteToken: ['sites:publish'] }]);
  assert.deepEqual(spec.paths['/api/check'].get.security, []);
});

test('every error response documents the shared Error schema', () => {
  for (const methods of Object.values(spec.paths)) {
    for (const op of Object.values(methods)) {
      for (const [status, response] of Object.entries(op.responses)) {
        if (op.operationId === 'mcpJsonRpc') continue; // JSON-RPC envelope, not the registry Error schema
        if (Number(status) < 400) continue;
        const schema = response.content?.['application/json']?.schema;
        const isErrorShape = schema?.allOf?.some((s) => s.$ref === '#/components/schemas/Error')
          || schema?.$ref === '#/components/schemas/Error';
        assert.ok(isErrorShape, `${op.operationId} ${status} should reference the Error schema`);
      }
    }
  }
});
