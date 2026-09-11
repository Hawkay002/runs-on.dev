'use client';

// The wordmark still goes home on a normal click (after a half-second beat,
// so the click count can settle). Three quick taps inside 1.2 seconds
// instead flip the claim map into its alternate artwork. It is an easter
// egg, so it lives on click counting rather than a visible control; pages
// without a claim map get the normal navigation.
const TRIPLE_TAP_MS = 1200;

export default function Wordmark() {
  let taps = [];
  let navTimer = null;

  function onClick(event) {
    event.preventDefault();
    clearTimeout(navTimer);

    const now = Date.now();
    taps = taps.filter((t) => now - t < TRIPLE_TAP_MS);
    taps.push(now);

    if (taps.length >= 3) {
      taps = [];
      if (document.querySelector('[data-claim-map]')) {
        window.dispatchEvent(new CustomEvent('runs-on:flipmap'));
        return;
      }
    }

    navTimer = setTimeout(() => {
      taps = [];
      window.location.href = '/';
    }, 500);
  }

  return (
    <a
      href="/"
      onClick={onClick}
      className="text-[18px] tracking-[-0.01em] text-(--color-ink) no-underline"
    >
      runs-on<span className="text-(--color-muted)">.dev</span>
    </a>
  );
}
