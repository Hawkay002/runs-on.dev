'use client';

import { useEffect, useState } from 'react';

// The card's manage shortcut, shown only to the owner: anyone else visiting
// someone's card never sees the button at all. The /manage route enforces
// the session for real; this is the friendly link deciding whether it exists
// on the page, checked client-side against /api/me so the card itself stays
// cacheable (a server-side cookie read would turn every card render dynamic).
export default function ManageLink({ owner }) {
  const [mine, setMine] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (alive && body?.login && body.login === owner) setMine(true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [owner]);

  if (!mine) return null;

  return (
    <a
      href="/manage"
      className="slit-frame [--slit-over:8px] rounded-full px-3 py-1 font-(family-name:--font-mono) text-xs text-(--color-muted) transition-colors hover:text-(--color-ink)"
    >
      manage
    </a>
  );
}
