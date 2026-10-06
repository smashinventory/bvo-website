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

/* ── 6. the orphans are still orphans, or gone ───────────────────────────── */
{
  /* padding_top / padding_bottom / max_width are defined but unexposed. They
     are scheduled for the toggle commit, not this one. Asserted so that if they
     get wired, it is deliberate and the gate is updated with it. */
  for (const f of ['max_width', 'padding_top', 'padding_bottom']) {
    const exposed = editorFields.has(f), used = readFields.has(f);
    check(!exposed && !used,
          `${f} is still an unexposed orphan (scheduled for the toggle commit)`,
          exposed ? 'now in the editor' : used ? 'now read by the template' : '');
  }
}

console.log('\n' + (fails
  ? 'gate_hero_settings: FAILED ' + fails + ' of ' + checks
  : 'gate_hero_settings: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
