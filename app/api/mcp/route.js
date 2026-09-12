import { handleRpc } from '../../../lib/mcp.js';
import { getRecord } from '../../../lib/registry.js';

// MCP over Streamable HTTP, mounted at /.well-known/mcp via a rewrite. All
// requests are answered statelessly with a single JSON response (no SSE
// stream, no session). Tools only read public registry data, so there is
// nothing to authenticate and nothing to rate-limit beyond the shared
// CARD_TOKEN quota inside getRecord.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } },
      { status: 400 },
    );
  }

  // Notifications (no id) expect no response body, just acceptance.
  if (!body || typeof body !== 'object' || body.id === undefined || body.id === null) {
    if (body && typeof body === 'object' && typeof body.method === 'string') {
      return new Response(null, { status: 202 });
    }
    return Response.json(
      { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'invalid request' } },
      { status: 400 },
    );
  }

  const out = await handleRpc(body, { getRecord: (name) => getRecord(name, {}) });
  return Response.json(out);
}

// No SSE stream: this server is stateless request/response only.
export async function GET() {
  return Response.json(
    { jsonrpc: '2.0', id: null, error: { code: -32601, message: 'GET is not supported; POST JSON-RPC to this endpoint' } },
    { status: 405 },
  );
}
