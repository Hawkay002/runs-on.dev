'use client';

import { useEffect, useState } from 'react';
import { badgeSnippets } from '../../lib/badge.js';

// The banner block, one per owned name. The banner image has existed for a
// while; what was missing was any way to embed it without hand-writing the
// anchor, which is what this is. Snippet strings come from lib/badge.js so
// they are tested rather than trusted. Dark only, matching the banner route,
// which no longer serves a light theme.
const MINI =
  'slit-frame rounded-[4px] px-2.5 py-1.5 font-(family-name:--font-mono) text-xs text-(--color-muted) hover:text-(--color-ink)';

function Snippet({ label, note, value }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silence here would read as a click that missed; the snippet is
      // selectable below either way.
      setFailed(true);
      setTimeout(() => setFailed(false), 2400);
    }
  }

  return (
    <div className="mt-5 first:mt-0">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-(family-name:--font-mono) text-xs text-(--color-ink)">{label}</p>
        <button type="button" onClick={copy} className={`shrink-0 ${MINI}`}>
          {failed ? 'copy failed' : copied ? 'copied' : 'copy'}
        </button>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-(--color-muted)">{note}</p>
      {/* The card never scrolls: long snippets break into wrapped rows
          inside it, and the copy button copies the snippet as one line. */}
      <div className="slit-frame mt-2 rounded-[4px] px-3 py-1.5">
        <code className="block whitespace-pre-wrap [overflow-wrap:anywhere] font-(family-name:--font-mono) text-xs leading-5 text-(--color-muted)">
          {value}
        </code>
      </div>
    </div>
  );
}

export default function BadgeZone({ name }) {
  // The preview must show the banner this deployment actually serves: on a
  // local run that is this origin, not the production apex.
  const [previewSrc, setPreviewSrc] = useState(`https://runs-on.dev/banner/${name}`);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setPreviewSrc(`${window.location.origin}/banner/${name}`);
    }
  }, [name]);

  const snippets = badgeSnippets(name);

  return (
    <section className="slit-frame mt-16 rounded-lg">
      <div className="slit-bottom px-6 py-5 sm:px-8">
        <p className="meta">Banner</p>
        <p className="mt-2 text-sm leading-relaxed text-(--color-muted)">
          A banner for {name}.runs-on.dev you can put on a page you own. It links back to your
          name and updates itself when you change your record.
        </p>
      </div>

      <div className="px-6 py-5 sm:px-8">
        {/* Plain <img>: the banner is a generated PNG on the apex, and the
            point of this block is to show exactly what the snippets embed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewSrc}
          alt={`Preview of the ${name}.runs-on.dev banner`}
          width={snippets.width}
          className="mt-3 h-auto w-full max-w-[420px] rounded-[4px]"
        />

        <Snippet
          label="On your own site"
          note="An ordinary link. This is the one that counts for anyone measuring your site's outbound links, and for people who click it."
          value={snippets.html}
        />
        <Snippet
          label="In a GitHub README"
          note="GitHub marks links in READMEs rel=nofollow and serves the image through its own proxy, so this one is for visibility rather than link credit."
          value={snippets.markdown}
        />
      </div>
    </section>
  );
}
