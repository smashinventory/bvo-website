#!/usr/bin/env node
'use strict';

/* gate_button_templates.js
 *
 * Button manager, step 2a: the TEMPLATE MODEL and its CSS emission. No
 * editor panel yet - that is 2b - so the only thing this commit can be
 * judged on is whether it reproduces today exactly while making every slot
 * genuinely drivable.
 *
 * FOUR PLACEBOS WERE CAUGHT WRITING THIS, and they are the reason the
 * checks below look the way they do. Each one would have shipped a control
 * that stored a value and changed nothing:
 *
 *   1. Hover border-color emitted unconditionally. The .btn base is
 *      `border:2px solid transparent`, so painting the hover background
 *      onto the border puts a 2px ring on navy, sage, primary and amber
 *      where today there is none.
 *   2. Hover rules with no !important. site4.css declares the hover states
 *      of navy, sage and outline important, and an important declaration
 *      beats a normal one whatever the source order - so the hover controls
 *      would have been dead on exactly the buttons the hero uses.
 *   3. A border control for the four variants whose rules never read
 *      --btn-<key>-border. Only outline's does.
 *   4. (Not fixed, documented) hover_effect 'none' cannot make a legacy
 *      button inert. The emitter can override a declaration, not delete the
 *      stylesheet's.
 *
 * WHAT IS ASSERTED: the five seeded templates emit exactly the declarations
 * the live site renders today; the validator rejects anything that is not a
 * hex, `transparent` or a var() reference; a new template emits a complete
 * rule of its own; and nothing is exposed in the editor yet.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const ROOT = path.join(__dirname, '..');
const bs   = require(path.join(ROOT, 'src/utils/buttonStyles'));

let fails = 0, checks = 0;
const ok  = m => { checks++; console.log('  ok   ' + m); };
const bad = (m,d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c,m,d) => c ? ok(m) : bad(m,d);
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

console.log('\ngate_button_templates — the model emits today, and every slot is live\n');

const svc = read('src/services/themeSettings.js');
const di  = svc.indexOf('const DEFAULTS');
const D   = vm.runInNewContext(
  svc.slice(di, svc.indexOf('\n};', di) + 3).replace(/^const DEFAULTS\s*=/, 'x =') + '\nx;',
  { require: m => require(path.resolve(ROOT, 'src/services', m)) });

const bundle = read('public/css/site-bundle.css');
const vars   = bs.cssVars(D);
const rules  = bs.cssRules(D);

/* ── 1. the seeded five, with today's values ────────────────────────────── */
{
  const t = bs.list(D);
  check(t.length === 5, `five templates are seeded (${t.length})`);
  check(t.map(x => x.key).join(',') === 'navy,sage,primary,amber,outline',
        'the keys are the five existing CSS classes, in order',
        t.map(x => x.key).join(','));

  /* The backgrounds MUST stay var() references. A hex here would freeze them
     and editing Sage in the Theme Editor would stop moving the sage buttons -
     the regression the two token commits were written to avoid. */
  const by = Object.fromEntries(t.map(x => [x.key, x]));
  check(by.navy.bg    === 'var(--navy)',  'Button 1 background still follows --navy');
  check(by.sage.bg    === 'var(--sage)',  'Button 2 background still follows --sage');
  check(by.amber.bg   === 'var(--amber)', 'Button 4 background still follows --amber');
  check(by.outline.fg === 'var(--navy)',  'Button 5 text still follows --navy');
  check(by.outline.bg === 'transparent',  'Button 5 background is transparent');

  /* Amber is 'darken', not 'swap', and that is not a tidy-up waiting to
     happen: the live stylesheet applies filter:brightness(.88) on amber
     hover ON TOP of swapping the background. */
  check(by.amber.hover_effect === 'darken',
        "Button 4 hover is 'darken' — it reproduces the live brightness filter",
        by.amber.hover_effect);
  for (const k of ['navy', 'sage', 'primary', 'outline']) {
    check(by[k].hover_effect === 'swap', `${k} hover is a colour swap, as today`);
  }

  /* Every border is transparent today, which is what makes the border rule
     emit nothing and keeps this commit a no-op. */
  for (const k of ['navy', 'sage', 'primary', 'amber']) {
    check(by[k].border === 'transparent', `${k} border is transparent, as today`);
  }
}

/* ── 2. the emitted variables are the ones the stylesheet reads ─────────── */
{
  for (const name of ['--btn-navy-bg', '--btn-navy-fg', '--btn-navy-hover-bg',
                      '--btn-sage-bg', '--btn-amber-bg', '--btn-amber-hover-bg',
                      '--btn-outline-bg', '--btn-outline-fg', '--btn-outline-border']) {
    check(vars.includes(name + ':'), `${name} is emitted`);
    check(bundle.includes('var(' + name), `${name} is READ by the stylesheet`);
  }
  /* STRIP THE COMMENTS FIRST. The declaration below sits under an EJS
     comment that NAMES both variables in order to explain the difference
     between them, so matching the raw file found the comment and the
     mutation test caught me: deleting the real declaration left the gate
     green. Fourth time today, in four different parsers. */
  const lay = read('views/layouts/main.ejs')
    .replace(/<%#[\s\S]*?%>/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  check(/--btn-radius:/.test(lay),
        'the shared --btn-radius is emitted (the variable .btn actually reads)');
  /* The old field wrote --radius-btn, which only the newsletter reads. It
     stays, because removing it would move those two corners. */
  check(/--radius-btn:/.test(lay),
        '--radius-btn is still emitted for the newsletter rules that read it');
  /* And the blocks themselves must be in the layout, or none of the above
     reaches a page. The gate never asserted this and the mutation test
     found the hole. */
  check(/<%-\s*buttonVars\s*%>/.test(lay),  'the layout emits buttonVars');
  check(/<%-\s*buttonRules\s*%>/.test(lay), 'the layout emits buttonRules');
  const srv = read('src/server.js').replace(/\/\*[\s\S]*?\*\//g, '');
  check(/res\.locals\.buttonVars\s*=/.test(srv) && /res\.locals\.buttonRules\s*=/.test(srv),
        'server.js computes both and puts them in res.locals');
}

/* ── 3. no ring appears on hover ────────────────────────────────────────── */
{
  for (const k of ['navy', 'sage', 'primary']) {
    const rule = (rules.match(new RegExp('\\.btn-' + k + ':hover[^}]*}')) || [''])[0];
    check(rule && !/border-color/.test(rule),
          `${k} hover does NOT set border-color — the base border is transparent`,
          rule);
  }
  const out = (rules.match(/\.btn-outline:hover[^}]*}/) || [''])[0];
  check(/border-color/.test(out),
        'outline hover DOES set border-color — it is the one with a visible border');
}

