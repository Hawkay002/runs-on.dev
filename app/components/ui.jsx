import { DOTMAP } from './dotmap-data.js';

// The page's structural element: a horizontal slit of light, fading smoothly
// into the canvas at both ends. Sections are separated exclusively by these
// lines, never by background shifts.
export function Divider({ className = '' }) {
  return <hr aria-hidden="true" className={`slit-h ${className}`} />;
}

// Dot-matrix world map: white circular dots on the obsidian canvas, continents
// defined by density alone. Atmospheric proof of reach, not photography.
// Generated data (see scripts/generate-dotmap.mjs); decorative by design.
const PITCH = 10;
const DOT_R = 2.2;

// Continent bucketing for the claim map: rough lat/lon boxes, checked in an
// order that settles the overlaps (Europe before Asia and Africa, Oceania
// before Asia, North before South America). Crude on purpose; the caption on
// the stats page says the whole thing is approximate.
const CONTINENT_BOXES = [
  ['Europe', -25, 36, 60, 72],
  ['Africa', -20, -37, 52, 37],
  ['Oceania', 110, -50, 180, 0],
  ['North America', -170, 12, -52, 72],
  ['South America', -82, -56, -34, 13],
  ['Asia', 25, 0, 180, 80],
];

export function continentOf([lat, lon]) {
  for (const [name, lonMin, latMin, lonMax, latMax] of CONTINENT_BOXES) {
    if (lon >= lonMin && lon <= lonMax && lat >= latMin && lat <= latMax) return name;
  }
  return null;
}

export function DotMap({ points, className = '' }) {
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

  // Heat mode: claim locations ([lat, lon]) bucketed into the same grid as
  // the map. A cell with claims renders one dot whose size and brightness
  // scale with how many landed there, city lights on the dot-matrix world.
  // The same projection the generator used: lon -180..180 across COLS, lat
  // 84..-56 down ROWS.
  let heat = null;
  if (points?.length) {
    const counts = new Map();
    for (const [lat, lon] of points) {
      const c = Math.min(cols - 1, Math.max(0, Math.floor(((lon + 180) / 360) * cols)));
      const r = Math.min(rows.length - 1, Math.max(0, Math.floor(((84 - lat) / 140) * rows.length)));
      const key = `${c}:${r}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    heat = [...counts.entries()].map(([key, count]) => {
      const [c, r] = key.split(':').map(Number);
      const intensity = Math.min(count, 6);
      return (
        <circle
          key={`h-${key}`}
          cx={c * PITCH + PITCH / 2}
          cy={r * PITCH + PITCH / 2}
          r={DOT_R + 1 + intensity * 0.8}
          fillOpacity={Math.min(0.35 + intensity * 0.11, 0.95)}
        />
      );
    });
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      <g fill="#f3f3f3" fillOpacity={points?.length ? 0.3 : 0.8}>
        {dots}
      </g>
      {heat && <g fill="var(--blue)">{heat}</g>}
    </svg>
  );
}

// Continent-wise claim counts beneath the map: a grid of cells, one per
// continent (and one honest 404 for everyone the geocoder could not place).
// Each cell carries the count set large at weight 400, a mono caption, and a
// thin blue bar scaled against the largest continent. The 404 cell is muted
// and carries no bar: it is a different kind of number, not a continent.
export function ContinentChart({ points, total, heading = false, className = '' }) {
  const rows = Object.values(points)
    .reduce((acc, point) => {
      const name = continentOf(point);
      if (!name) return acc;
      const hit = acc.find((c) => c.name === name);
      if (hit) hit.count += 1;
      else acc.push({ name, count: 1 });
      return acc;
    }, [])
    .sort((a, b) => b.count - a.count);
  const unresolved = Math.max(total - points.length, 0);
  const max = rows[0]?.count ?? 1;

  return (
    <div className={className}>
      {heading && (
        <div className="text-center">
          <h2 className="text-[23px] leading-[1.07] font-normal tracking-[-0.004em] text-(--color-ink)">
            Where the names are
          </h2>
          <p className="meta mt-2 normal-case">
            {points.length} of {total} owners resolved from public GitHub profiles · counts approximate
          </p>
        </div>
      )}
      <div className={heading ? 'mt-8 grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-10' : 'grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-10'}>
        {rows.map((c) => (
          <div key={c.name} className="slit-frame rounded-lg p-5">
            <div className="text-[34px] leading-[1.03] font-normal tracking-[-0.005em] text-(--color-ink)">
              {c.count}
            </div>
            <div className="meta mt-2">{c.name}</div>
            <div
              aria-hidden="true"
              className="mt-4 h-0.5 rounded-full"
              style={{
                width: `${Math.max((c.count / max) * 100, 3)}%`,
                backgroundImage: 'linear-gradient(90deg, var(--blue), transparent)',
              }}
            />
          </div>
        ))}
        {unresolved > 0 && (
          <div className="slit-frame rounded-lg p-5 opacity-70">
            <div className="text-[34px] leading-[1.03] font-normal tracking-[-0.005em] text-(--color-muted)">
              {unresolved}
            </div>
            <div className="meta mt-2">404 not found</div>
          </div>
        )}
      </div>
    </div>
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
    <span className="slit-frame inline-flex items-center gap-2 rounded-[4px] bg-(--color-badge) px-3.5 py-2 font-(family-name:--font-mono) text-[12px] tracking-[0.05em] text-(--color-muted) uppercase">
      <span
        aria-hidden="true"
        className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? 'pulse-dot' : ''}`}
        style={{ background: color }}
      />
      {children}
    </span>
  );
}
