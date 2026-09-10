'use client';

import { useState } from 'react';

// The deploy-token card. Account-scoped, unlike the record forms above it,
// which are per-name: one login mints one kind of credential, and the
// deployment it unlocks is always that account's own name.
export default function TokenZone({ login }) {
  const [state, setState] = useState('idle'); // idle | minting | minted | error
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [copied, setCopied] = useState(false);

  async function mint() {
    setState('minting');
    setCopied(false);
    try {
      const res = await fetch('/api/tokens', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.token) {
        setToken(body.token);
        setExpiresAt(body.expiresAt);
        setState('minted');
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <section className="border border-(--color-rule) bg-(--color-card)">
      <div className="border-b border-(--color-rule) px-6 py-5 sm:px-8">
        <p className="font-(family-name:--font-mono) text-xs text-(--color-muted)">@{login}</p>
        <h2 className="mt-1 font-(family-name:--font-display) text-xl font-medium tracking-tight text-(--color-ink) sm:text-2xl">
          Deploy token
        </h2>
      </div>

      <div className="px-6 py-5 sm:px-8">
        <p className="text-sm leading-relaxed text-(--color-muted)">
          Publish a static site to your name from a terminal or a coding agent, no browser
          needed. Generate a token, then:
        </p>
        <pre className="mt-3 overflow-x-auto border border-(--color-rule) px-3 py-2 font-(family-name:--font-mono) text-xs leading-relaxed text-(--color-ink)">
{`curl -X POST https://runs-on.dev/api/sites/deploy \\
  -H "Authorization: Bearer <token>" \\
  -F "site=@dist.zip"`}
        </pre>

        {state !== 'minted' && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={mint}
              disabled={state === 'minting'}
              className="border px-4 py-2 font-(family-name:--font-mono) text-xs transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ borderColor: 'var(--color-signal)', background: 'var(--color-signal)', color: 'var(--color-paper)' }}
            >
              {state === 'minting' ? 'Generating…' : 'Generate token'}
            </button>
            {state === 'error' && (
              <span className="font-(family-name:--font-mono) text-xs text-(--color-signal)">
                could not generate just now, try again
              </span>
            )}
          </div>
        )}

        {state === 'minted' && (
          <div className="mt-4 space-y-3">
            {/* Shown exactly once: the server stores nothing, so there is no
                list to come back to and no way to show it again later. */}
            <div className="border border-(--color-signal) px-3 py-2">
              <p className="font-(family-name:--font-mono) text-xs text-(--color-signal)">
                shown once — copy it now
              </p>
              <div className="mt-2 flex items-start gap-2">
                <code className="min-w-0 flex-1 break-all font-(family-name:--font-mono) text-xs text-(--color-ink)">
                  {token}
                </code>
                <button type="button" onClick={copy} className="shrink-0 border border-(--color-rule) px-2 py-1 font-(family-name:--font-mono) text-xs transition-opacity hover:opacity-80">
                  {copied ? 'copied' : 'copy'}
                </button>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-(--color-muted)">
              Expires {expiresAt ? new Date(expiresAt).toLocaleDateString() : 'in 30 days'}.
              Treat it like a password: it can publish to your name and nothing else.
              Generating another does not revoke this one — old tokens simply expire.
            </p>
            <button type="button" onClick={mint} className="border border-(--color-rule) px-3 py-1.5 font-(family-name:--font-mono) text-xs transition-opacity hover:opacity-80">
              generate another
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
