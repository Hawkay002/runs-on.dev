// Transparent top bar over the obsidian canvas: wordmark left, a few section
// links at 14px uppercase smoke, and the single filled pill action at right.
// 1px graphite bottom border; no sticky, no fill, no shadow.
const LINKS = [
  { href: '/docs', label: 'Docs' },
  { href: '/stats', label: 'Stats' },
  { href: '/faq', label: 'FAQ' },
  { href: '/about', label: 'About' },
];

export default function Nav() {
  return (
    <header className="border-b border-(--color-rule)">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6 px-6">
        <a
          href="/"
          className="text-[18px] tracking-[-0.01em] text-(--color-ink) no-underline"
        >
          runs-on<span className="text-(--color-muted)">.dev</span>
        </a>

        <nav aria-label="Site" className="hidden items-center gap-6 sm:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-(--color-muted) no-underline uppercase transition-colors hover:text-(--color-ink)"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a href="/#claim" className="btn-pill px-5 py-2 text-[12px]">
          Claim yours
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>
  );
}
