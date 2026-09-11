import { cookies } from 'next/headers';
import { readSession } from '../../lib/session.js';
import { getOwnerIndex } from '../../lib/owners.js';
import { getRecord } from '../../lib/registry.js';
import RecordForm from './record-form.jsx';
import TokenZone from './token-zone.jsx';

export const metadata = {
  title: 'Manage your name · runs-on.dev',
  description: 'Point your runs-on.dev name at your own hosting.',
  robots: { index: false },
};

// Always reflects what is actually committed right now: an owner who just
// saved must not be shown a cached copy of the record they replaced.
export const dynamic = 'force-dynamic';

const TOKEN = () => process.env.REGISTRY_TOKEN;

export default async function Manage() {
  const raw = (await cookies()).get('session')?.value;
  const session = raw ? readSession(raw, process.env.SESSION_SECRET) : null;

  if (!session?.login) {
    return (
      <Shell>
        <p className="text-sm leading-relaxed text-(--color-ash)">
          <a className="text-(--color-ink) underline" href="/api/auth/github">
            Sign in with GitHub
          </a>{' '}
          to edit the record for a name you own.
        </p>
      </Shell>
    );
  }

  const index = await getOwnerIndex(session.login, { token: TOKEN() }).catch(() => null);
  const names = index?.names ?? [];

  if (names.length === 0) {
    return (
      <Shell>
        <p className="text-sm leading-relaxed text-(--color-ash)">
          @{session.login} does not own a name yet.{' '}
          <a className="text-(--color-ink) underline" href="/">
            Claim one
          </a>
          .
        </p>
      </Shell>
    );
  }

  const records = await Promise.all(
    names.map((name) => getRecord(name, { token: TOKEN() }).catch(() => null)),
  );
  const unreadable = names.filter((_, i) => !records[i]);

  return (
    <Shell>
      {records.map((record, i) =>
        record ? (
          <RecordForm key={names[i]} name={names[i]} record={record} />
        ) : null,
      )}
      {/* An indexed name whose file cannot be read is skipped rather than
          replacing the whole page with an error: one unreadable record must
          not hide the others, and "reload to try again" was a promise the
          stale-index window after a swap could not keep. */}
      {unreadable.length > 0 && (
        <p className="font-(family-name:--font-mono) text-xs text-(--color-muted)">
          {'// not shown just now: '}
          {unreadable.map((name) => `domains/${name}.json`).join(', ')}
        </p>
      )}
      {/* Account-scoped, so it renders once after the per-name forms rather
          than inside them: the token speaks for @login, not for one name. */}
      <TokenZone login={session.login} />
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <p className="meta">Manage</p>
      <h1 className="mt-3 text-[34px] leading-[1.03] font-normal tracking-[-0.005em] text-(--color-ink) sm:text-[44px] sm:tracking-[-0.007em]">
        Your name
      </h1>
      <p className="mt-4 max-w-[540px] text-[16px] leading-[1.5] text-(--color-muted)">
        Record changes save straight to the registry and DNS follows within seconds. A
        deploy token publishes a static site to your name without a browser.
      </p>
      <div className="mt-12 space-y-12">{children}</div>
    </main>
  );
}
