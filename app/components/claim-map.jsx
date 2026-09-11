'use client';

import { useState } from 'react';
import { DotMap, ContinentChart } from './ui.jsx';

// The claim map as one interactive unit: the dot-matrix world carries the
// heat, and the continent cards beneath it filter it. Clicking a continent
// holds it at brightness while the rest of the world ghosts out; clicking
// again clears the spotlight. The selection lives here so the map and the
// cards can never disagree.
export default function ClaimMap({ points, total, heading = false }) {
  const [selected, setSelected] = useState(null);

  return (
    <>
      <DotMap points={points} filter={selected} className="h-auto w-full" />
      <div className={heading ? 'mx-auto max-w-[900px] px-6 pt-10 pb-4' : 'mt-6'}>
        <ContinentChart
          heading={heading}
          points={points}
          total={total}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </>
  );
}
