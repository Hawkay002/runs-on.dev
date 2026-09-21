import { cookies } from 'next/headers';
import { readSession } from '../../lib/session.js';
import { getOwnerIndex } from '../../lib/owners.js';
import ManageShell from './manage-shell.jsx';

// Everything under /manage is session-gated here, once, and the panel shell
// wraps whatever page the route resolved to. Pages inside fetch their own
// record data; the layout only decides who is allowed in and for whom the
// panel speaks.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Manage · runs-on.dev',
  description: 'Point your runs-on.dev name at your own hosting.',
  robots: { index: false },
};

const TOKEN = () => process.env.REGISTRY_TOKEN;

export default async function ManageLayout({ children }) {
  const raw = (await cookies()).get('session')?.value;
  const session = raw ? readSession(raw, process.env.SESSION_SECRET) : null;

  if (!session?.login) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="meta">Manage</p>
        <h1 className="mt-3 text-[34px] leading-[1.03] font-normal tracking-[-0.005em] text-(--color-ink) sm:text-[44px] sm:tracking-[-0.007em]">
          Your name
        </h1>
        <p className="mt-4 max-w-[540px] text-[16px] leading-[1.5] text-(--color-muted)">
          <a className="text-(--color-ink) underline" href="/api/auth/github">
            Sign in with GitHub
          </a>{' '}
          to edit the record for a name you own.
        </p>
      </main>
    );
  }

  const index = await getOwnerIndex(session.login, { token: TOKEN() }).catch(() => null);
  const ownsName = (index?.names?.length ?? 0) > 0;

  if (!ownsName) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
        <p className="meta">Manage</p>
        <h1 className="mt-3 text-[34px] leading-[1.03] font-normal tracking-[-0.005em] text-(--color-ink) sm:text-[44px] sm:tracking-[-0.007em]">
          Your name
        </h1>
        <p className="mt-4 max-w-[540px] text-[16px] leading-[1.5] text-(--color-muted)">
          @{session.login} does not own a name yet.{' '}
          <a className="text-(--color-ink) underline" href="/">
            Claim one
          </a>
          .
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
      <ManageShell login={session.login}>{children}</ManageShell>
    </main>
  );
}
