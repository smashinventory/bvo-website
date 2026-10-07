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
  /* ── THE SENTINELS ARE GONE FOR THE TYPOGRAPHY GROUP, 2026-10-07 ─────
     heading_size and subtext_size were sentinel 0, and sub2_color was '',
     on the reasoning that writing no inline style lets the responsive CSS
     rule win. That was right while nothing ever read these in a DEFAULT
     position.

     The Typography switch broke it. OFF means "use the default", so a
     sentinel default meant OFF produced the stylesheet's type instead of
     the tuned type — the hero fell apart the first time Sam tried it. The
     defaults now hold the live values and the template reads from the
     defaults when the switch is off, so DEFAULT means CURRENT.

     The sentinel convention is untouched everywhere else in this file, and
     for the fields outside the two toggle groups. */
  check(hero.heading_size === 20, 'heading_size default is the live 20px, not a sentinel',
        'got ' + JSON.stringify(hero.heading_size));
  check(hero.subtext_size === 16, 'subtext_size default is the live 16px, not a sentinel',
        'got ' + JSON.stringify(hero.subtext_size));
  check(hero.eyebrow_size === 22 && hero.h2_size === 20 && hero.sub2_size === 15,
        'the other three sizes carry their live values too (22 / 20 / 15)');
  for (const [f, v] of [['eyebrow_color','#5A7A5A'], ['heading_color','#182840'],
                        ['h2_color','#926A21'], ['subtext_color','#182840'],
                        ['sub2_color','#926A21']]) {
    check(hero[f] === v, `${f} default is the live ${v}`, 'got ' + JSON.stringify(hero[f]));
  }
  /* Still a truthiness test, so a 0 or a blank writes nothing rather than
     `font-size:0px` or `--hero-h1:;`. */
  for (const f of ['heading_size', 'subtext_size', 'h2_size', 'eyebrow_size', 'sub2_size']) {
    check(new RegExp('\\+_heroT\\.' + f + '\\s*>\\s*0').test(strip(index)),
          `${f} is written only when positive`);
  }
  /* The 11 and 14 comparisons MUST be gone. They meant "don't restate the
     default" and were written when the defaults were 11 and 14. With the
     defaults now 22 and 15 they would suppress the very values they were
     meant to pass through. */
  check(!/eyebrow_size\s*!=\s*11/.test(strip(index)) && !/sub2_size\s*!=\s*14/.test(strip(index)),
        'the stale != 11 / != 14 guards are gone (they would now suppress the tuned sizes)');
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
  /* The wrapper-id checks that used to sit here are GONE, because the
     mechanism changed and a check must describe the mechanism in use. The
     sizing group was originally locked by disabling everything inside a
     container div. That could not work for typography, whose size sliders
     share their rows with the copy fields, so the lock now works from a
     list of field names and all three groups go through it. Asserting a
     container id would now be asserting a leftover. */
  check(/lockGroup\('hero\.sizing_manual'/.test(t),
        'the sizing group goes through the shared lockGroup');
  check(/function lockGroup\s*\(/.test(t),
        'there is ONE locker for every group, not one per group');
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

/* ── 8. the other two groups, same rules ─────────────────────────────────
   Typography and Content Box, added 2026-10-07. Every assertion that
   applied to sizing applies to these, so they are checked in a loop rather
   than written out three times - if the rule changes it changes once. */
{
  const idx = strip(index), t = strip(theme);

  /* ── THE POINT OF THE WHOLE EXERCISE, asserted below by execution ─────
     AUTO MUST REPRODUCE THE CURRENT STATE. Sam's objective, his words: so
     that a seasonal or promotional change can be undone by flipping one
     switch back, with no need to remember what the numbers were.

     The first cut failed this. OFF wrote nothing, the browser fell back to
     the stylesheet, and the stylesheet still described the hero as it
     looked before it was tuned. Flipping to Auto produced a hero nobody
     wanted - the opposite of a safe return path. */
  for (const flag of ['typography_manual', 'content_box_manual']) {
    check(hero[flag] === true,
          `${flag} defaults to TRUE — the values it governs are already live`,
          'got ' + JSON.stringify(hero[flag]));
    check(new RegExp('hero\\.' + flag + '\\s*!==\\s*false').test(idx),
          `${flag} is read as !== false, so a pre-flag settings file still renders`);
    check(new RegExp("teToggle\\('hero\\." + flag + "'").test(t),
          `${flag} has a switch built by teToggle in the editor`);
    check(new RegExp("lockGroup\\('hero\\." + flag + "'").test(t),
          `${flag} is wired to the shared lockGroup`);
  }

  /* THE COPY MUST STAY EDITABLE. A typography switch that greys out the
     headline would be a different feature, and a nastier one. Asserted by
     name: none of the content fields may appear in any lockGroup list. */
  const lists = [...t.matchAll(/lockGroup\('hero\.[a-z_]+',\s*(\[[^\]]*\])/g)].map(m => m[1]);
  check(lists.length === 3, `all three groups declare a field list (${lists.length})`);
  const governed = lists.join(' ');
  for (const copy of ['hero.eyebrow\'', 'hero.heading_line1', 'hero.heading_line2',
                      'hero.subtext\'', 'hero.sub2_text', 'hero.cta1_text',
                      'hero.cta2_text', 'hero.cta1_url', 'hero.cta2_url']) {
    check(!governed.includes(copy),
          `${copy.replace(/'$/, '')} is NOT governed by any switch — text is content, not styling`);
  }

  /* ── AUTO REPRODUCES CURRENT, PROVEN BY EXECUTION ─────────────────────
     The whole hero var region is lifted and run three ways against the
     server's stored values: both switches on, typography off, box off.
     All three must produce an identical inline style and identical inline
     font sizes. That is the safe return path Sam asked for, and it is the
     only check here that would have caught the first cut being wrong. */
  {
    const a = index.indexOf('var _heroDef'), b = index.indexOf('var _ctaAlign');
    if (a === -1 || b === -1 || b < a) bad('the hero var region is liftable');
    else {
      const block = index.slice(a, b);
      const STORED = {
        heading_size:20, subtext_size:16, h2_size:20, eyebrow_size:22, sub2_size:15,
        eyebrow_color:'#5A7A5A', heading_color:'#182840', h2_color:'#926A21',
        subtext_color:'#182840', sub2_color:'#926A21',
        content_box_color:'#ffffff', content_box_opacity:70, content_box_padding:12,
        content_box_radius:6, content_max_width:320, content_v_offset:4, content_h_offset:3,
        layout:'bg', overlay_color:'#ffffff', overlay_opacity:0,
        min_height_px:300, max_height_px:620
      };
      const run = flags => {
        const ctx = { hero: Object.assign({}, STORED, flags), themeDefaults: DEFAULTS,
                      _heroStyle:'', _heroLayout:'bg', _heroAlign:'center' };
        vm.runInNewContext(block, ctx);
        return ctx._heroStyle + '||' +
               [ctx._heroHSize, ctx._heroSSize, ctx._heroH2Size, ctx._heroESize, ctx._heroS2Size].join('');
      };
      const on = run({});
      check(run({ typography_manual: false }) === on,
            'TYPOGRAPHY AUTO reproduces the current state exactly');
      check(run({ content_box_manual: false }) === on,
            'CONTENT BOX AUTO reproduces the current state exactly');
      check(run({ typography_manual: false, content_box_manual: false }) === on,
            'both on Auto together still reproduce the current state');
      /* And the current state is the live one, not merely self-consistent. */
      check(on.includes('--content-box-bg:rgba(255,255,255,0.70);') &&
            on.includes('--content-max-w:320px;') &&
            on.includes('--hero-h1:#182840;') &&
            on.includes('font-size:20px;'),
            'the reproduced state is the LIVE hero (white 70% box, 320px, navy h1, 20px)');
    }
  }

  /* The companion controls must be locked too. Both are unnamed, so a lock
     that only matched the named input would leave the number box typeable
     and the colour swatches clickable, each of which writes back into the
     named field through the sync handlers. */
  check(/te4-slider-num/.test(t.slice(t.indexOf('function lockGroup'))),
        'lockGroup also disables the unnamed .te4-slider-num companion');
  /* TWO checks, because the colour controls are reached two different ways
     and breaking either one leaves clickable controls behind. A single
     check on the string 'te4-color-swatch' stayed green when the first
     mechanism was removed, because the second mentions the same class —
     the mutation test found that. Same trap as the two checks above it. */
  const locker = t.slice(t.indexOf('function lockGroup'));
  /* Anchored on the CALL, not on the two class names appearing somewhere
     after lockGroup. The looser version matched the brand-swatch click
     handlers further down the file, which mention .te4-bs for their own
     reasons — so removing the sweep left it green. Third time today that a
     check matched a string living in two places. */
  check(/querySelectorAll\('\.te4-color-swatch, \.te4-bs'\)/.test(locker),
        'lockGroup sweeps the whole .te4-color-field, catching the brand swatch buttons');
  check(/te4-color-swatch\[data-for=/.test(locker),
        'lockGroup also catches a colour swatch by its data-for attribute');

  /* Image & Media deliberately has NO switch: nothing in the stylesheet
     supplies a hero photo, so an off position would just blank the hero. */
  check(!/teToggle\('hero\.(media|image)_manual'/.test(t),
        'Image & Media has no Default/Manual switch — there is no stylesheet fallback to hand an image back to');
  check(hero.media_manual === undefined && hero.image_manual === undefined,
        'and no stray default was added for one');

  /* badge_size must not be swept into typography — the badge owns its own
     switch, and two switches governing one field is how a control ends up
     doing nothing for reasons nobody can find. */
  check(!governed.includes('hero.badge_size'),
        'badge_size stays with the badge, out of the typography group');
  /* The mechanism changed from `_typeMan && hero.x` to `_heroT.x`, where
     _heroT is the settings object or the defaults. So the check is that
     badge_size is NOT read through _heroT — it keeps reading hero directly,
     because the badge owns its own switch. */
  check(/_heroT\./.test(idx), 'the typography group reads through _heroT');

  /* THE PLUMBING, both ends. The gate lifts DEFAULTS by parsing the service
     file, so it cannot notice that the module stopped EXPORTING them — and
     without the export the template's `themeDefaults` is undefined, the
     fallback kicks in, and Auto silently becomes a no-op. Caught by
     mutation; asserted here at both ends of the wire. */
  check(/DEFAULTS:\s*Object\.freeze\(DEFAULTS\)/.test(strip(svc)),
        'themeSettings exports DEFAULTS, frozen');
  const server = strip(read('src/server.js'));
  check(/res\.locals\.themeDefaults\s*=\s*themeSettings\.DEFAULTS/.test(server),
        'server.js puts the defaults in res.locals as themeDefaults');
  check(/typeof themeDefaults !== 'undefined'/.test(idx),
        'the template guards against themeDefaults being absent rather than throwing');
  check(!/_heroT\.badge_size/.test(idx) && /hero\.badge_size/.test(idx),
        'badge_size still reads hero directly, outside the typography group');
}

console.log('\n' + (fails
  ? 'gate_hero_settings: FAILED ' + fails + ' of ' + checks
  : 'gate_hero_settings: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
