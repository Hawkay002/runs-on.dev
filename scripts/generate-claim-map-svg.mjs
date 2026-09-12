// Generates public/claim-map.svg: the dot-matrix world map with the claim
// heat baked in. Serving it as an <img> keeps ~1600 SVG elements out of the
// homepage's HTML (agents and the content ratio both care), while /stats
// keeps the interactive DOM version. Regenerate after regenerating
// claim-geo: node scripts/generate-claim-map-svg.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { DOTMAP } from '../app/components/dotmap-data.js';
import { CLAIM_GEO } from '../app/components/claim-geo.js';

const PITCH = 10;
const DOT_R = 2.2;
const HEAT_R_BASE = DOT_R + 1;
const COLS = DOTMAP.cols;
const NROWS = DOTMAP.rows.length;

// Same projection the map component uses.
const counts = new Map();
for (const [lat, lon] of Object.values(CLAIM_GEO)) {
  const c = Math.min(COLS - 1, Math.max(0, Math.floor(((lon + 180) / 360) * COLS)));
  const r = Math.min(NROWS - 1, Math.max(0, Math.floor(((84 - lat) / 140) * NROWS)));
  const key = `${c}:${r}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

const w = COLS * PITCH;
const h = NROWS * PITCH;

let base = '';
DOTMAP.rows.forEach((line, r) => {
  for (let c = 0; c < COLS; c++) {
    if (line[c] === '1') {
      base += `<circle cx="${c * PITCH + PITCH / 2}" cy="${r * PITCH + PITCH / 2}" r="${DOT_R}"/>`;
    }
  }
});

let heat = '';
for (const [key, count] of counts) {
  const [c, r] = key.split(':').map(Number);
  const intensity = Math.min(count, 6);
  const x = c * PITCH + PITCH / 2;
  const y = r * PITCH + PITCH / 2;
  // Two-layer bloom: a wide faint glow that reads at a glance, then a
  // bright core the eye locks onto. Single small circles disappeared
  // against the base dots.
  heat += `<circle cx="${x}" cy="${y}" r="${7 + intensity * 1.3}" fill-opacity="${(0.10 + intensity * 0.025).toFixed(2)}"/>`;
  heat += `<circle cx="${x}" cy="${y}" r="${2.8 + intensity * 0.9}" fill-opacity="${Math.min(0.55 + intensity * 0.07, 0.98).toFixed(2)}"/>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Dot-matrix world map; brighter dots mark where runs-on.dev names are claimed">
<g fill="#f3f3f3" fill-opacity="0.45">${base}</g>
<g fill="#4d7cff">${heat}</g>
</svg>
`;

writeFileSync('public/claim-map.svg', svg);
const dots = counts.size;
console.log(`wrote public/claim-map.svg (${(svg.length / 1024).toFixed(1)} KB, ${dots} heat cells)`);
