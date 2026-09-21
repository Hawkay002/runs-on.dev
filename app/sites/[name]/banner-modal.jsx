'use client';

import { useEffect, useState } from 'react';

// The card's single banner option. Where the old "share" row linked out to
// the banner route (light and dark, two weblinks), this opens the banner in
// a modal right here: the image, its link path for embedding, and a download
// button that saves the PNG straight from the response.
//
// The image must come from the apex: this page renders on <name>.runs-on.dev
// hosts, where proxy.js rewrites a relative /banner/<name> into
// /sites/<name>/banner/... and 404s. On localhost the apex is this origin, so
// a dev machine sees its own banner rather than production's.
export default function BannerModal({ name }) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [base, setBase] = useState('https://runs-on.dev');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setBase(window.location.origin);
    }
  }, []);

  // Escape closes, like every other surface on the site.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const url = `${base}/banner/${name}`;

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${name}-banner.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      // A failed download leaves the modal open with the link path visible,
      // which is itself the manual fallback.
    }
    setDownloading(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-(--color-ink) underline"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        banner
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-[6px]"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Banner for ${name}.runs-on.dev`}
        >
          <div
            className="slit-frame max-h-full w-full max-w-3xl overflow-y-auto rounded-lg bg-(--color-paper) p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-(family-name:--font-mono) text-xs text-(--color-muted)">
                {'// banner · '}{name}.runs-on.dev
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="slit-frame rounded-[4px] px-2.5 py-1 font-(family-name:--font-mono) text-xs text-(--color-muted) hover:text-(--color-ink)"
              >
                close
              </button>
            </div>

            {/* The image itself. A plain <img>, not next/image: the source is
                a route on another host in production, and the banner is
                already the exact size it is served at. */}
            <img
              src={url}
              alt={`${name}.runs-on.dev claim banner`}
              className="mt-4 w-full rounded-lg border border-(--color-rule)"
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={download} disabled={downloading} className="btn-pill px-4 py-2 text-xs">
                {downloading ? 'Downloading…' : 'Download banner'}
              </button>
              {/* The link path, kept: READMEs and forum posts embed this URL
                  directly, and it doubles as the manual fallback if the
                  download button ever fails. */}
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate font-(family-name:--font-mono) text-xs text-(--color-muted) underline hover:text-(--color-ink)"
              >
                {url}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
