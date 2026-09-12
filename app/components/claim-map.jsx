'use client';

import { useEffect, useState } from 'react';
import { DotMap, ContinentChart } from './ui.jsx';

// Split-flap grid: 28 x 8 tiles over the map's exact box. The artwork is
// wider than the map, so it is cover-fitted: scaled until it fills the box
// in BOTH dimensions (the height is the binding one), the overflow cropping
// off the sides, centred. Each tile is two halves hinged at the centre (top
// half rotates from its bottom edge, bottom half from its top edge),
// flipping in with a column-then-row stagger like an airport board.
const TILES_X = 28;
const TILES_Y = 8;
const SWEEP_IN_MS = 2400;
const SWEEP_OUT_MS = 2000;
const ART_HOLD_MS = 5000;

// Cover-fit geometry, in percentages of a tile half. Unzoomed, the art is
// 28 x 16 half-dimensions (2800% x 1600%). The zoom that makes the art's
// height cover the map box is the aspect ratio quotient; the extra width is
// cropped symmetrically, which shifts every tile's slice left by half the
// excess, in tile units.
const ART_ASPECT = 2048 / 593;
const MAP_ASPECT = 1120 / 500;
const COVER_ZOOM = ART_ASPECT / MAP_ASPECT;
const IMG_W_PCT = 100 * TILES_X * COVER_ZOOM;
const LEFT_BASE = (TILES_X / 2) * (1 - COVER_ZOOM); // in tile widths, ~ -7.57

const TILES = [];
for (let j = 0; j < TILES_Y; j++) {
  for (let i = 0; i < TILES_X; i++) {
    TILES.push({ i, j, delay: i * 45 + j * 25 });
  }
}

// The claim map as one interactive unit: the dot-matrix world carries the
// heat, and the continent cards beneath it filter it. Three quick taps on
// the wordmark flip the whole map into the alternate artwork through the
// split-flap sweep, hold it for five seconds, then peel back to the map;
// three more taps bring it back sooner. The continent selection lives here
// too, so the map and the cards can never disagree.
export default function ClaimMap({ points, total, heading = false }) {
  const [selected, setSelected] = useState(null);
  // map -> to-art -> art -> to-map -> map
  const [phase, setPhase] = useState('map');

  // Every phase advances on its own timer, here in one place with cleanup.
  // The wordmark event only ever KICKS the machine (map -> to-art, or an
  // early art -> to-map); because the timers own all further steps, no path
  // can strand a phase the way the first auto-revert draft did, where the
  // final return to map was only scheduled on the manual path.
  useEffect(() => {
    if (phase === 'to-art') {
      const t = setTimeout(() => setPhase('art'), SWEEP_IN_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'art') {
      const t = setTimeout(() => setPhase('to-map'), ART_HOLD_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'to-map') {
      const t = setTimeout(() => setPhase('map'), SWEEP_OUT_MS);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    const flip = () => {
      setPhase((p) => {
        if (p === 'map') return 'to-art';
        if (p === 'art') return 'to-map';
        return p; // a sweep already in flight swallows further taps
      });
    };
    window.addEventListener('runs-on:flipmap', flip);
    return () => window.removeEventListener('runs-on:flipmap', flip);
  }, []);

  // Only the settled artwork hides the map. During both sweeps the dots stay
  // visible behind the tiles, so the way back reads as the map being
  // revealed, not an empty canvas.
  const showingArt = phase === 'art';

  return (
    <div data-claim-map>
      <div className="relative">
        <div
          className="transition-opacity duration-700"
          style={{ opacity: showingArt ? 0 : 1 }}
        >
          <DotMap points={points} filter={selected} className="h-auto w-full" />
        </div>

        {phase !== 'map' && (
          <div aria-hidden="true" data-flap-phase={phase} className="pointer-events-none absolute inset-0 z-10">
            <div
              className={`flap-grid h-full w-full ${phase === 'to-art' ? 'flap-in' : phase === 'to-map' ? 'flap-out' : 'flap-rest'}`}
              style={{
                gridTemplateColumns: `repeat(${TILES_X}, 1fr)`,
                gridTemplateRows: `repeat(${TILES_Y}, 1fr)`,
              }}
            >
              {TILES.map(({ i, j, delay }) => (
                <div key={`${i}-${j}`} className="flap-tile" style={{ '--d': `${delay}ms` }}>
                  <div className="flap-half flap-top">
                    <img
                      src="/ascii-art.png"
                      alt=""
                      style={{
                        width: `${IMG_W_PCT}%`,
                        height: `${TILES_Y * 2 * 100}%`,
                        left: `${(LEFT_BASE - i) * 100}%`,
                        top: `${-j * 200}%`,
                      }}
                    />
                  </div>
                  <div className="flap-half flap-bottom">
                    <img
                      src="/ascii-art.png"
                      alt=""
                      style={{
                        width: `${IMG_W_PCT}%`,
                        height: `${TILES_Y * 2 * 100}%`,
                        left: `${(LEFT_BASE - i) * 100}%`,
                        top: `${-j * 200 - 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={heading ? 'mx-auto max-w-[900px] px-6 pt-10 pb-4' : 'mt-6'}>
        <ContinentChart
          heading={heading}
          points={points}
          total={total}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </div>
  );
}
