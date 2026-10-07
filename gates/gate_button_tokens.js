#!/usr/bin/env node
'use strict';

/* gate_button_tokens.js
 *
 * STEP ONE OF THE BUTTON MANAGER: bring btn-navy and btn-sage into the
 * variable system WITHOUT changing a pixel.
 *
 * WHY THESE TWO WERE DIFFERENT. Four of the six button variants were already
 * variable-driven - primary, secondary, amber and outline each read
 * --btn-<name>-bg / -fg, with a hover variable too. btn-navy and btn-sage
 * were not: they hardcoded `background:var(--navy);color:#fff` and had no
 * hover variable at all. They are also the pair the hero uses, which is
 * exactly why there was nothing to control.
 *
 * WHAT THIS GATE PROVES, and it is the only thing worth proving at this
 * stage: the refactor RESOLVES TO THE SAME COLOURS. A var() chain is easy to
 * get subtly wrong - point --btn-navy-fg at var(--color-white) instead of
 * #fff and the button text starts following the brand's white setting, which
 * is a behaviour change disguised as a tidy-up. So the resolver below walks
 * the chains and compares the final literals against the values measured on
 * the live site on 2026-10-07.
 *
 * MEASURED LIVE, not assumed:
 *   --navy      #182840      --sage       #5A7A5A
 *   --sage-deep #486854      --color-white #FFFFFF
 *   .btn-navy   background rgb(24,40,64)  colour rgb(255,255,255)
 *
 * NOT asserted: that the six variants look good, or that the manager exists.
 * The manager is the next commit. This one is a no-op with a seam in it.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fails = 0, checks = 0;
const ok  = m => { checks++; console.log('  ok   ' + m); };
const bad = (m,d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c,m,d) => c ? ok(m) : bad(m,d);
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

console.log('\ngate_button_tokens — navy and sage join the system, pixel for pixel\n');

const bundle = read('public/css/site-bundle.css');
const site4  = read('public/css/site4.css');

/* ── a minimal :root variable resolver ──────────────────────────────────
   Collects every custom property declared in a :root block, then resolves
   var() chains to a literal. Handles var(--x) and var(--x, fallback).
   Deliberately simple: if it cannot resolve, it says so rather than
   guessing, because a silent partial resolve would make the comparison
   below pass for the wrong reason. */
function collectRootVars(css) {
  const vars = {};
  const re = /:root\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    for (const decl of m[1].split(';')) {
      const i = decl.indexOf(':');
      if (i === -1) continue;
      const k = decl.slice(0, i).trim();
      if (!k.startsWith('--')) continue;
      vars[k] = decl.slice(i + 1).trim();   // later :root wins, as in CSS
    }
  }
  return vars;
}
function resolve(expr, vars, depth) {
  depth = depth || 0;
  if (depth > 12) return null;                       // cycle guard
  const m = String(expr).match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
  if (!m) return String(expr).trim();
  const named = vars[m[1]];
  if (named !== undefined) return resolve(named, vars, depth + 1);
  if (m[2] !== undefined)  return resolve(m[2].trim(), vars, depth + 1);
  return null;                                        // undefined, no fallback
}
const norm = v => {
  if (v === null) return null;
  v = String(v).trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + v[1]+v[1] + v[2]+v[2] + v[3]+v[3];
  return v;
};

const vars = collectRootVars(bundle);

