#!/usr/bin/env node
/**
 * gate_nav_single_source.js
 *
 * Guards the 2026-10-02 nav rewrite: the navigation exists ONCE in the HTML.
 *
 * WHAT WAS WRONG
 *   header.ejs rendered the whole navigation twice - a desktop megamenu and a
 *   hand-written #mobile-menu drawer repeating every link. CSS showed one;
 *   crawlers read both. That accounted for 25 of the 27 duplicate-anchor-text
 *   groups the SEO tools reported, and it meant two places to edit for one
 *   change, which is how the two copies drifted apart in the first place.
 *
 * WHY A GATE AND NOT JUST THE COMMIT
 *   The failure mode is not a crash. If someone re-adds a mobile copy "just
 *   for the drawer", everything still renders, the site looks fine in both
 *   layouts, and the duplicate anchors come straight back - silently, and
 *   invisible until the next monthly SEO report. That is exactly the class of
 *   regression a gate is for.
 *
 * WHAT IT DOES NOT DO
 *   It cannot prove the menu still WORKS. <details> behaviour, the hamburger
 *   slide-in and the hover dropdown need a real browser at two widths. The
 *   push script says so, and restore_nav.sh is the way back.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const HEADER   = 'views/partials/header.ejs';
const SETTINGS = 'src/services/themeSettings.js';
const SITEJS   = 'public/js/site.js';
const CSS      = ['public/css/site.css', 'public/css/site-bundle.css'];

let fails = 0;
const ok   = m => console.log('  PASS  ' + m);
const bad  = m => { console.log('  FAIL  ' + m); fails++; };
const check = (cond, m) => cond ? ok(m) : bad(m);

/* Comments are stripped before asserting on prose-sensitive patterns. Two
 * earlier gates in this repo passed or failed on text inside a comment that
 * explained the very thing being asserted. */
