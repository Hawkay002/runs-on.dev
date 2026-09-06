import { headers } from 'next/headers';

// The 404 that converts misspelling traffic into claims. When someone visits
// an unclaimed name on the wildcard, instead of a bare "not found" they see
// the name is available, a claim button, and suggestions if they misspelled
// an existing name.

export const dynamic = 'force-dynamic';

// Simple Levenshtein distance, enough for short subdomain names.
function editDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return matrix[a.length][b.length];
}

async function findSimilarNames(name) {
  try {
    const res = await fetch(
      'https://api.github.com/repos/zordhalo/runs-on.dev/contents/domains',
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${process.env.CARD_TOKEN ?? process.env.REGISTRY_TOKEN ?? ''}`.trim() || undefined,
        },
        next: { revalidate: 300 },
      },
    );
    if (!res.ok) return [];
    const entries = await res.json();
    const claimed = entries
      .filter((e) => e.type === 'file' && e.name.endsWith('.json'))
      .map((e) => e.name.replace('.json', ''));

    return claimed
      .filter((c) => editDistance(name, c) <= 2 && c !== name)
      .map((c) => ({ name: c, distance: editDistance(name, c) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((s) => s.name);
  } catch {
    return [];
  }
}

export default async function NameNotFound() {
  const host = (await headers()).get('host') ?? '';
  const name = host.split(':')[0].replace(/\.runs-on\.dev$/, '');

  // If we can't extract a valid name, fall back to a generic message
  if (!name || name === 'runs-on.dev' || name === 'www.runs-on.dev') {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="font-(family-name:--font-display) text-3xl font-medium tracking-tight text-(--color-ink)">
          Not found
        </h1>
        <p className="mt-3 text-sm text-(--color-muted)">
          This page doesn't exist. <a className="text-(--color-signal) underline" href="https://runs-on.dev">Go home →</a>
        </p>
      </main>
    );
  }

  const suggestions = await findSimilarNames(name);

  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-6 py-24 text-center">
      {/* Available indicator */}
      <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 font-(family-name:--font-mono) text-xs text-green-600">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
        available
      </span>

      {/* The name, big and inviting */}
      <h1 className="mt-6 font-(family-name:--font-display) text-3xl font-medium tracking-tight text-(--color-ink) sm:text-4xl">
        {name}.runs-on.dev
      </h1>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-(--color-muted)">
        This name isn't claimed yet. It could be yours in seconds — free, forever.
      </p>

      {/* Claim button */}
      <a
        href={`https://runs-on.dev/?claim=${encodeURIComponent(name)}`}
        className="mt-6 inline-block border px-6 py-3 font-(family-name:--font-mono) text-sm transition-opacity hover:opacity-90"
        style={{
          borderColor: 'var(--color-signal)',
          background: 'var(--color-signal)',
          color: 'var(--color-paper)',
        }}
      >
        Claim {name} →
      </a>

      {/* Typo suggestions */}
      {suggestions.length > 0 && (
        <div className="mt-10 border-t border-(--color-rule) pt-6">
          <p className="font-(family-name:--font-mono) text-xs text-(--color-muted)">
            did you mean…
          </p>
          <ul className="mt-3 space-y-2">
            {suggestions.map((s) => (
              <li key={s}>
                <a
                  href={`https://${s}.runs-on.dev`}
                  className="font-(family-name:--font-mono) text-sm text-(--color-signal) underline"
                >
                  {s}.runs-on.dev
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer link */}
      <p className="mt-10 font-(family-name:--font-mono) text-xs text-(--color-muted)">
        <a className="text-(--color-signal) underline" href="https://runs-on.dev">
          runs-on.dev
        </a>{' '}
        — every name here is a file in a{' '}
        <a
          className="text-(--color-signal) underline"
          href="https://github.com/zordhalo/runs-on.dev"
          target="_blank"
          rel="noopener noreferrer"
        >
          public repo
        </a>
      </p>
    </main>
  );
}
