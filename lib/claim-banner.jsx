import { getRecord } from './registry.js';
import { REPO_URL } from './repo.js';
import { claimNumber } from './claim-order.js';

// The per-claim banner artwork, rendered by next/og from
// app/banner/[name]/route.js (the downloadable/shareable image, dark only
// since the light theme was retired).
//
// Satori (what next/og renders with) supports a subset of CSS: flexbox only,
// no shorthand, explicit sizes on images, and TTF/OTF/WOFF fonts passed in
// explicitly. The typefaces here are the site's own -- Satoshi for display,
// IBM Plex Mono for the machine lines -- handed in by the route through
// lib/banner-fonts.js, because satori ships only Inter by default. Everything
// else stays inside that subset on purpose.

// Re-exported so existing importers keep working; the number lives in
// lib/banner-size.js.
export { BANNER_SIZE } from './banner-size.js';

const THEME = {
  ground: '#080808',
  muted: '#9C9C9C',
  ink: '#F3F3F3',
  rule: '#212121',
  signal: '#8A8172',
  verified: '#98FF38',
};

// The verified mark that rides beside the big name link — the owner's own
// pick (lucide badge-check, this exact path data), stroked green like the
// one by the display name.
function VerifiedLinkIcon({ size }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={THEME.verified}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'flex' }}
    >
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
      <path d="m16 9-5.5 5.5L8 12" />
    </svg>
  );
}

// The white pixel-dot texture: a faint grid of dots across the whole banner,
// the claim map's dot-matrix idea as a background. Generated rather than a
// pattern fill because satori's SVG support has no <pattern>.
const DOT_PITCH = 48;
const DOTS = [];
for (let x = DOT_PITCH / 2; x < 1200; x += DOT_PITCH) {
  for (let y = DOT_PITCH / 2; y < 630; y += DOT_PITCH) {
    DOTS.push([x, y]);
  }
}

// The frame: four corners only, each drawn as a horizontal and a vertical
// hairline that cross past the corner point, so every corner reads as a
// small intercrossed mark instead of a continuous border.
const FRAME_INSET = 40;
const FRAME_ARM = 26;
const FRAME_BARS = [
  // [left, top, width, height] — horizontal and vertical bar per corner
  [FRAME_INSET - FRAME_ARM, FRAME_INSET - 1, FRAME_ARM * 2 + 2, 2], // TL h
  [FRAME_INSET - 1, FRAME_INSET - FRAME_ARM, 2, FRAME_ARM * 2 + 2], // TL v
  [1200 - FRAME_INSET - FRAME_ARM, FRAME_INSET - 1, FRAME_ARM * 2 + 2, 2], // TR h
  [1200 - FRAME_INSET - 1, FRAME_INSET - FRAME_ARM, 2, FRAME_ARM * 2 + 2], // TR v
  [FRAME_INSET - FRAME_ARM, 630 - FRAME_INSET - 1, FRAME_ARM * 2 + 2, 2], // BL h
  [FRAME_INSET - 1, 630 - FRAME_INSET - FRAME_ARM, 2, FRAME_ARM * 2 + 2], // BL v
  [1200 - FRAME_INSET - FRAME_ARM, 630 - FRAME_INSET - 1, FRAME_ARM * 2 + 2, 2], // BR h
  [1200 - FRAME_INSET - 1, 630 - FRAME_INSET - FRAME_ARM, 2, FRAME_ARM * 2 + 2], // BR v
];

