// Sections are separated by the 1px graphite rule and named by a mono
// uppercase label in Input's voice. No background shifts, no cards unless a
// quote genuinely needs to sit apart (then: carbon surface, hairline edge).
export function Section({ title, children }) {
  return (
    <section className="mt-16 border-t border-(--color-rule) pt-8">
      <h2 className="meta">{title}</h2>
      <div className="mt-6 space-y-4 text-(--color-ink)">{children}</div>
    </section>
  );
}

export function Quote({ children }) {
  return (
    <p className="rounded-lg border border-(--color-rule) bg-(--color-card) p-5 text-sm leading-relaxed text-(--color-ash)">
      {children}
    </p>
  );
}
