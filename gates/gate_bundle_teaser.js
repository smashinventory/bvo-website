'use strict';
/* THE BUNDLE TEASER'S LAYOUT — one source, three bands, equal boxes.
 *
 * ⚠️ WHY THIS GATE EXISTS. This component was fixed three times in one
 * day and each fix was shaped by whichever screenshot had just arrived:
 *
 *   - desktop looked fine, so nobody checked that the four cards were
 *     154/144/154/152px tall — align-items:center sized each to its own
 *     content and the shortest one visibly floated;
 *   - a phone screenshot produced a <=600 stacking rule;
 *   - a tablet screenshot produced a 601-900 rule, which left 901-1027
 *     still wrapping 3+1 with a separator stranded at the end of row one.
 *
 * Three symptoms, one defect: NOTHING EQUALISED THE BOXES, and the band
 * edges were literals picked to match a screenshot.
 *
 * Two rules are asserted here, and they are the whole design:
 *
 *   1. The layout is a GRID in every band, with the "+" separators in
 *      their own tracks. As flow items they cannot hold two rows in
 *      line — row one reads card,+,card,+ and the trailing separator
 *      pushes its cards off row two's edges. A track is declared, so
 *      nothing can drift.
 *   2. The upper band edge is COMPUTED by bundleTeaserNeeds(), not
 *      typed. It is arithmetic about this component (4 cards + 3
 *      separators + section padding), so a literal would rot the moment
 *      a card size changed — the same lesson desktopMenuNeeds() records
 *      after being pinned wrong twice.
 *
 * And the blast-radius assertion: adding this must not have changed
 * anything else breakpoints.js emits.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const bpMod = require(path.join(ROOT, 'src/utils/breakpoints'));
const bp    = bpMod.resolve({});
const css   = bpMod.bundleTeaserCss(bp);

console.log('--- the threshold is computed, not typed ---');
const needs = bpMod.bundleTeaserNeeds();
ok('bundleTeaserNeeds() exists and returns a number',
   typeof needs === 'number' && needs > 0, String(needs));
/* Derived from the named constants, so if someone edits a constant the
   query moves with it. This asserts the RELATIONSHIP, not the number —
   pinning 1028 here would be the literal all over again. */
const T = bpMod.TEASER_PX;
ok('it equals row_max + section_pad, from the named constants',
   needs === T.row_max + T.section_pad,
   `${needs} !== ${T.row_max} + ${T.section_pad}`);
ok('the emitted desktop query uses it',
   css.indexOf(`@media (min-width:${needs}px)`) > -1,
   'the one-row band does not start where the cards actually fit');
ok('the tablet band ends one pixel below it',
   css.indexOf(`and (max-width:${needs - 1}px)`) > -1,
   'a gap or an overlap between the tablet and desktop bands');

console.log('--- the lower edge comes from the OWNER\'S band, not a literal ---');
ok(`the tablet band starts at mobile_max+1 (${bp.mobileMax + 1})`,
   css.indexOf(`@media (min-width:${bp.mobileMax + 1}px)`) > -1,
   'moving mobile_max in the Theme Editor would not move the teaser');
ok('the mobile band is the resolved mobile query',
   css.indexOf(`@media ${bp.mq.mobile}`) > -1, bp.mq.mobile);
/* Prove it TRACKS rather than coincides: re-resolve with a different
   mobile_max and the emitted CSS must move with it. 601 matching today
   is exactly the kind of coincidence that reads as correct and is not. */
const moved = bpMod.bundleTeaserCss(bpMod.resolve({ breakpoints: { mobile_max: 720 } }));
ok('changing mobile_max moves the teaser band with it',
   moved.indexOf('@media (min-width:721px)') > -1 && moved.indexOf('@media (min-width:601px)') === -1,
   'the band edge is pinned, not derived');

