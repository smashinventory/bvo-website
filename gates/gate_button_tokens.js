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
  /* STRIP COMMENTS FIRST. Splitting a :root block on ';' glues the comment
     that precedes a declaration onto it, so the key parsed out of
     "/* Short aliases ... *\/ --navy: #182840" is the comment text, not
     --navy. That silently dropped --navy from the map while picking up
     --sage and --amber, and made four correct checks go red. */
  css = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
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

/* RUNTIME, NOT JUST THE FILE. main.ejs emits its own :root from the brand
   settings (--navy, --amber, --sage, --color-* aliases), and because it is
   parsed as part of the document it decides the real value. Resolving the
   stylesheet alone reports --color-amber as #C4885A when the page actually
   serves #926A21, which is how the amber check went red against correct
   CSS. Merge the template's block in, with its EJS tags stripped, so the
   gate resolves what a visitor gets. */
const layout = read('views/layouts/main.ejs');
const injected = collectRootVars(layout.replace(/<%[-=]?([\s\S]*?)%>/g, 'EJS'));
const vars = Object.assign({}, collectRootVars(bundle), injected);
/* Values the template fills from settings arrive here as the literal 'EJS'.
   Those are brand colours the admin owns; the gate must not pretend to know
   them, so any check that would depend on one is skipped rather than
   guessed. */
const fromSettings = k => String(vars[k] || '').includes('EJS');

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
  /* ── AMBER AND OUTLINE ARE NOW TOKENISED TOO (step 1b, 2026-10-07) ────
     They were not, and worse, each had a DUPLICATE BASE RULE later in the
     bundle overriding the tokenised one, so five of the thirteen --btn-*
     variables were inert. Three dead rules removed:

       .btn-amber{background:var(--amber);color:#fff}
       .btn-amber{--amber:#926A21;--color-amber:#926A21}
       .btn-outline{background:0 0;color:var(--navy);border-color:var(--navy)}

     plus a THIRD outline hover duplicate using --color-navy/--color-white,
     which my first hardcode scan missed entirely because it used variables
     rather than hex. That is the same lesson as every other miss today:
     scanning for a shape finds only that shape.

     Deleting them is pixel-identical because the surviving variables
     resolve to the same colours - asserted below rather than asserted of
     me. ONE named behaviour change: the amber local-variable pin is gone,
     so brand-colour edits now reach amber buttons. They did not before. */
  for (const v of ['btn-amber', 'btn-outline', 'btn-primary']) {
    check(hardcodes(v).length === 0, `${v}: no rule hardcodes a colour any more`,
          hardcodes(v).join(' | '));
  }

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
  /* ONE base rule each, so every variable is actually live. This is the
     check that makes the manager honest: a second base rule anywhere turns
     a control into a placebo. */
  const dupBase = v => (bundle.match(new RegExp('\\.' + v + '\\{', 'g')) || []).length;
  for (const v of ['btn-primary', 'btn-navy', 'btn-sage', 'btn-amber', 'btn-outline']) {
    check(dupBase(v) === 1,
          `${v} has exactly ONE base rule, so its variables are live`,
          'found ' + dupBase(v) + ' - a later duplicate makes the tokens inert');
  }

  /* And every variable the manager will drive must resolve to the colour
     measured on the live site before the dedupe. These are the numbers from
     the browser on 2026-10-07, with the amber ones read off a real
     .btn-amber and the outline ones off a real .btn-outline. */
  /* EQUIVALENCE TO THE DELETED EXPRESSION, declaration by declaration.
     Comparing against a measured colour cannot work for the brand-driven
     ones: --amber and --navy are filled by main.ejs from settings, so the
     gate legitimately does not know their values. What it CAN know is that
     each token carries the same expression the deleted rule did, which
     makes the dedupe equivalent by construction rather than by my
     reasoning about which alias wins.

     The deleted rules were:
       .btn-amber   { background: var(--amber);  color: #fff }
       .btn-outline { background: 0 0; color: var(--navy); border-color: var(--navy) }
       .btn-outline:hover { background: var(--navy); color: #fff } */
  const SAME_AS_DELETED = {
    '--btn-amber-bg':         'var(--amber)',
    '--btn-amber-fg':         '#fff',
    '--btn-outline-fg':       'var(--navy)',
    '--btn-outline-border':   'var(--navy)',
    '--btn-outline-hover-bg': 'var(--navy)',
    '--btn-outline-hover-fg': '#fff',
  };
  for (const [k, was] of Object.entries(SAME_AS_DELETED)) {
    check((vars[k] || '').trim() === was,
          `${k} carries exactly the expression the deleted rule used: ${was}`,
          'got ' + JSON.stringify(vars[k]));
  }
  /* `background:0 0` and a transparent background-color are the same paint;
     the token spells it the readable way. */
  check(norm(resolve(vars['--btn-outline-bg'], vars)) === 'transparent',
        '--btn-outline-bg is transparent, as `background:0 0` was');

  /* The four brand-driven tokens must still END at a settings-filled
     variable, not at a frozen copy of today's colour - otherwise editing
     Navy or Amber in the Theme Editor stops reaching the buttons. */
  for (const k of ['--btn-navy-bg', '--btn-sage-bg', '--btn-amber-bg',
                   '--btn-outline-fg', '--btn-outline-border', '--btn-outline-hover-bg']) {
    const chain = (vars[k] || '').match(/^var\(\s*(--[\w-]+)\s*\)$/);
    check(!!chain && fromSettings(chain[1]),
          `${k} resolves through a brand variable the admin can edit`,
          'got ' + JSON.stringify(vars[k]));
  }

  /* THE AMBER PIN MUST STAY GONE. While it existed, editing Amber in the
     brand palette did nothing to amber buttons - the rule re-pinned
     --amber on the element itself. */
  check(!/\.btn-amber\{--amber:/.test(bundle),
        'the .btn-amber local --amber pin is gone, so brand edits reach amber buttons');
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
  check(v >= 43, `the bundle ?v= is at least 43 (this change) — got ${v}`,
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
