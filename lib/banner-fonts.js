import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// The site's own faces, loaded for satori. next/og ships Inter as its only
// built-in, so a banner rendered without this comes out in a font the site
// never uses; these are the same files app/layout.jsx loads (Satoshi) plus
// the mono the UI text uses (IBM Plex Mono). Satori reads TTF/OTF/WOFF but
// not WOFF2, which is why the TTF twins sit beside the woff2 files rather
// than reusing them. Cached at module scope: the bytes never change for the
// life of the lambda, and ImageResponse wants fresh buffers per render, so
// the same Buffer objects are handed out again.
//
// next.config.mjs lists app/fonts/*.ttf in outputFileTracingIncludes for the
// banner routes; without that the readdir-less fs reads find nothing in the
// lambda and this returns [] -- satori then falls back to its default, which
// is a degraded banner, not a broken one.
let cache;

export async function loadBannerFonts() {
  if (cache) return cache;

  const files = [
    { name: 'Satoshi', weight: 400, style: 'normal', file: 'Satoshi-Regular.ttf' },
    { name: 'Satoshi', weight: 500, style: 'normal', file: 'Satoshi-Medium.ttf' },
    { name: 'Satoshi', weight: 700, style: 'normal', file: 'Satoshi-Bold.ttf' },
    { name: 'IBM Plex Mono', weight: 400, style: 'normal', file: 'IBMPlexMono-Regular.ttf' },
    { name: 'Bitcount Prop Single', weight: 400, style: 'normal', file: 'BitcountPropSingle.ttf' },
  ];

  const fonts = [];
  for (const { file, ...meta } of files) {
    try {
      fonts.push({ ...meta, data: await readFile(join(process.cwd(), 'app', 'fonts', file)) });
    } catch {
      // One missing face is not a reason to skip the others.
    }
  }

  cache = fonts;
  return fonts;
}
