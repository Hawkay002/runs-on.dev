import { cookies } from 'next/headers';
import { readSession } from '../../../lib/session.js';
import TokenZone from '../token-zone.jsx';

// The API half of /manage: deploy tokens, their lifetime, and revocation.
// The session gate lives in the layout above; this page only needs the login
// the token speaks for.
export default async function ApiPage() {
  const raw = (await cookies()).get('session')?.value;
  const session = raw ? readSession(raw, process.env.SESSION_SECRET) : null;

  return (
    <>
      <p className="meta">Manage</p>
      <h1 className="mt-3 text-[34px] leading-[1.03] font-normal tracking-[-0.005em] text-(--color-ink) sm:text-[44px] sm:tracking-[-0.007em]">
        API
      </h1>
      <p className="mt-4 max-w-[540px] text-[16px] leading-[1.5] text-(--color-muted)">
        Keys for publishing a static site to your name from a terminal or a
        coding agent.
      </p>

      <div className="mt-12 space-y-12">
        <TokenZone login={session?.login ?? ''} />
      </div>
    </>
  );
}
