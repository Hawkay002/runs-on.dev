import { authorizeSiteAction } from '../../../../lib/site-access.js';
import { createRateLimiter } from '../../../../lib/throttle.js';
import { readZip, MAX_ZIP_BYTES } from '../../../../lib/zip.js';
import { getSite, putSite, applyDeployment, newDeployment } from '../../../../lib/sites.js';
import { storeConfigured, putDeployment, deletePrefixes } from '../../../../lib/store.js';

// A deploy spends real storage and a registry commit, so it gets the same
// order of allowance a record edit does rather than a read's.
const DEPLOY_WINDOW_MS = 10 * 60 * 1000;
const DEPLOY_MAX = 6;
const takeDeploy = createRateLimiter({ windowMs: DEPLOY_WINDOW_MS, max: DEPLOY_MAX });

const TOKEN = () => process.env.REGISTRY_TOKEN;

export const runtime = 'nodejs';

// POST a zip, get a live deployment. Body: multipart/form-data with `site`
// (the zip, required) and `name` (optional while accounts hold one name).
//
// The write order is deliberate: upload the files first, then move the
// pointer. A failure after the upload leaves an orphaned prefix the next
// deploy's prune sweeps; the reverse order would leave a pointer at files
// that do not exist, which serves 404s to visitors and is not sweepable.
export async function POST(request) {
  if (!storeConfigured()) {
    return Response.json({ error: 'storage_not_configured' }, { status: 503 });
  }

  // Refuse on the declared size before anything parses. The envelope adds a
  // little overhead to the zip itself, so the hard check stays on file.size.
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_ZIP_BYTES + 64 * 1024) {
    return Response.json({ error: 'too_big' }, { status: 413 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: 'invalid_request' }, { status: 400 });
  }
  const file = form.get('site');
  if (!(file instanceof File)) {
    return Response.json({ error: 'missing_file' }, { status: 400 });
  }
  if (file.size > MAX_ZIP_BYTES) {
    return Response.json({ error: 'too_big' }, { status: 413 });
  }

  const auth = await authorizeSiteAction(request, {
    explicitName: form.get('name'),
    takeBudget: takeDeploy,
  });
  if (auth.response) return auth.response;

  const zip = readZip(Buffer.from(await file.arrayBuffer()));
  if (!zip.ok) {
    return Response.json({ error: 'invalid_zip', reason: zip.reason }, { status: 400 });
  }
  if (!zip.entries.some((e) => e.name === 'index.html')) {
    return Response.json({ error: 'no_index_html' }, { status: 400 });
  }

  let existing;
  try {
    existing = await getSite(auth.name, { token: TOKEN() });
  } catch {
    return Response.json({ error: 'busy' }, { status: 503, headers: { 'Retry-After': '4' } });
  }

  const deployment = newDeployment({ files: zip.entries.length, bytes: zip.totalBytes });
  const stored = await putDeployment(`sites/${auth.name}/${deployment.id}/`, zip.entries);
  if (!stored.ok) {
    return Response.json({ error: 'storage_error' }, { status: 503 });
  }

  const { record, pruned } = applyDeployment(existing?.data, {
    name: auth.name,
    owner: auth.login,
    deployment,
  });
  const result = await putSite(record, {
    token: TOKEN(),
    sha: existing?.sha,
    editor: auth.login,
  });
  if (!result.ok) {
    if (result.reason === 'stale') {
      // Another deploy of this name landed mid-flight; the editor re-reads
      // and decides, exactly as a stale record edit does.
      return Response.json({ error: 'stale' }, { status: 409 });
    }
    if (result.reason === 'ratelimited') {
      return Response.json({ error: 'busy' }, { status: 503, headers: { 'Retry-After': '4' } });
    }
    return Response.json({ error: 'server_error' }, { status: 500 });
  }

  // Sweep what fell out of history. Best-effort by design: the pointer has
  // moved, and leftover bytes are a storage cost, not a correctness problem.
  if (pruned.length > 0) {
    await deletePrefixes(pruned.map((d) => `sites/${auth.name}/${d.id}/`));
  }

  return Response.json({
    url: `https://${auth.name}.runs-on.dev/`,
    deploymentId: deployment.id,
    files: deployment.files,
    bytes: deployment.bytes,
    commit: result.commit ?? null,
  });
}
