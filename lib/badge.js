// The embeddable claim banner: the snippets an owner copies to put their name
// on a page they control. Pure string building, no fs and no fetch, so the
// shapes below are unit-tested rather than eyeballed behind a login.
//
// The two surfaces are not equivalent, and the wording in the UI says so.
// A banner on a site the owner controls is an ordinary link. GitHub rewrites
// every link in rendered user content with rel="nofollow" and proxies the
// image through camo, so a README banner earns visibility and nothing more.
// Both are offered anyway: visibility is a real reason to want one.
//
// Dark only: the banner route serves a single dark design, so the embed URLs
// carry no theme parameter at all.
import { BANNER_SIZE } from './banner-size.js';

const APEX = 'runs-on.dev';

// The banner route lives on the apex, never on the claimed host: a relative
// path would be rewritten by proxy.js on a <name>.runs-on.dev render and
// 404, the same trap the card page's share row documents.
export function badgeImageUrl(name) {
  return `https://${APEX}/banner/${name}`;
}

// The banner points at the owner's own card rather than the apex. It reads as
// theirs, which is the only reason anyone embeds it, and an inbound link to a
// subdomain credits the root domain just the same.
export function badgeLinkUrl(name) {
  return `https://${name}.${APEX}`;
}

export function badgeAlt(name) {
  return `${name}.${APEX}`;
}

// width/height ride along so a page embedding the banner reserves its box
// before the image lands instead of reflowing around it.
export function badgeHtml(name) {
  const { width, height } = BANNER_SIZE;
  return [
    `<a href="${badgeLinkUrl(name)}">`,
    `<img src="${badgeImageUrl(name)}"`,
    ` alt="${badgeAlt(name)}"`,
    ` width="${width}" height="${height}">`,
    `</a>`,
  ].join('');
}

export function badgeMarkdown(name) {
  return `[![${badgeAlt(name)}](${badgeImageUrl(name)})](${badgeLinkUrl(name)})`;
}

export function badgeSnippets(name) {
  return {
    // The preview in /manage draws the same box the snippets declare.
    width: BANNER_SIZE.width,
    height: BANNER_SIZE.height,
    imageUrl: badgeImageUrl(name),
    linkUrl: badgeLinkUrl(name),
    html: badgeHtml(name),
    markdown: badgeMarkdown(name),
  };
}
