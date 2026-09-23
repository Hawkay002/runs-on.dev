'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// Inline Lucide marks, the same inlined-path pattern the blog toolbar uses
// (the repo has no icon package). All strokes inherit currentColor.
function PanelLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
    </svg>
  );
}
function PanelLeftOpenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </svg>
  );
}
function PanelLeftCloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}
function LogOutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

const NAV_ITEM =
  'flex w-full cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors';

// The manage area's frame: a hamburger in the top-left corner opens a panel
// linking the Profile and API pages, with Log out at the bottom. Profile and
// API are real routes (/manage/profile, /manage/api) rendered by the layout
// around this shell, so each is directly bookmarkable and the panel is plain
// navigation between them.
export default function ManageShell({ login, children }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  // Click outside the panel (or the button) closes it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      const inPanel = panelRef.current?.contains(e.target);
      const inButton = buttonRef.current?.contains(e.target);
      if (!inPanel && !inButton) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Navigating to another manage page leaves the panel closed on the new
  // page, rather than half-open over content the visitor hasn't seen.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/';
  }

  const nav = [
    { href: '/manage', label: 'Manage', Icon: GlobeIcon },
    { href: '/manage/profile', label: 'Profile', Icon: UserIcon },
    { href: '/manage/api', label: 'API', Icon: KeyIcon },
  ];

  return (
    <>
      {/* Panel first in the tree. It starts beneath the sticky navbar (4rem)
          and runs the full remaining viewport: 100dvh is the live viewport
          height, so the browser's own chrome (address bar) shrinking or
          growing is already inside the number, and the panel always reaches
          the bottom edge. It floats over the page without shifting it. */}
      <div
        ref={panelRef}
        aria-hidden={!open}
        className={`fixed left-0 top-16 z-40 flex h-[calc(100dvh-4rem)] w-72 flex-col border-r border-(--color-rule) bg-(--color-paper) transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-(--color-rule) px-5 py-5">
          <p className="font-(family-name:--font-mono) text-xs text-(--color-muted)">manage</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="font-(family-name:--font-mono) text-sm text-(--color-ink)">@{login}</p>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              aria-label="Log out"
              title="Log out"
              className="text-(--color-muted) transition-colors hover:text-(--color-flag) disabled:opacity-40"
            >
              <LogOutIcon />
            </button>
          </div>
        </div>

        <nav className="flex flex-col gap-1 p-3" aria-label="Manage sections">
          {nav.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <a
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`${NAV_ITEM} ${active ? 'bg-(--color-card) text-(--color-ink)' : 'text-(--color-muted) hover:text-(--color-ink)'}`}
              >
                <Icon />
                <span>{label}</span>
              </a>
            );
          })}
        </nav>

      </div>

      {/* The menu button leads the page, above the heading, with no frame:
          the icon alone carries it. Closed shows panel-left and flips to
          panel-left-open on hover purely in CSS; open shows panel-left-close,
          since pressing closes. */}
      <div>
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="group relative z-30 -ml-2 rounded-lg p-2 text-(--color-muted) transition-colors hover:text-(--color-ink)"
        >
          {open ? (
            <span className="block">
              <PanelLeftCloseIcon />
            </span>
          ) : (
            <>
              <span className="block group-hover:hidden">
                <PanelLeftIcon />
              </span>
              <span className="hidden group-hover:block">
                <PanelLeftOpenIcon />
              </span>
            </>
          )}
        </button>

        {children}
      </div>
    </>
  );
}
