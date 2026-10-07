#!/usr/bin/env node
'use strict';

/* gate_hero_settings.js
 *
 * THE RULES THIS ENFORCES, all agreed with Sam before any code was written and
 * all learned the hard way during the audit that preceded it.
 *
 * 1. EVERY LIVE EDITOR FIELD HAS A DEFAULT.
 *    Six hero fields rendered in the Theme Editor with nothing behind them.
 *    They worked, via inline fallbacks, but the editor could not show a true
 *    current value and the defaults file did not describe the section honestly.
 *
 * 2. A STYLE DEFAULT IS A SENTINEL, NOT A RESOLVED VALUE.
 *    heading_size is read as `hero.heading_size ? 'font-size:'+x+'px' : ''`.
 *    Seeding 0 keeps the CSS rule. Seeding the resolved 42px would REPLACE a
 *    responsive rule with a fixed pixel size at every viewport — a silent
 *    change to the live page. This is the rule that protects the tuned state.
 *
 * 3. NO DUPLICATE KEYS IN THE DEFAULTS.
 *    JavaScript keeps the LAST of two same-named keys and discards the first,
 *    silently. DEFAULTS already shipped with two `seo:` blocks for exactly this
 *    reason. An earlier pass of this very audit nearly added duplicate
 *    cta1_url / cta2_url keys because a regex only matched keys at line start —
 *    they were already defined mid-line. EVALUATE THE OBJECT, DO NOT GREP IT.
 *
 * 4. ENABLING A READ PUBLISHES WHATEVER IS STORED, so new output ships OFF.
 *    badge_text has been stored as 'Free Shipping' all along, dormant only
 *    because nothing read it. Rendering the badge without an explicit enable
 *    flag would have published it to the live homepage unasked.
 *
 * 5. THE BADGE NEVER USES A FIXED PIXEL OFFSET.
 *    The original was position:absolute;top:28px;left:28px. The hero has two
 *    layouts, variable height bounds, a content box with its own offsets and a
 *    separate mobile aspect ratio, so that offset landed somewhere different in
 *    every combination. That is why the badge was pulled. Reintroducing a fixed
 *    offset reintroduces the bug.
 *
 * Deliberately NOT asserted: the VALUE of any tuned setting. Those live in
 * data/theme_settings.json on the server, not in git, and the live values differ
 * from the defaults on thirteen keys. Asserting them here would fail for the
 * wrong reason the moment Sam retunes something. See
 * docs/rollbacks/HERO_UNWIND_2026-10-06.md.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const ROOT = path.join(__dirname, '..');

let fails = 0, checks = 0;
const ok  = m => { checks++; console.log('  ok   ' + m); };
const bad = (m,d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c,m,d) => c ? ok(m) : bad(m,d);
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

/* Comments name the very things these rules forbid — the badge comment says
   "top:28px", the settings comment says "duplicate keys". Matching raw source
   would flag the documentation as the bug, which is exactly what happened on
   the social-share gate earlier the same day. */
