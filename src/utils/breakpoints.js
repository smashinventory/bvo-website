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

/* Defaults. mobile_max 600 matches the .listing-grid band set on
   2026-09-29; tablet_max 1024 is iPad landscape, the width the owner
   reported cards being cramped at. */
/* tablet_max 1231 = the last width at which the desktop menu does NOT
   fit. It needs 1,222px; below that the cart goes off screen. Changed
   from 1024 on 2026-09-29 — 1024 covered iPad landscape but left
   1025-1231 broken, including the iPad Pro 11-inch at 1180. */
const DEFAULTS = { mobile_max: 600, tablet_max: 1231 };
/* Measured on the live page. The Desktop band must not start below
   this or the menu is shown at a width it cannot fit. */
const DESKTOP_MENU_NEEDS_PX = 1222;

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

  return {
    mobileMax,
    tabletMax,
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

module.exports = { resolve, visibilityCss, visibilityClass,
                   DEFAULTS, SHOW_ON_VALUES, MIN_MOBILE, MAX_TABLET, MIN_GAP,
                   DESKTOP_MENU_NEEDS_PX };