function stripComments(s) {
  return s
    .replace(/<%#[\s\S]*?%>/g, '')          // EJS comment tag
    .replace(/<%\/\*[\s\S]*?\*\/%>/g, '')   // EJS block-comment idiom used here
    .replace(/<!--[\s\S]*?-->/g, '');       // HTML comment
}

const headerRaw = read(HEADER);
const header    = stripComments(headerRaw);
const settings  = read(SETTINGS);
const sitejs    = read(SITEJS);

console.log('\n=== gate_nav_single_source ===\n');

/* ───────────── 1. ONE nav list, and the second copy is gone ───────────── */
console.log('-- one navigation, not two --');

// Bounded [\s\S] rather than [^>]*: every EJS tag contains ">" in its closing
// "%>", so [^>]* stops dead at the first EJS tag inside an attribute. That bug
// has bitten three gates in this repo.
const navUlCount = (header.match(/<ul[\s\S]{0,200}?class="nav-links"/g) || []).length;
check(navUlCount === 1, `exactly one <ul class="nav-links"> (found ${navUlCount})`);

check(!/id="mobile-menu"/.test(header),  'no #mobile-menu element');
check(!/class="mobile-menu/.test(header), 'no .mobile-menu element');
check(!/mobile-sub/.test(header),         'no .mobile-sub rows');
check(!/mobile-mega-parent|mobile-mega-header|mobile-sub-toggle/.test(header),
      'no mobile accordion scaffolding');

// The drawer was the ONLY thing in the header that needed a script. If a
// <script> reappears here, someone has rebuilt the accordion in JS.
const scripts = (header.match(/<script[\s>]/g) || []).length;
check(scripts === 0, `no <script> in header.ejs (found ${scripts})`);

/* ───────────── 2. <details> is what collapses the submenu ───────────── */
console.log('\n-- the disclosure --');
check(/<details[\s\S]{0,80}class="nav-disclosure"/.test(header),
      '<details class="nav-disclosure"> present');
check(/<summary[\s\S]{0,80}class="nav-mega-trigger"/.test(header),
      'the trigger is a <summary>, not an <a>');
// A <summary> owns its expanded state. aria-expanded set by hand on it either
// duplicates or contradicts what the element already reports.
check(!/<summary[\s\S]{0,200}aria-expanded/.test(header),
      'no hand-written aria-expanded on the <summary>');
// aria-haspopup describes a menu-button, not a disclosure.
check(!/<summary[\s\S]{0,200}aria-haspopup/.test(header),
      'no aria-haspopup on the <summary>');

/* The old markup used the `hidden` ATTRIBUTE to collapse the sub-list. hidden
 * is global - it hides at every width - so shared markup cannot use it without
 * blanking the desktop columns too. This is the specific mistake to catch. */
check(!/class="mega-menu"[\s\S]{0,120}\shidden/.test(header),
      'the panel is not collapsed with the global `hidden` attribute');

/* ───────────── 3. the destination the old trigger carried ───────────── */
console.log('\n-- nothing became unreachable --');
// The top-level "Vanities" used to be a link. A <summary> cannot be one
// without nesting interactive elements, so the destination moved into the
// panel. If that row goes, the collection drops out of the nav entirely.
check(/class="mega-link mega-link--all"/.test(header),
      'the "Shop All ..." row carrying the old trigger destination exists');
check(/mega-link--all"\s+href="<%=\s*link\.url\s*%>"/.test(header),
      '...and it points at link.url, not a hardcoded path');

// These three lived only in the drawer. They survive as .sr-only text on the
// icon cluster, which renders at every width.
for (const label of ['My Account', 'Saved Items', 'Cart (']) {
  check(header.includes(label), `"${label}" still present (icon cluster)`);
}

/* ───────────── 4. style links have ONE source ───────────── */
console.log('\n-- style links, one source --');
const STYLES = ['Traditional', 'Transitional', 'Modern', 'Farmhouse',
                'Mid-Century Modern', 'Industrial', 'Coastal', 'Scandinavian',
                'European / Old World'];

check(/style_links\s*:/.test(settings), 'nav.vanities_mega.style_links exists in settings');
for (const s of STYLES) {
  check(settings.includes(`'${s}'`), `  settings has style "${s}"`);
}
// The nine were hardcoded TWICE in the template. Zero hardcoded copies now.
const hardcoded = STYLES.filter(s => header.includes(`>${s}</a>`));
check(hardcoded.length === 0,
      `no style label hardcoded in the template (found ${hardcoded.length}: ${hardcoded.join(', ') || 'none'})`);
check(/_vm\.style_links/.test(header), 'template reads style_links from settings');

/* ───────────── 5. the CSS that would silently break the phone ───────────── */
console.log('\n-- CSS --');
for (const f of CSS) {
  const css = read(f);

  /* THE IMPORTANT ONE. @media (max-width:900px){.mega-menu{display:none
   * !important}} existed to stop the desktop dropdown showing while
   * #mobile-menu was the mobile nav. The panel is now the mobile accordion,
   * so this rule hides it on every phone - and !important means the inline
   * CSS in header.ejs cannot win. Re-adding it produces a "Vanities" row
   * that expands to nothing, on mobile only, which desktop testing misses. */
  check(!/\.mega-menu\s*\{\s*display:\s*none\s*!important/.test(css),
        `${f}: .mega-menu is not display:none!important anywhere`);

  /* The list must NOT be display:none below Desktop - it IS the drawer now. */
  check(!/\.nav-brand\s*,\s*\.nav-links\s*\{\s*display:\s*none/.test(css),
        `${f}: .nav-links not force-hidden by the old responsive rule`);

  check(/\.nav-disclosure/.test(css), `${f}: .nav-disclosure rules present`);
  // Marker hiding needs BOTH: list-style for Firefox/Chrome,
  // ::-webkit-details-marker for Safari. Either alone leaves a stray triangle.
  check(/\.nav-disclosure>summary\{[^}]*list-style:\s*none/.test(css),
        `${f}: summary marker hidden via list-style (Firefox/Chrome)`);
  check(/::-webkit-details-marker\{display:none\}/.test(css),
        `${f}: summary marker hidden via ::-webkit-details-marker (Safari)`);

  // Dead rules from the deleted drawer.
  check(!/\.mobile-menu/.test(css), `${f}: no dead .mobile-menu rules`);
  check(!/\.mobile-sub\b/.test(css), `${f}: no dead .mobile-sub rules`);
}

/* The collection filter drawer shares the "mobile-" prefix with the rules that
 * were deleted. It is a live feature and an over-broad cleanup regex would eat
 * it. Asserted only in the bundle, which is where it actually lives (site2.css
 * is its source; site.css never had it). */
check(read('public/css/site-bundle.css').includes('.mobile-filter-btn'),
      'site-bundle.css: .mobile-filter-btn (live filter drawer) survived the cleanup');

/* ───────────── 6. site.js ───────────── */
console.log('\n-- site.js --');
check(!/mobile-menu/.test(sitejs), 'no reference to the deleted #mobile-menu');
check(/getElementById\("primary-nav"\)/.test(sitejs), 'hamburger targets #primary-nav');

/* THE ACCESSIBILITY TRAP. The old handler set aria-hidden on the drawer -
 * true when closed. #primary-nav is now the DESKTOP nav too and starts
 * closed, so that code would stamp aria-hidden="true" on the entire site
 * navigation and leave it there for every desktop screen-reader user. */
check(!/aria-hidden",String\(!/.test(sitejs),
      'does NOT stamp aria-hidden on the nav when closed');
check(!/aria-hidden","true"\)\)\)/.test(sitejs),
      'does NOT stamp aria-hidden on the nav on outside-click close');
/* Anchored on the hamburger's OWN expression, not a bare "aria-expanded"
 * substring. site.js sets aria-expanded in three other places (the search
 * toggle among them), so the loose version passed happily with the
 * hamburger's call deleted - a hole the mutation sweep found. */
check(/e\.setAttribute\("aria-expanded",String\(n\)\)/.test(sitejs),
      'aria-expanded on the hamburger BUTTON is kept (that part was correct)');
check(!/nav-mega-trigger/.test(sitejs),
      'no hand-set aria-expanded on the trigger (<details> owns it)');

/* ───────────── 7. the markup still parses, and renders one copy ───────── */
console.log('\n-- renders --');
let html = null, htmlDirty = null;
function renderWith(mutate) {
  const ejs = require('ejs');
  const vm = require('vm');
  const i = settings.indexOf('const DEFAULTS');
  const j = settings.indexOf('\n};', i);
  const S = vm.runInNewContext(
    settings.slice(i, j + 3).replace(/^const DEFAULTS\s*=/, 'x =') + '\nx;',
    { require: m => require(path.resolve(ROOT, 'src/services', m)) }
  );
  if (mutate) mutate(S);
  return ejs.render(headerRaw, {
    settings: S, cart: { count: 0 }, cspNonce: 'x',
    megaMenuSizes: ['24', '30'],
    megaMenuColorFamilies: [{ key: 'white', label: 'White' }],
  }, { filename: path.join(ROOT, HEADER) });
}
try { html = renderWith(null); ok('header.ejs renders'); }
catch (e) { bad('header.ejs renders: ' + e.message); }

/* Rendered a SECOND time with a tag deliberately injected into the promo
 * title, because that is the case that actually ships: the live
 * data/theme_settings.json holds a br tag there, and the settings file wins
 * over the defaults on a deep merge.
 *
 * Rendering only from the clean defaults is why the first version of this gate
 * survived the "tag-stripping removed" mutation - it was testing the one case
 * that cannot fail. */
try {
  htmlDirty = renderWith(S => {
    S.nav.vanities_mega.promo.title = 'Every Model,<br>Every Finish';
    S.nav.vanities_mega.promo.eyebrow = '<b>Our</b> Collection';
  });
  ok('header.ejs renders with tags in the settings values');
} catch (e) {
  bad('header.ejs renders with tags in the settings values: ' + e.message);
}

if (html) {
  const anchors = [...html.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
    .map(m => m[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const dupes = [...new Set(anchors.filter((v, i) => anchors.indexOf(v) !== i))];
  check(dupes.length === 0,
        `no anchor text appears twice in the rendered header (${dupes.length ? JSON.stringify(dupes) : 'none'})`);

  // Each style label should now render exactly once, not twice.
  const twice = STYLES.filter(s => anchors.filter(a => a === s).length > 1);
  check(twice.length === 0, `no style label rendered twice (${twice.join(', ') || 'none'})`);

  check((html.match(/<details/g) || []).length === 1, 'exactly one <details> rendered');
}

/* ───────────── 8. the promo-card escaping bug ───────────── */
console.log('\n-- promo card: tags in settings values --');

/* Three layers, because each catches a different way this comes back. */

// (a) the strip itself, tested against the value that actually ships.
if (htmlDirty) {
  check(!/&lt;br/.test(htmlDirty),
        'a br tag in the settings title does NOT render as visible escaped text');
  check(!/&lt;b&gt;/.test(htmlDirty),
        'a b tag in the settings eyebrow does NOT render as visible escaped text');
  // The strip must not go the other way and emit live HTML either - that would
  // be script injection from an admin-editable field.
  check(!/<br\s*\/?>/i.test(
          (htmlDirty.match(/class="mega-promo-title"[\s\S]{0,300}?<\/p>/) || [''])[0]),
        '...and is not rendered as live HTML either (no injection)');
  const dirtyAnchor = (htmlDirty.match(
    /class="mega-promo-title"[\s\S]{0,300}?>([^<]*)<\/a>/) || [])[1];
  check((dirtyAnchor || '').trim() === 'Every Model, Every Finish',
        `promo anchor text is clean prose (got ${JSON.stringify((dirtyAnchor || '').trim())})`);
}

// (b) the helper is still wired to the title. The mutation sweep showed the
//     render check alone could not see this when the default was clean.
check(/_plain\(_vmp\.title/.test(header),
      'the tag-stripping helper is applied to the promo title');
check(/_plain\(_vmp\.eyebrow/.test(header),
      'the tag-stripping helper is applied to the promo eyebrow');
check(/function _plain\(/.test(header), '_plain() is defined in the template');

// (c) the default is clean too, so a fresh environment does not reintroduce it.
//     Belt-and-braces behind (a), but the comment in header.ejs claims it, so
//     it gets asserted rather than trusted.
check(!/title:\s*'Every Model,<br>/.test(settings),
      'the settings DEFAULT promo title has no br tag');

console.log(`\n${fails ? 'FAILED: ' + fails + ' assertion(s)' : 'All assertions passed.'}\n`);
process.exit(fails ? 1 : 0);