// One registry read + one GitHub read, shared by both render sites, with the
// same short revalidate the card page uses so a banner reflects a fresh
// claim within minutes rather than an hour.
export async function claimBannerData(name) {
  const token = process.env.CARD_TOKEN ?? process.env.REGISTRY_TOKEN;
  const fetchImpl = (url, init) => fetch(url, { ...init, next: { revalidate: 300 } });

  const record = await getRecord(name, { token, fetchImpl }).catch(() => null);
  if (!record) return null;

  const res = await fetch(`https://api.github.com/users/${record.owner.github}`, {
    // Authorization only when a token actually exists: `Bearer undefined`
    // is a malformed credential GitHub answers with 401, not an anonymous
    // request. registry.js's headers() plays the same trick.
    headers: token
      ? { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` }
      : { Accept: 'application/vnd.github+json' },
    next: { revalidate: 3600 },
  }).catch(() => null);
  const profile = res && res.ok ? await res.json().catch(() => null) : null;

  // The ?s= parameter asks GitHub for a square render at a size worth
  // putting on a 1200px-wide card. The avatar is fetched here and embedded
  // as a data: URL rather than handed to <img src> as a remote link, because
  // satori's own remote-image fetching depends on the runtime it runs in —
  // an avatar that silently renders as an empty circle in one environment
  // is exactly the failure a shareable banner cannot afford.
  let avatarUrl = profile?.avatar_url ?? null;
  if (avatarUrl) {
    const sized = new URL(avatarUrl);
    sized.searchParams.set('s', '256');
    const imgRes = await fetch(sized.href, { next: { revalidate: 3600 } }).catch(() => null);
    if (imgRes?.ok) {
      const buf = Buffer.from(await imgRes.arrayBuffer());
      const mime = (imgRes.headers.get('content-type') ?? 'image/png').split(';')[0];
      avatarUrl = `data:${mime};base64,${buf.toString('base64')}`;
    } else {
      avatarUrl = null;
    }
  }

  const overrides = record.profile ?? {};
  return {
    name,
    login: record.owner.github,
    displayName: overrides.name ?? profile?.name ?? null,
    bio: overrides.bio ?? profile?.bio ?? null,
    claimedYear: (record.claimedAt ?? '').slice(0, 4) || null,
    avatarUrl,
    serial: claimNumber(name),
  };
}

export function ClaimBanner({ name, login, displayName, bio, claimedYear, avatarUrl, serial }) {
  const t = THEME;

  // Fit the pixel-font name line inside the banner for any name length:
  // Bitcount glyphs run roughly 0.6em wide, the suffix adds 12 characters,
  // and the icon plus gaps take about 90px.
  const nameSize = Math.min(72, Math.floor(966 / (0.6 * (name.length + 12))));
  // Bitcount glyphs measure ~0.5em per character at this size (measured off
  // the rendered banner), so the underline hugs the whole name link.
  const blueWidth = Math.round(nameSize * 0.5 * name.length);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: t.ground,
        position: 'relative',
        fontFamily: 'Satoshi',
      }}
    >
      {/* Obsidian dot field: white pixels on near-black, the claim map's
          matrix as a background. */}
      <svg width={0} height={0} style={{ position: 'absolute', top: 0, left: 0, display: 'none' }} aria-hidden="true">
        {DOTS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.2} fill="rgba(255,255,255,0.09)" />
        ))}
      </svg>

      {/* The frame: four intercrossed corner marks, never a full border. */}
      {FRAME_BARS.map(([left, top, width, height], i) => (
        <div
          key={i}
          style={{ position: 'absolute', left, top, width, height, background: 'rgba(243,243,243,0.5)' }}
        />
      ))}

      {serial != null && (
        <span
          style={{
            position: 'absolute',
            top: 44,
            right: 64,
            display: 'flex',
            fontFamily: 'IBM Plex Mono',
            fontSize: 26,
            letterSpacing: 2,
            color: t.muted,
          }}
        >
          {`#${serial}`}
        </span>
      )}

      <div style={{ display: 'flex', alignItems: 'center' }}>
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            width={96}
            height={96}
            style={{ borderRadius: 96, border: `2px solid ${t.rule}` }}
          />
        ) : (
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 96,
              border: `2px solid ${t.rule}`,
              display: 'flex',
            }}
          />
        )}
        <div style={{ marginLeft: 28, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 30, fontWeight: 500, color: t.ink, display: 'flex' }}>
            {displayName ?? `@${login}`}
          </span>
          <span
            style={{
              fontSize: 20,
              color: t.muted,
              marginTop: 6,
              display: 'flex',
              fontFamily: 'IBM Plex Mono',
              letterSpacing: 1,
            }}
          >
            {claimedYear ? `claimed ${claimedYear}` : `@${login}`}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Bitcount Prop Single', fontSize: nameSize, color: t.ink, display: 'flex' }}>
                {name}
              </span>
              <span style={{ fontFamily: 'Bitcount Prop Single', fontSize: nameSize, color: t.muted, display: 'flex', marginLeft: Math.round(nameSize * 0.06) }}>
                .runs-on.dev
              </span>
            </div>
            {/* The blue line hugs the name itself — same width as the word above it. */}
            <div style={{ display: 'flex', marginTop: 14, height: 5, width: Math.round(nameSize * 0.5 * name.length), background: '#4D7CFF' }} />
          </div>
          <div style={{ display: 'flex', marginLeft: 26, alignSelf: 'flex-start' }}>
            <VerifiedLinkIcon size={62} />
          </div>
        </div>
        {bio ? (
          <span style={{ fontSize: 26, color: t.muted, marginTop: 20, display: 'flex', maxWidth: 900 }}>
            {bio.length > 120 ? `${bio.slice(0, 117)}…` : bio}
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: 20,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: t.muted,
            display: 'flex',
          }}
        >
          A FREE SUBDOMAIN REGISTRY
        </span>
        <span
          style={{
            fontFamily: 'IBM Plex Mono',
            fontSize: 22,
            color: t.signal,
            display: 'flex',
          }}
        >
          {REPO_URL.replace('https://', '')}
        </span>
      </div>
    </div>
  );
}
