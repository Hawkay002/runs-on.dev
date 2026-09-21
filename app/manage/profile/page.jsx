import { cookies } from 'next/headers';
import { readSession } from '../../../lib/session.js';
import { getOwnerIndex } from '../../../lib/owners.js';
import { getRecord } from '../../../lib/registry.js';
import ProfileForm from '../profile-form.jsx';
import BadgeZone from '../badge-zone.jsx';
import { SwapZone, ReleaseZone } from '../record-form.jsx';

const TOKEN = () => process.env.REGISTRY_TOKEN;

// The profile card's own page: display name, bio, and links — nothing that
// touches DNS. The name's badge preview, swap, and release live here too,
// each in its own section, since they all describe the card rather than the
// DNS. The record forms on /manage handle where the name points.
export default async function ProfilePage() {
  const raw = (await cookies()).get('session')?.value;
  const session = raw ? readSession(raw, process.env.SESSION_SECRET) : null;
  const login = session?.login ?? '';

  const index = await getOwnerIndex(login, { token: TOKEN() }).catch(() => null);
  const names = index?.names ?? [];
  const records = await Promise.all(
    names.map((name) => getRecord(name, { token: TOKEN() }).catch(() => null)),
  );
  const unreadable = names.filter((_, i) => !records[i]);

  return (
    <>
      <p className="meta">Manage</p>
      <h1 className="mt-3 text-[34px] leading-[1.03] font-normal tracking-[-0.005em] text-(--color-ink) sm:text-[44px] sm:tracking-[-0.007em]">
        Profile
      </h1>
      <p className="mt-4 max-w-[540px] text-[16px] leading-[1.5] text-(--color-muted)">
        The card your name serves: display name, bio, links, badge, swap, and
        release. Saving here never changes where the name points — that lives
        on the Manage page.
      </p>

      <div className="mt-12 space-y-12">
        {records.map((record, i) =>
          record ? (
            <div key={names[i]}>
              <ProfileForm name={names[i]} record={record} />
              <BadgeZone name={names[i]} />
              <SwapZone name={names[i]} />
              <ReleaseZone name={names[i]} />
            </div>
          ) : null,
        )}
        {unreadable.length > 0 && (
          <p className="font-(family-name:--font-mono) text-xs text-(--color-muted)">
            {'// not shown just now: '}
            {unreadable.map((name) => `domains/${name}.json`).join(', ')}
          </p>
        )}
      </div>
    </>
  );
}