function strip(src) {
  return src
    .replace(/<%#[\s\S]*?%>/g, '')
    .replace(/<%\/\*[\s\S]*?\*\/%>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(?<!:)\/\/[^\n]*/g, '');
}

console.log('\ngate_hero_settings — defaults, sentinels, and output that ships off\n');

const svc   = read('src/services/themeSettings.js');
const theme = read('views/pages/admin/theme.ejs');
const index = read('views/pages/index.ejs');

/* Evaluate DEFAULTS rather than pattern-matching it — see rule 3. */
const di = svc.indexOf('const DEFAULTS');
const DEFAULTS = vm.runInNewContext(
  svc.slice(di, svc.indexOf('\n};', di) + 3).replace(/^const DEFAULTS\s*=/, 'x =') + '\nx;',
  { require: m => require(path.resolve(ROOT, 'src/services', m)) });
const hero = DEFAULTS.hero;

const editorFields = new Set([...strip(theme).matchAll(/hero\.([a-z_0-9]+)/g)].map(m => m[1]));
const readFields   = new Set([...strip(index).matchAll(/hero\.([a-z_0-9]+)/g)].map(m => m[1]));

/* ── 1. every live editor field has a default ────────────────────────────── */
{
  const missing = [...editorFields].filter(f => !(f in hero)).sort();
  check(missing.length === 0,
        'every field the Theme Editor renders has a default',
        missing.join(', '));
}

/* ── 2. style defaults are sentinels ─────────────────────────────────────── */
{
  /* These are read as `x ? inline : ''`, so a truthy default would write an
     inline style and beat the stylesheet. The sentinel keeps the CSS. */
  for (const f of ['heading_size', 'subtext_size']) {
    check(hero[f] === 0,
          `${f} defaults to the sentinel 0, so the CSS rule still wins`,
          'got ' + JSON.stringify(hero[f]));
    check(new RegExp('hero\\.' + f + '\\s*\\?').test(strip(index)),
          `${f} is still read as a truthiness test (the sentinel means something)`);
  }
  check(hero.sub2_color === '',
        "sub2_color defaults to '' so no CSS var is written");
  /* overlay defaults must equal the template's own fallbacks, or adding them
     moves the page on any install that has not overridden them. */
  check(hero.overlay_color === '#0f1f35',
        'overlay_color default equals the template fallback');
  check(Number(hero.overlay_opacity) === 55,
        'overlay_opacity default equals the template fallback (55/100 = 0.55)');
  check(hero.heading_level === 'h1',
        'heading_level default equals _safeTag’s fallback');
}

/* ── 3. no duplicate keys ────────────────────────────────────────────────── */
{
  const body = strip(svc.slice(di, svc.indexOf('\n};', di)));
  const dupes = [];
  const seen = new Map();
  let depth = 0;
  for (const line of body.split('\n')) {
    const m = line.match(/^\s*([a-zA-Z_][\w]*)\s*:/);
    if (m) {
      if (!seen.has(depth)) seen.set(depth, new Set());
      if (seen.get(depth).has(m[1])) dupes.push(`${m[1]} (depth ${depth})`);
      else seen.get(depth).add(m[1]);
    }
    const o = (line.match(/[{[]/g) || []).length, c = (line.match(/[}\]]/g) || []).length;
    if (o > c) depth += o - c;
    else if (c > o) { for (let d = depth; d > depth - (c - o); d--) seen.delete(d); depth -= c - o; }
  }
  check(dupes.length === 0, 'no duplicate keys in DEFAULTS', dupes.join(', '));

  const k = Object.keys(hero);
  check(new Set(k).size === k.length, `hero has ${k.length} unique keys`);
}

/* ── 4. the badge ships off ──────────────────────────────────────────────── */
{
  check(hero.badge_enabled === false,
        'badge_enabled defaults to FALSE — stored badge_text must not publish itself');
  check(typeof hero.badge_text === 'string' && hero.badge_text.length > 0,
        'badge_text is preserved, not blanked');

  const idx = strip(index);
  check(/hero\.badge_enabled\s*===\s*true/.test(idx),
        'the render requires badge_enabled === true explicitly (not merely truthy)');
  check(/hero\.badge_enabled/.test(strip(theme)),
        'the Theme Editor exposes the enable switch');
}

/* ── 5. no fixed pixel offset, ever ──────────────────────────────────────── */
{
  for (const f of ['public/css/site-bundle.css', 'public/css/site2.css']) {
    const css = strip(read(f));
    const rules = css.match(/\.hero-badge[^{]*\{[^}]*\}/g) || [];
    const fixed = rules.filter(r => /(top|left|right|bottom)\s*:\s*\d+px/.test(r));
    check(fixed.length === 0,
          `${path.basename(f)}: no .hero-badge rule uses a fixed pixel offset`,
          fixed.join(' | '));
  }
  const css = strip(read('public/css/site-bundle.css'));
  check(/\.hero-badge--inbox\s*\{[^}]*position\s*:\s*static/.test(css),
        'the in-box badge is in normal flow (position:static), so it cannot collide');
  const anchors = new Set((css.match(/\.hero-badge--(top|mid|bottom)-(left|center|right)/g) || []));
  check(anchors.size === 9, `all nine anchor positions exist (${anchors.size})`);
}

/* ── 6. the shared layout trio is wired through HELPERS, not by name ──────
   CORRECTED 2026-10-06. This section previously asserted that max_width,
   padding_top and padding_bottom were "unexposed orphans scheduled for the
   toggle commit". That was FALSE, and it passed anyway, which is worse than
   failing: it searched for the literal strings `hero.max_width` and
   `hero.padding_top`, which appear nowhere in the project.

   They appear nowhere because BOTH SIDES ARE GENERIC. theme.ejs builds the
   inputs in teSectionLayout(pk, d) as `pk + '.max_width'`, and index.ejs
   reads them in _sectionFrame as `d.padding_top` / `d.max_width`. Every
   homepage section gets them the same way; the hero is not special.

   The damage of the wrong comment was not the green tick, it was the
   instruction it left behind: the next reader would have gone and "wired"
   three fields that are already wired, producing a second writer of the same
   style and a value that silently beats the tuned one.

   So the assertion is now about the WIRING MECHANISM. Match the helper
   definition and the helper call, not a field name that is never written
   out in full. Same lesson as rule 3 at the top of this file: evaluate what
   the code does, do not grep for what you expect it to say. */
{
  const themeRaw = strip(theme);
  const indexRaw = strip(index);

  check(/function teSectionLayout\s*\(\s*pk\s*,/.test(themeRaw),
        'teSectionLayout(pk, d) is the one builder for the shared layout trio');
  for (const f of ['max_width', 'padding_top', 'padding_bottom']) {
    check(new RegExp("pk\\s*\\+\\s*'\\." + f + "'").test(themeRaw),
          `${f} input is built generically as pk + '.${f}'`);
  }
  check(/teSectionLayout\(\s*'hero'\s*,/.test(themeRaw),
        'the hero panel CALLS teSectionLayout, so the trio is exposed for the hero');
  for (const f of ['max_width', 'padding_top', 'padding_bottom']) {
    check(new RegExp('d\\.' + f + '\\b').test(indexRaw),
          `${f} is READ generically as d.${f} in the section frame`);
  }
  /* And the defaults must exist, or the generic read has nothing behind it. */
  for (const f of ['max_width', 'padding_top', 'padding_bottom']) {
    check(hero[f] !== undefined, `hero.${f} has a default ('' = inherit)`);
  }
}

/* ── 7. DEFAULT / MANUAL — the sizing group ──────────────────────────────
   The flag must default ON, the three height writes must sit inside it, and
   turning it off must remove EXACTLY those three declarations and nothing
   else. The third of those is the only one that proves the feature is safe,
   so it is executed rather than pattern-matched. */
{
  check(hero.sizing_manual === true,
        'sizing_manual defaults to TRUE — the heights are already live, so OFF would move the page',
        'got ' + JSON.stringify(hero.sizing_manual));

  const idx = strip(index);
  check(/hero\.sizing_manual\s*!==\s*false/.test(idx),
        "the guard tests `!== false`, so a settings file predating the flag still renders the heights");
  check(!/hero\.sizing_manual\s*===\s*true/.test(idx),
        'the guard is NOT `=== true` (that would drop the heights on every install that has not saved since)');
  /* MATCH THE BUILDER CALL, NOT THE NAME. The first version of this check
     tested for `hero.sizing_manual` anywhere in theme.ejs, and deleting the
     switch left it green — because the name also appears in the editor's own
     JS, in the querySelector that finds the checkbox. Two occurrences, one
     check, false confidence. Caught by the mutation test, which is what it
     is for. */
  check(/teToggle\('hero\.sizing_manual'/.test(strip(theme)),
        'the Theme Editor builds the switch via teToggle (not merely mentions the key)');

  /* The editor must DISABLE the inputs, not merely grey them. A readonly or
     CSS-only treatment still posts, and the off position would then
     overwrite the stored numbers with whatever is on screen. */
  const t = strip(theme);
  /* BOTH ENDS, for the same reason as the check above: renaming the id in
     the markup left `heroSizingGroup` present in getElementById and the
     single-string check stayed green. The wrapper is only useful if the
     markup and the script agree, so assert each side separately. */
  check(/id="heroSizingGroup"/.test(t),
        'the three height inputs are wrapped in a div carrying id="heroSizingGroup"');
  check(/getElementById\('heroSizingGroup'\)/.test(t),
        'the editor script addresses that same id');
  check(/\.disabled\s*=\s*off/.test(t),
        'the group is disabled when off — a disabled input is not posted, which is what preserves the stored value');
  check(!/readOnly\s*=\s*off/i.test(t),
        'readonly is NOT used (readonly still posts and would overwrite the stored numbers)');

  /* EXECUTE the guard both ways, against the server's tuned values. */
  const gi = index.indexOf('if (hero.sizing_manual !== false) {');
  if (gi === -1) { bad('the sizing guard block is liftable from index.ejs'); }
  else {
    let d = 0, end = -1;
    for (let j = index.indexOf('{', gi); j < index.length; j++) {
      if (index[j] === '{') d++;
      else if (index[j] === '}') { d--; if (d === 0) { end = j + 1; break; } }
    }
    const block = index.slice(gi, end);
    const LIVE = { height_vh: 0, min_height_px: 300, max_height_px: 620 };
    const run = manual => {
      const ctx = { hero: Object.assign({}, LIVE, { sizing_manual: manual }), _heroStyle: '' };
      vm.runInNewContext(block, ctx);
      return ctx._heroStyle;
    };
    const on  = run(true);
    const off = run(false);
    const missing = run(undefined);   // key absent, as in a pre-flag settings file

    check(on === 'min-height:300px;max-height:620px;',
          'ON reproduces the live declarations exactly',
          JSON.stringify(on));
    check(off === '', 'OFF writes no height declarations at all', JSON.stringify(off));
    check(missing === on,
          'a settings file with the key MISSING renders identically to ON',
          JSON.stringify(missing));
    /* Nothing but heights may move. Proven by construction: the block is
       lifted whole, so any other declaration it wrote would show up here. */
    check(!/--ov-|content-box|grid-template/.test(on + off),
          'the guard touches heights only — no overlay, box or grid declarations inside it');
  }
}

console.log('\n' + (fails
  ? 'gate_hero_settings: FAILED ' + fails + ' of ' + checks
  : 'gate_hero_settings: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
