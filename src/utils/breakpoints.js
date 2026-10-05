'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   breakpoints.js — where the screen-size bands are defined, once

   ── WHY THIS EXISTS ────────────────────────────────────────────────────

   Owner, 2026-09-29: "the theme editor does not allow me to have any
   changeability of the views based on size of screen. There are 3
   options, but only the desktop and mobile work." And: "help me take
   control as opposed to you hardcoding."

   Both were true, and the second explains the first. Every responsive
   decision on this site was a hand-written media query sitting in a CSS
   file, so there was nothing for the Theme Editor to control:

     - `show_on` offered All / Desktop / Mobile, implemented as
       .sec--desktop-only / .sec--mobile-only at a hardcoded 860px. There
       was no Tablet state because there was no tablet band.
     - The preview's Tablet button (768px) and the px box therefore looked
       broken. They were not: at 768 the site renders its mobile layout,
       because 860 is the only line the site knows about.
     - The nav logo Width/Height fields applied only above 861px
       (commit f46d687, "Phones keep 90px on purpose"), so on a phone the
       control did nothing at all.

   Now the bands are DATA. The owner sets two numbers; everything derives
   from them. Adding a band or moving a line is a settings change, not a
   code change, and it moves the storefront and the editor together
   because both read this file.

   ── THE BANDS ──────────────────────────────────────────────────────────

       mobile      0            .. mobile_max
       tablet      mobile_max+1 .. tablet_max
       desktop     tablet_max+1 .. ∞

   Exhaustive and disjoint by construction — see gates/gate_listing_grid_
   breakpoints.js for what overlapping bands cost on this codebase. A
   width belongs to exactly one band, so cascade order can never decide
   which one wins.

   ── WHY THE CSS IS EMITTED INLINE, NOT WRITTEN TO A FILE ───────────────

   Found 2026-09-29 while building this: public/css/site4.css is linked
   ONLY by the admin layout. The storefront loads site-bundle.css alone,
   and the bundle is stale — site4's storefront rules never made it in.
   That is why `@media (max-width:480px){.site-nav{padding:0 12px}}`
   exists in site4.css and yet a phone still renders 40px of padding and
   clips the hamburger. (CLAUDE.md already records that the bundle
   rebuild recipe does not reproduce the file.)

   Settings-driven CSS is therefore emitted as an inline <style> in the
   page that uses it. It cannot go stale against a bundle, it needs no
   rebuild step, and a value the owner types is live on the next request.
   ═══════════════════════════════════════════════════════════════════════ */

/* ── THE DESKTOP MENU'S WIDTH REQUIREMENT ──────────────────────────────

   This was a pinned constant twice, and it was wrong twice.

     1024  — a DEVICE width (iPad landscape). Fixed that one device and
             left 1025-1231 showing a menu that does not fit.
     1222  — a real measurement, but taken with a 90px logo while the
             desktop band renders the owner's 120px logo. 30px short per
             30px of logo. At 1232 the cart was still 4px off screen.

   The lesson both times: a number that DEPENDS on settings cannot be
   stored as a literal, because the settings move and the literal does
   not. So it is computed.

   Owner, 2026-09-29: "as the screen gets large enough for the wordmark
   the hamburger is no longer needed as it is most likely a computer or
   laptop." That is the rule this file now implements literally — one
   line, placed where the full menu genuinely fits.

   WHAT VARIES (read from settings, so the threshold tracks them):
     pad_desktop    both side paddings
     gap_desktop    the three gaps between the four items
     logo_width     the desktop logo

   WHAT IS MEASURED (content, not settings — no field controls these):
     the wordmark, the links row, the icon cluster.

   Measured 2026-09-29 on the live page at 1232px, computed styles, via
   getBoundingClientRect on each child of .site-nav. Re-measure if the
   nav gains a link, the wordmark text changes, or the font changes —
   and change the numbers HERE, where they are named, not at a call
   site. */
const MEASURED_PX = {
  brand: 253,  // .nav-brand   — "BathroomVanitiesOutlet.com", 3 lines
  links: 555,  // .nav-links   — 6 items incl. the Vanities megamenu
  icons: 160,  // .nav-icons   — search, account, wishlist, CART
};

/* Fallbacks matching themeSettings' nav defaults. Named once so a
   missing setting cannot silently become 0 and shrink the threshold. */
const NAV_FALLBACK = { pad_desktop: 40, gap_desktop: 28, logo_width: 90 };