/* ── 4. the hover rules can actually win ────────────────────────────────── */
{
  /* site4.css declares these important. Without matching, the control is a
     placebo on the three most-used styles. */
  for (const k of ['navy', 'sage', 'outline']) {
    const s4 = read('public/css/site4.css');
    const hasImportant = new RegExp('\\.btn-' + k + ':active[^}]*!important').test(s4) ||
                         new RegExp('\\.btn-' + k + ':active[^}]*!important').test(bundle);
    const mine = (rules.match(new RegExp('\\.btn-' + k + ':hover[^}]*}')) || [''])[0];
    check(!hasImportant || /!important/.test(mine),
          `${k}: the emitted hover rule is important, so it beats the stylesheet's`,
          mine);
  }
}

/* ── 5. a NEW template emits a complete rule ───────────────────────────── */
{
  const one = { buttons: { templates: [{ key:'tpl6', name:'Button 6',
    bg:'#226644', border:'#113322', fg:'#fff',
    hover_bg:'#113322', hover_fg:'#fff', hover_effect:'swap', radius:'20px' }] } };
  const r = bs.cssRules(one);
  check(/\.btn--tpl6\{/.test(r), 'a new template gets a generated .btn--<key> class');
  for (const decl of ['background:var(--btn-tpl6-bg)', 'color:var(--btn-tpl6-fg)',
                      'border-color:var(--btn-tpl6-border)', 'border-radius:var(--btn-tpl6-radius)']) {
    check(r.includes(decl), `the generated rule declares ${decl.split(':')[0]}`);
  }
  check(!/!important/.test(r),
        'a new template needs NO !important — nothing in the stylesheet competes with it');
  check(bs.cssVars(one).includes('--btn-tpl6-radius:20px'),
        'its per-template radius is emitted');
}

/* ── 6. the validator — executed, not described ─────────────────────────── */
{
  const evil = { buttons: { templates: [
    { key:'a', bg:'red;}body{display:none',  fg:'#fff' },
    { key:'b', bg:'url(javascript:alert(1))', fg:'#fff' },
    { key:'c', bg:'rgb(1,2,3)',               fg:'#fff' },   // valid CSS, not allowed
    { key:'BAD KEY',   bg:'#fff' },
    { key:'d', bg:'#abc', radius:'99999px; }' },
    { key:'e', bg:'var(--navy)', hover_effect:'<script>' },
  ] } };
  const got = bs.list(evil);
  const emitted = bs.cssVars(evil) + bs.cssRules(evil);

  check(!/display:none|javascript:|<script/.test(emitted),
        'no injected declaration survives into the emitted CSS');
  check(!emitted.includes('rgb('),
        'rgb() is rejected too — the grammar is hex, transparent, or var() only');
  check(got.every(t => /^[a-z][a-z0-9_-]*$/.test(t.key)),
        'a malformed key drops the whole row rather than emitting an empty selector');
  check(got.length === 5, `five of the six evil rows survive, sanitised (${got.length})`);
  check(bs.normalize({ key:'z', bg:'#abc' }).hover_effect === 'swap',
        'an unknown hover effect falls back to swap');
  check(bs.normalize({ bg:'#abc' }) === null,
        'a row with no usable key normalises to null');
  /* A duplicate key would emit two rules for one class, the exact condition
     the dedupe commits removed from the stylesheet. */
  const dupe = { buttons: { templates: [{ key:'q', bg:'#111' }, { key:'q', bg:'#222' }] } };
  check(bs.list(dupe).length === 1, 'a duplicate key is dropped, not emitted twice');
}

/* ── 7. nothing is exposed yet ──────────────────────────────────────────── */
{
  const thm = read('views/pages/admin/theme.ejs');
  check(!/buttons\.templates/.test(thm),
        'no editor field for the templates yet — the panel is the next commit');
  /* And when it IS exposed, the array needs declaring in adminController or
     deleting a template will not stick. There is a long comment in
     _buildSettingsFromBody about exactly this failure. Asserted now so the
     panel commit cannot forget it. */
  const adm = read('src/controllers/adminController.js');
  const exposed = /buttons\.templates/.test(thm);
  check(!exposed || /ARRAY_PREFIXES[\s\S]{0,400}buttons\.templates\[/.test(adm),
        'if the panel exists, buttons.templates[ is in ARRAY_PREFIXES');
}

console.log('\n' + (fails
  ? 'gate_button_templates: FAILED ' + fails + ' of ' + checks
  : 'gate_button_templates: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
