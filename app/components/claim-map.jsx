'use client';

import { useEffect, useState } from 'react';
import { DotMap, ContinentChart } from './ui.jsx';

// Split-flap grid: 28 x 8 tiles over the artwork band. Each tile is two
// halves hinged at the centre (top half rotates from its bottom edge, bottom
// half from its top edge), flipping in with a column-then-row stagger so the
// image sweeps in like an airport departure board.
const TILES_X = 28;
const TILES_Y = 8;
const SWEEP_IN_MS = 2400;
const SWEEP_OUT_MS = 2000;

const TILES = [];
for (let j = 0; j < TILES_Y; j++) {
  for (let i = 0; i < TILES_X; i++) {
    TILES.push({ i, j, delay: i * 45 + j * 25 });
  }
}

// The claim map as one interactive unit: the dot-matrix world carries the
// heat, and the continent cards beneath it filter it. Three quick taps on
// the wordmark flip the whole map into the alternate artwork through the
// split-flap sweep (and back again); the selection state for the continent
// spotlight lives here too, so the map and the cards can never disagree.
export default function ClaimMap({ points, total, heading = false }) {
  const [selected, setSelected] = useState(null);
  // map -> to-art -> art -> to-map -> map
  const [phase, setPhase] = useState('map');

  useEffect(() => {
    const flip = () => {
      setPhase((p) => {
        if (p === 'map') {
          setTimeout(() => setPhase('art'), SWEEP_IN_MS);
          return 'to-art';
        }
        if (p === 'art') {
          setTimeout(() => setPhase('map'), SWEEP_OUT_MS);
          return 'to-map';
        }
        return p; // a sweep already in flight swallows further taps
      });
    };
    window.addEventListener('runs-on:flipmap', flip);
    return () => window.removeEventListener('runs-on:flipmap', flip);
  }, []);

  const showingArt = phase === 'art' || phase === 'to-map';

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
          <div aria-hidden="true" data-flap-phase={phase} className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div
              className={`flap-grid ${phase === 'to-art' ? 'flap-in' : phase === 'to-map' ? 'flap-out' : 'flap-rest'}`}
              style={{
                gridTemplateColumns: `repeat(${TILES_X}, 1fr)`,
                gridTemplateRows: `repeat(${TILES_Y}, 1fr)`,
                aspectRatio: '2048 / 592',
                width: '100%',
              }}
            >
              {TILES.map(({ i, j, delay }) => (
                <div key={`${i}-${j}`} className="flap-tile" style={{ '--d': `${delay}ms` }}>
                  <div className="flap-half flap-top">
                    <img
                      src="/ascii-art.png"
                      alt=""
                      style={{ left: `${-i * 100}%`, top: `${-j * 200}%` }}
                    />
                  </div>
                  <div className="flap-half flap-bottom">
                    <img
                      src="/ascii-art.png"
                      alt=""
                      style={{ left: `${-i * 100}%`, top: `${-j * 200 - 100}%` }}
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
