import { ImageResponse } from 'next/og';
import { ClaimBanner, BANNER_SIZE, claimBannerData } from '../../../lib/claim-banner.jsx';
import { loadBannerFonts } from '../../../lib/banner-fonts.js';
import { validateName } from '../../../lib/name.js';

// The shareable per-claim banner: /banner/<name>, dark only -- the light
// theme was retired, since the README (where these live) is read dark by
// most people and the light card glared against it. Everything it renders is
// public record, so the response caches at the edge for five minutes — long
// enough that a popular README costs nothing per view, short enough that a
// just-saved profile change shows up promptly.
export async function GET(request, { params }) {
  const { name } = await params;
  if (!validateName(name).ok) {
    return new Response('not found', { status: 404 });
  }

  const data = await claimBannerData(name);
  if (!data) {
    return new Response('not found', { status: 404 });
  }

  const fonts = await loadBannerFonts();
  const res = new ImageResponse(<ClaimBanner {...data} />, {
    ...BANNER_SIZE,
    fonts,
  });
  res.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res;
}