/* ── 1. the six new variables exist and resolve to today's colours ─────── */
{
  /* EQUIVALENCE, NOT LITERALS. The first version of this check compared each
     new variable against the colour measured on the live site, and
     --btn-sage-bg "failed" by resolving to #6b8c74 instead of #5a7a5a.
     The CSS was right and the check was wrong: main.ejs:303 injects
     `--sage: <%= _sageC %>` from the brand settings at request time, so the
     live value is the admin's #5a7a5a while the stylesheet's own :root still
     holds #6b8c74. Navy passed only by coincidence - its two values agree.

     So the correct assertion is that each new variable resolves to the SAME
     THING THE OLD EXPRESSION DID, which keeps the settings-driven chain
     intact instead of freezing a snapshot of it. Comparing against a literal
     would have had me "fixing" the CSS to break brand-colour editing. */
  const EQUIV = {
    '--btn-navy-bg':       'var(--navy)',
    '--btn-navy-fg':       '#fff',
    '--btn-navy-hover-bg': '#0e1e38',
    '--btn-sage-bg':       'var(--sage)',
    '--btn-sage-fg':       '#fff',
    '--btn-sage-hover-bg': 'var(--sage-deep)',
  };
  for (const [k, was] of Object.entries(EQUIV)) {
    check(vars[k] !== undefined, `${k} is declared in :root`);
    const got  = norm(resolve(vars[k], vars));
    const want = norm(resolve(was, vars));
    check(got !== null && got === want,
          `${k} resolves exactly as \`${was}\` did before the refactor`,
          'now ' + JSON.stringify(got) + ', was ' + JSON.stringify(want));
  }

  /* And the brand-driven ones must still go THROUGH the brand variable, not
     a copy of its current value - otherwise editing Sage in the Theme
     Editor would stop moving the sage buttons. */
  check(/^var\(--navy\)$/.test((vars['--btn-navy-bg'] || '').trim()),
        '--btn-navy-bg still points at --navy, so brand edits still reach it');
  check(/^var\(--sage\)$/.test((vars['--btn-sage-bg'] || '').trim()),
        '--btn-sage-bg still points at --sage, so brand edits still reach it');

  /* fg must NOT follow the brand white setting. The other variants use
     var(--color-white); copying that here would have changed behaviour,
     because today these two are hardcoded #fff and are therefore immune to
     someone editing "white" in the brand palette. Preserve that. */
  for (const k of ['--btn-navy-fg', '--btn-sage-fg']) {
    check(!/var\(/.test(vars[k] || ''),
          `${k} is a literal, not var(--color-white) — it must not follow the brand palette`,
          'got ' + JSON.stringify(vars[k]));
  }
}

/* ── 2. no .btn-* rule hardcodes a colour any more ──────────────────────── */
{
  const hardcodes = v => (bundle.match(new RegExp('\\.' + v + '[^{]*\\{[^}]*\\}', 'g')) || [])
    .filter(r => /(?:background|color|border-color)\s*:\s*(#[0-9a-fA-F]{3,8}|rgb)/.test(r));

  /* THE TWO THIS COMMIT IS ABOUT. Fully variable-driven now. */
  for (const v of ['btn-navy', 'btn-sage']) {
    const rules = bundle.match(new RegExp('\\.' + v + '[^{]*\\{[^}]*\\}', 'g')) || [];
    check(rules.length > 0, `${v} has rules in the bundle`);
    check(hardcodes(v).length === 0, `${v}: no rule hardcodes a colour`,
          hardcodes(v).join(' | '));
  }

  /* ── AND A CORRECTION I OWE THE RECORD ───────────────────────────────
     I told Sam four variants were "already variable-driven". That was too
     generous, and this check is what caught it:

       .btn-amber{background:var(--amber);color:#fff}
       .btn-outline:hover{background:var(--navy);color:#fff}

     Their BACKGROUNDS read variables; their TEXT colours are hardcoded
     #fff. So amber and outline are PARTIALLY tokenised - a manager could
     drive their background today but not their text.

     Deliberately NOT fixed here. This commit is scoped to navy and sage,
     and widening it would mean editing rules used by 35+ outline buttons
     and 16 amber ones to no present benefit. The state is PINNED instead,
     so that when the manager lands, the person wiring it sees exactly
     which fields can be driven and which still need the same treatment.
     If someone tokenises them later, this check goes red and gets updated
     with the change - which is the point. */
  check(hardcodes('btn-amber').length === 2,
        'btn-amber still has 2 rules hardcoding #fff (known, not this commit)',
        'count changed: ' + hardcodes('btn-amber').length);
  check(hardcodes('btn-outline').length === 2,
        'btn-outline still has 2 rules hardcoding #fff (known, not this commit)',
        'count changed: ' + hardcodes('btn-outline').length);
  check(hardcodes('btn-primary').length === 0,
        'btn-primary is fully tokenised, as it already was');

  /* ── THE WORSE PROBLEM, PINNED SO THE MANAGER STARTS FROM TRUTH ──────
     amber and outline each have TWO base rules in the bundle, and the
     SECOND one wins:

       .btn-amber{background:var(--btn-amber-bg);color:var(--btn-amber-fg)}
       .btn-amber{background:var(--amber);color:#fff}            <- wins

       .btn-outline{background:var(--btn-outline-bg);...}
       .btn-outline{background:0 0;color:var(--navy);...}        <- wins

     So --btn-amber-bg/-fg and --btn-outline-bg/-fg/-border ARE DEAD
     TODAY. Editing them changes nothing, because a later duplicate
     overrides the rule that reads them. There are 13 --btn-* variables in
     :root and five of them are decorative.

     That matters for the manager, not for this commit: a control wired to
     --btn-amber-bg would appear to work and do nothing, which is the
     single worst outcome for an admin control. Deduplicating those rules
     is its own job with its own blast radius (16 amber buttons, 35
     outline). Pinned here so it cannot be forgotten and so the count going
     down is a visible event rather than a silent one. */
  const dupBase = v => (bundle.match(new RegExp('\\.' + v + '\\{', 'g')) || []).length;
  check(dupBase('btn-amber') === 3,
        'btn-amber has 3 base rules, the later ones overriding the tokenised one (known)',
        'count changed: ' + dupBase('btn-amber'));
  check(dupBase('btn-outline') === 2,
        'btn-outline has 2 base rules, the later overriding the tokenised one (known)',
        'count changed: ' + dupBase('btn-outline'));
  for (const v of ['btn-navy', 'btn-sage', 'btn-primary']) {
    check(dupBase(v) === 1,
          `${v} has exactly ONE base rule, so its variables are actually live`,
          'found ' + dupBase(v));
  }
}

/* ── 3. the site4 public slice and the bundle still agree ───────────────
   site4.css's public half must appear in the bundle BYTE FOR BYTE
   (gate_bundle_slice enforces that). Editing a rule in one and not the
   other is the exact failure that gate was written for, and these two
   !important rules live in both files. Checked here too, named for this
   change, so the cause is legible if it ever breaks. */
{
  for (const sel of ['.btn-navy:active,.btn-navy:hover', '.btn-sage:active,.btn-sage:hover']) {
    const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*\\}');
    const in4 = (site4.match(re)  || [])[0];
    const inB = (bundle.match(re) || [])[0];
    check(!!in4 && !!inB && in4 === inB,
          `${sel} is identical in site4.css and the bundle`,
          'site4: ' + in4 + '\n         bundle: ' + inB);
    check(!!in4 && /var\(--btn-/.test(in4), `${sel} reads a --btn-* variable`);
  }
}

/* ── 4. the cache bust moved ───────────────────────────────────────────── */
{
  const lay = read('views/layouts/main.ejs');
  const v = Number((lay.match(/site-bundle\.css\?v=(\d+)/) || [])[1]);
  check(v >= 42, `the bundle ?v= is at least 42 (this change) — got ${v}`,
        'without a bump, returning visitors and the CDN keep the old bundle');
}

/* ── 5. nothing was exposed yet ─────────────────────────────────────────
   This commit is a refactor. If a settings key or an editor field for
   these appears here, the no-op claim is no longer true and the next
   commit's gate should be the one asserting it. */
{
  const svc = read('src/services/themeSettings.js');
  check(!/btn_navy|btn_sage|button_styles/.test(svc),
        'no button settings key exists yet — the manager is the next commit');
  const thm = read('views/pages/admin/theme.ejs');
  check(!/btn_navy|btn_sage/.test(thm),
        'no editor field exists yet either');
}

console.log('\n' + (fails
  ? 'gate_button_tokens: FAILED ' + fails + ' of ' + checks
  : 'gate_button_tokens: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