function _num(v, fallback) {
  if (v === undefined || v === null || String(v).trim() === '') return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * The narrowest viewport at which the full desktop nav fits without
 * pushing the cart off the right edge.
 *
 * Four items, three gaps, two paddings:
 *   pad + logo + gap + brand + gap + links + gap + icons + pad
 *
 * Sanity check against the two measurements on record:
 *   logo  90 → 1222   (matches the old pinned constant exactly)
 *   logo 120 → 1252   (matches the live measurement at 1232/1252)
 */
function desktopMenuNeeds(settings) {
  const nav = (settings && settings.nav) || {};
  const pad  = _num(nav.pad_desktop,  NAV_FALLBACK.pad_desktop);
  const gap  = _num(nav.gap_desktop,  NAV_FALLBACK.gap_desktop);
  const logo = _num(nav.logo_width,   NAV_FALLBACK.logo_width);

  return (pad * 2)
       + logo + MEASURED_PX.brand + MEASURED_PX.links + MEASURED_PX.icons
       + (gap * 3);
}

/* Defaults. mobile_max 600 matches the .listing-grid band set on
   2026-09-29.

   tablet_max 1251 = desktopMenuNeeds() - 1 at the LIVE logo size (120),
   so the Desktop band starts at 1252, exactly where the menu fits. It
   is written out rather than computed because DEFAULTS is a static seed
   for themeSettings and cannot read a saved logo size. gate_breakpoints
   asserts the two agree, so this cannot drift unnoticed. */
const DEFAULTS = { mobile_max: 600, tablet_max: 1251 };

/* The logo size DEFAULTS was computed against. If the owner's saved
   logo differs, the editor shows them the recomputed requirement. */
const DEFAULTS_ASSUME_LOGO_PX = 120;

/* Sanity rails. Not taste — these stop a typo producing a site with no
   desktop layout, or bands that cross over and cancel each other. */
const MIN_MOBILE = 320;
const MAX_TABLET = 1920;
const MIN_GAP    = 40;   // tablet band must be at least this wide

function resolve(settings) {
  const raw = (settings && settings.breakpoints) || {};

  let mobileMax = parseInt(raw.mobile_max, 10);
  let tabletMax = parseInt(raw.tablet_max, 10);
  if (!Number.isFinite(mobileMax)) mobileMax = DEFAULTS.mobile_max;
  if (!Number.isFinite(tabletMax)) tabletMax = DEFAULTS.tablet_max;

  mobileMax = Math.min(Math.max(mobileMax, MIN_MOBILE), MAX_TABLET - MIN_GAP);
  tabletMax = Math.min(Math.max(tabletMax, mobileMax + MIN_GAP), MAX_TABLET);

  /* What the desktop menu needs at THIS owner's logo and spacing, and
     whether their Desktop band starts below it.

     Deliberately NOT clamped. The owner asked to take control and then
     watched me ship numbers they had not approved; silently raising
     their value would be the same move in a nicer coat. So the hole is
     reported, the Theme Editor shows it, and gate_breakpoints refuses
     the push when the shipped defaults leave one. What the owner types
     is what the owner gets. */
  const desktopNeeds  = desktopMenuNeeds(settings);
  const desktopStarts = tabletMax + 1;
  const shortfallPx   = Math.max(0, desktopNeeds - desktopStarts);

  return {
    mobileMax,
    tabletMax,
    desktopNeeds,
    desktopStarts,
    /* 0 = every width lands in a band whose layout fits. Above 0, the
       cart is off screen from desktopStarts up to desktopNeeds-1. */
    shortfallPx,
    shortfallRange: shortfallPx > 0
      ? { from: desktopStarts, to: desktopNeeds - 1 }
      : null,
    /* Media query conditions, so no caller ever writes one by hand and
       gets the ±1 wrong. These are what make the bands disjoint. */
    mq: {
      mobile:  `(max-width:${mobileMax}px)`,
      tablet:  `(min-width:${mobileMax + 1}px) and (max-width:${tabletMax}px)`,
      desktop: `(min-width:${tabletMax + 1}px)`,
      /* Handy combinations the storefront needs. Derived, never typed. */
      upToTablet:   `(max-width:${tabletMax}px)`,
      tabletAndUp:  `(min-width:${mobileMax + 1}px)`,
    },
    /** Which band a width falls in — used by gates and by the editor. */
    bandFor(w) {
      if (w <= mobileMax) return 'mobile';
      if (w <= tabletMax) return 'tablet';
      return 'desktop';
    },
  };
}

/* ── THE BUNDLE TEASER'S OWN THRESHOLD ─────────────────────────────────

   Same shape of problem as desktopMenuNeeds(), and solved the same way:
   a number that depends on the component's own sizes cannot be a
   literal, because the sizes move and the literal does not.

   The teaser is four cards with three "+" separators between them. The
   lower edge of its tablet band is a BAND question - it belongs to the
   owner's mobile_max. The upper edge is not: it is "do four cards and
   three separators fit on one line", which is arithmetic about this
   component, not about devices. Pinning it to tablet_max (1251) would
   stack cards on a laptop; pinning it to the nav's 861 leaves 861-1027
   wrapping, which is exactly the hole shipped in ffec986.

   MEASURED 2026-10-05 via getBoundingClientRect on the real markup
   against the real bundle, at 601/650/700/740/760/780/800/820/860/900/
   1000/1100/1251/1300:

     viewport  rowW  cardW  plusW  lines
     700        652   172    46     3      <- wraps 3+1, + stranded
     900        772   159    46     2
     1000       872   184    46     2
     1100       900   191    46     1      <- first single line

   The row settles at one line only once it reaches its own 900px
   max-width: 4x191 + 3x46 = 902. Re-measure if a card, a separator or
   the section padding changes - and change the numbers HERE, where they
   are named, not at a call site. */
const TEASER_PX = {
  row_max:     900,  // .bt-cards-row max-width
  sep:          46,  // .bt-plus rendered width incl. its 0 .75rem padding
  cards:         4,
  section_pad:  128, // .section padding:64px, both sides, above 860
};

/**
 * The narrowest viewport at which the four cards sit on ONE line.
 * Below this the teaser uses its 2x2 grid; at or above it, one row.
 */
function bundleTeaserNeeds() {
  return TEASER_PX.row_max + TEASER_PX.section_pad;
}

/* ── the teaser's three bands, as CSS ──────────────────────────────────

   GRID IN EVERY BAND, and the separators get their OWN track.

   The flex version could not hold the two rows in line, because "+" is a
   flow item: at two cards per row the line reads card,+,card,+ and the
   trailing separator pushes row one's cards off row two's edges. The
   owner remembers that being compensated for once already. A track does
   it structurally - the columns are declared, so nothing can drift.

   The middle separator (Top <-> Mirror) is the one hidden at tablet
   width: it would fall between the two ROWS, where there is no track for
   it. The other two stay, so each row still reads "card + card".

   align-items:stretch and 1fr rows are what make every card the same
   size. The old align-items:center sized each card to its own content -
   measured on the real markup, the four cards came out 154/144/154/152px
   tall, which is the "Top looks smaller" the owner reported on desktop.
   Same defect, visible differently in each band. */
function bundleTeaserCss(bp) {
  const needs = bundleTeaserNeeds();
  const one   = `(min-width:${needs}px)`;
  const two   = `(min-width:${bp.mobileMax + 1}px) and (max-width:${needs - 1}px)`;
  return [
    /* Shared in every band: grid, equal tracks, separators centred. */
    '.bt-cards-row{display:grid;align-items:stretch;justify-content:center;'
      + 'margin:2rem auto 0;max-width:' + TEASER_PX.row_max + 'px}',
    '.bt-step-card{width:100%;max-width:none;min-width:0;flex:none}',
    '.bt-plus{align-self:center;flex-shrink:0;display:block}',

    /* Mobile: one column. Cards keep their narrow cap and centre. */
    `@media ${bp.mq.mobile}{`
      + '.bt-cards-row{grid-template-columns:1fr;gap:0;justify-items:center}'
      + '.bt-step-card{max-width:320px}'
      + '.bt-plus{text-align:center;padding:.25rem 0;line-height:1}}',

    /* Tablet: 2x2 with a separator column. Explicit placement, because
       auto-flow would put the 4th child (a separator) at the start of
       row two - the bug this replaces. */
    `@media ${two}{`
      + '.bt-cards-row{grid-template-columns:1fr auto 1fr;grid-template-rows:1fr 1fr;gap:1rem}'
      + '.bt-cards-row>:nth-child(1){grid-area:1/1}'
      + '.bt-cards-row>:nth-child(2){grid-area:1/2}'
      + '.bt-cards-row>:nth-child(3){grid-area:1/3}'
      + '.bt-cards-row>:nth-child(4){display:none}'
      + '.bt-cards-row>:nth-child(5){grid-area:2/1}'
      + '.bt-cards-row>:nth-child(6){grid-area:2/2}'
      + '.bt-cards-row>:nth-child(7){grid-area:2/3}}',

    /* Desktop: one row, seven tracks, all four cards the same height. */
    `@media ${one}{`
      + '.bt-cards-row{grid-template-columns:1fr auto 1fr auto 1fr auto 1fr;gap:0}}',
  ].join('');
}

/* ── show_on → the CSS that hides a section ────────────────────────────
   Replaces the two hardcoded rules at 860px with three bands driven by
   the owner's numbers. Emitted inline by the layout.

   A section set to "tablet" is hidden on mobile AND desktop, which needs
   two rules — the reason the old two-state version could not simply grow
   a third option. */
function visibilityCss(bp) {
  return [
    `@media ${bp.mq.mobile}{.sec--desktop-only,.sec--tablet-only{display:none!important}}`,
    `@media ${bp.mq.tablet}{.sec--desktop-only,.sec--mobile-only{display:none!important}}`,
    `@media ${bp.mq.desktop}{.sec--mobile-only,.sec--tablet-only{display:none!important}}`,
  ].join('');
}

/** show_on value → the class the wrapper gets. '' means always visible. */
function visibilityClass(showOn) {
  return showOn === 'desktop' ? 'sec--desktop-only'
       : showOn === 'tablet'  ? 'sec--tablet-only'
       : showOn === 'mobile'  ? 'sec--mobile-only'
       : '';
}

const SHOW_ON_VALUES = ['all', 'desktop', 'tablet', 'mobile'];

module.exports = { resolve, visibilityCss, visibilityClass, desktopMenuNeeds,
                   bundleTeaserNeeds, bundleTeaserCss, TEASER_PX,
                   DEFAULTS, SHOW_ON_VALUES, MIN_MOBILE, MAX_TABLET, MIN_GAP,
                   MEASURED_PX, NAV_FALLBACK, DEFAULTS_ASSUME_LOGO_PX };