console.log('--- grid in every band, separators in their own tracks ---');
ok('the row is a grid', /\.bt-cards-row\{display:grid/.test(css), 'back to flex');
[['grid-template-columns:1fr;', 'mobile: one column'],
 ['grid-template-columns:1fr auto 1fr;', 'tablet: card / separator / card'],
 ['grid-template-columns:1fr auto 1fr auto 1fr auto 1fr', 'desktop: four cards, three separators']]
  .forEach(([needle, what]) => ok(what, css.indexOf(needle) > -1, `missing ${needle}`));
/* Explicit placement at tablet. Auto-flow puts the 4th child — a
   separator — at the start of row two, which is the original bug. */
[1, 2, 3, 5, 6, 7].forEach(n => ok(`tablet places child ${n} explicitly`,
  new RegExp(`:nth-child\\(${n}\\)\\{grid-area:[12]/[123]\\}`).test(css),
  'auto-flow would strand a separator at a row start'));
ok('the middle separator is hidden at tablet width',
   /:nth-child\(4\)\{display:none\}/.test(css),
   'it would fall between the two rows, where there is no track for it');

console.log('--- every card is the same size ---');
ok('the row stretches its items', /align-items:stretch/.test(css),
   'align-items:center sizes each card to its own content - measured 154/144/154/152px');
ok('tablet rows are equal height', /grid-template-rows:1fr 1fr/.test(css),
   'the bottom pair would sit taller than the top pair');
ok('cards do not carry their own width cap in the grid',
   /\.bt-step-card\{width:100%;max-width:none;min-width:0/.test(css),
   'a max-width would stop the tracks defining the width');
ok('the separators stay vertically centred', /\.bt-plus\{align-self:center/.test(css),
   'the + would sit at the top of its track');

console.log('--- it is emitted inline, not left to a bundle rebuild ---');
const lay = fs.readFileSync(path.join(ROOT, 'views/layouts/main.ejs'), 'utf8');
ok('main.ejs emits bundleTeaserCss', /breakpoints\.bundleTeaserCss\(/.test(lay),
   'the rules would never reach a page');
/* ⚠️ The CSS files must NOT also carry these rules. Two sources is how
   the 601-900 block and the <=600 block ended up disagreeing, and a
   stale bundle is how 7,892 bytes went missing for weeks. */
['public/css/site4.css', 'public/css/site-bundle.css'].forEach(f => {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  ok(`${f} has no bt-cards-row media rule`,
     !/@media[^{]*\{[^@]{0,400}\.bt-cards-row\{(?:flex-direction|display:grid)/.test(t),
     'two sources for the same layout');
});

console.log('--- ADDITIVE ONLY: nothing else breakpoints.js emits changed ---');
/* The owner asked whether this touches other sections. These are the
   outputs every other page depends on; they are byte-compared against
   the values recorded when this gate was written, so "additive" is
   proven rather than asserted. */
const EXPECTED = {
  visibilityCss: '@media (max-width:600px){.sec--desktop-only,.sec--tablet-only{display:none!important}}'
    + '@media (min-width:601px) and (max-width:1251px){.sec--desktop-only,.sec--mobile-only{display:none!important}}'
    + '@media (min-width:1252px){.sec--mobile-only,.sec--tablet-only{display:none!important}}',
  /* Two values on record, both from src/utils/breakpoints.js's own
     sanity check: the 90px FALLBACK logo gives 1222 (the old pinned
     constant), the live 120px logo gives 1252 (where the Desktop band
     starts). The first draft of this gate asserted only 1252 and went
     red against correct code, because desktopMenuNeeds({}) uses the
     fallback. Both are asserted so neither can drift. */
  desktopMenuNeedsFallbackLogo: 1222,
  desktopMenuNeedsLiveLogo:     1252,
  mobileMax: 600,
  tabletMax: 1251,
};
ok('visibilityCss() is byte-identical', bpMod.visibilityCss(bp) === EXPECTED.visibilityCss,
   bpMod.visibilityCss(bp));
ok('desktopMenuNeeds() unchanged at the fallback logo (90px)',
   bpMod.desktopMenuNeeds({}) === EXPECTED.desktopMenuNeedsFallbackLogo,
   String(bpMod.desktopMenuNeeds({})));
ok('desktopMenuNeeds() unchanged at the live logo (120px)',
   bpMod.desktopMenuNeeds({ nav: { logo_width: 120 } }) === EXPECTED.desktopMenuNeedsLiveLogo,
   String(bpMod.desktopMenuNeeds({ nav: { logo_width: 120 } })));
ok('resolve() still yields the same bands',
   bp.mobileMax === EXPECTED.mobileMax && bp.tabletMax === EXPECTED.tabletMax,
   `${bp.mobileMax}/${bp.tabletMax}`);
ok('the bands are still exhaustive and disjoint',
   bp.bandFor(bp.mobileMax) === 'mobile' && bp.bandFor(bp.mobileMax + 1) === 'tablet'
   && bp.bandFor(bp.tabletMax) === 'tablet' && bp.bandFor(bp.tabletMax + 1) === 'desktop',
   'a width would fall in two bands or none');

console.log('--- every selector belongs to this one section ---');
/* The blast radius, asserted rather than promised: nothing emitted here
   may match outside the bundle_teaser block. */
const sels = (css.match(/[{,]?\s*(\.[a-z-]+)/g) || [])
  .map(s => s.replace(/[{,\s]/g, '')).filter(s => s.startsWith('.'));
const stray = [...new Set(sels)].filter(s => !/^\.bt-/.test(s));
ok('every selector is .bt-*', stray.length === 0, `also styles: ${stray.join(', ')}`);
const idx = fs.readFileSync(path.join(ROOT, 'views/pages/index.ejs'), 'utf8');
const teaser = idx.slice(idx.indexOf("sectionKey === 'bundle_teaser'"),
                         idx.indexOf('end bundle_teaser'));
['bt-cards-row', 'bt-step-card', 'bt-plus'].forEach(c =>
  ok(`.${c} appears only inside the bundle_teaser block`,
     (idx.match(new RegExp(c, 'g')) || []).length ===
     (teaser.match(new RegExp(c, 'g')) || []).length,
     'this class is used by another section - the rules above are not surgical'));

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
