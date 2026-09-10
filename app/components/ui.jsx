import { DOTMAP } from './dotmap-data.js';

// The page's structural element: a full-width 1px graphite rule. Sections are
// separated exclusively by these lines, never by background shifts.
export function Divider({ className = '' }) {
  return <hr aria-hidden="true" className={`border-t border-(--color-rule) ${className}`} />;
}

// Dot-matrix world map: white circular dots on the obsidian canvas, continents
// defined by density alone. Atmospheric proof of reach, not photography.
// Generated data (see scripts/generate-dotmap.mjs); decorative by design.
const PITCH = 10;
const DOT_R = 2.2;

export function DotMap({ className = '' }) {
  const { cols, rows } = DOTMAP;
  const w = cols * PITCH;
  const h = rows.length * PITCH;
  const dots = [];
  rows.forEach((line, r) => {
    for (let c = 0; c < cols; c++) {
      if (line[c] === '1') {
        dots.push(<circle key={`${c}-${r}`} cx={c * PITCH + PITCH / 2} cy={r * PITCH + PITCH / 2} r={DOT_R} />);
      }
    }
  });

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      <g fill="#f3f3f3" fillOpacity="0.8">
        {dots}
      </g>
    </svg>
  );
}

// Availability / status pill: badge surface inside a graphite hairline, a
// single pulse-green dot reserved for live/active states.
const TONES = {
  live: '#98ff38',
  ok: '#98ff38',
  pending: '#eab308',
  redirect: '#8ea1ff',
  neutral: '#9c9c9c',
  error: '#d97757',
};

export function StatusBadge({ tone = 'neutral', pulse = false, children }) {
  const color = TONES[tone] ?? TONES.neutral;
  return (
    <span className="inline-flex items-center gap-2 rounded-[4px] border border-(--color-rule) bg-(--color-badge) px-3.5 py-2 font-(family-name:--font-mono) text-[12px] tracking-[0.05em] text-(--color-muted) uppercase">
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? 'pulse-dot' : ''}`}
        style={{ background: color }}
      />
      {children}
    </span>
  );
}
