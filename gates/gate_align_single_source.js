#!/usr/bin/env node
'use strict';

/* gate_align_single_source.js
 *
 * ONE alignment control per Theme Editor panel.
 *
 * THE BUG THIS EXISTS FOR: teSectionLayout was added on 2026-10-04 to give
 * every section the same four layout controls. Eleven panels already had an
 * alignment control of their own, so those panels ended up rendering TWO
 * <input name="<section>.text_align"> inside one form. The browser posts
 * both. The admin sees and clicks the first; the second still holds the old
 * value and, being later in the form, is the one that lands.
 *
 * The symptom is a control that silently does nothing. Confirmed live on
 * image_with_text: set to Left, saved, page stayed centered - and the
 * centering only LOOKED like a paragraph problem because .iwt-text-col is a
 * column flexbox, so the short children hug their text and only the wide
 * paragraph shows the centering.
 *
 * This is the same defect class as the duplicate-name hazard guarded in
 * gate_section_text.js. That one checked a control I was adding; this one
 * had been shipping for three days.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok   = m => { checks++; console.log('  ok   ' + m); };
const bad  = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);

const RAW = fs.readFileSync(path.join(ROOT, 'views/pages/admin/theme.ejs'), 'utf8');
/* Comments must go first: the explanation above teSectionLayout quotes the
   very call it is documenting, and a check that just greps the file would
   read that quotation as a live emitter. */
const THM = RAW.replace(/<%#[\s\S]*?%>/g, '')
               .replace(/<%\/\*[\s\S]*?\*\/%>/g, '')
               .replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\ngate_align_single_source — one alignment control per panel\n');

/* ── 1. the shared helper must not emit it ──────────────────────────────── */
const fn = THM.slice(THM.indexOf('function teSectionLayout('),
                     THM.indexOf('\n}', THM.indexOf('function teSectionLayout(')));
check(!/text_align/.test(fn),
      'teSectionLayout no longer emits an alignment control',
      'it is called by 12 panels, most of which have their own');
/* COUNT THE CALLS, do not grep for the field names. Commenting the three
   lines out leaves every name still present in the source, so the name
   test passed on a teSectionLayout that emitted nothing - caught by the
   mutation harness, not by review. */
const emittedFields = (fn.match(/h \+= teField\(/g) || []).length;
check(emittedFields === 3,
      'and still emits the other three layout controls (' + emittedFields + '/3)');
check(/'\.max_width'/.test(fn) && /'\.padding_top'/.test(fn) && /'\.padding_bottom'/.test(fn),
      'and they are still max_width, padding_top and padding_bottom');

/* ── 2. exactly one emitter per section ─────────────────────────────────── */
/* Two shapes count as an emitter: a teAlignment(...) call, and a raw
   <select name="X.text_align"> (sample_banner hand-rolls its own). */
const emitters = [];
for (const m of THM.matchAll(/teAlignment\(\s*([^,]+?)\s*,/g)) emitters.push(m[1].trim());
for (const m of THM.matchAll(/name="([a-z_0-9]+)\.text_align"/g)) emitters.push("'" + m[1] + ".text_align'");

/* literal 'section.text_align' -> the section name; pk+'.text_align' -> the
   branch it sits in, resolved by the nearest preceding pkBase test. */
const perSection = {};
emitters.forEach(e => {
  const lit = e.match(/^'([a-z_0-9]+)\.text_align'$/);
  if (lit) { perSection[lit[1]] = (perSection[lit[1]] || 0) + 1; }
});
const dupes = Object.entries(perSection).filter(([, n]) => n > 1);
check(dupes.length === 0,
      'no section emits a literal alignment control twice',
      dupes.map(([k, n]) => k + ' x' + n).join(', '));

/* the pk-based ones: one per branch, and no branch may have two */
const branchRe = /pkBase === '([a-z_]+)'/g;
const branches = [...THM.matchAll(branchRe)].map(m => ({ name: m[1], at: m.index }));
branches.forEach((b, i) => {
  const end  = i + 1 < branches.length ? branches[i + 1].at : THM.length;
  const body = THM.slice(b.at, end);
  const n = (body.match(/teAlignment\(pk\s*\+\s*'\.text_align'/g) || []).length;
  check(n <= 1, 'the ' + b.name + ' branch emits at most one alignment control (' + n + ')');
});

/* ── 3. every section that renders alignment still HAS a control ────────── */
/* Dropping it from teSectionLayout would otherwise have silently removed
   the only control from six panels. */
const MUST_HAVE_LITERAL = ['scrolling_ticker', 'brand_logos', 'value_bar',
                           'bundle_teaser', 'hero', 'hero_mobile',
                           'sample_banner', 'newsletter'];
MUST_HAVE_LITERAL.forEach(k => {
  check(perSection[k] === 1,
        k + ' has exactly one alignment control (' + (perSection[k] || 0) + ')');
});
['image_with_text', 'video_text', 'before_after', 'trust_band',
 'parallax', 'testimonials'].forEach(name => {
  const b = branches.find(x => x.name === name);
  if (!b) { bad(name + ' branch not found'); return; }
  const i    = branches.indexOf(b);
  const end  = i + 1 < branches.length ? branches[i + 1].at : THM.length;
  const body = THM.slice(b.at, end);
  check(/teAlignment\(pk\s*\+\s*'\.text_align'/.test(body),
        name + ' keeps an alignment control of its own');
});
/* the three featured bases and every copy get theirs from teFeaturedBody */
const fb = THM.slice(THM.indexOf('function teFeaturedBody('),
                     THM.indexOf('\n}', THM.indexOf('function teFeaturedBody(')));
check((fb.match(/teAlignment\(pk\+'\.text_align'/g) || []).length === 1,
      'teFeaturedBody emits exactly one - it serves categories, featured products, featured models and all copies');

/* ── 4. the six new defaults say what the page actually renders ─────────── */
/* Measured live at 1440px on 2026-10-07, except brand_logos, which is
   disabled and so was taken from .brand-logos-eyebrow{text-align:center}. */
[['scrolling_ticker', 'left'], ['brand_logos', 'center'],
 ['value_bar', 'center'], ['bundle_teaser', 'left']].forEach(([k, v]) => {
  const re = new RegExp("teAlignment\\('" + k + "\\.text_align'[^%]*?'" + v + "'");
  check(re.test(THM), k + " seeds its control with the '" + v + "' it renders today");
});
check(/pkBase === 'video_text'[\s\S]{0,400}?teAlignment\(pk\+'\.text_align', d\.text_align \|\| 'left'\)/.test(THM),
      "video_text seeds 'left', which is what it renders today");
check(/pkBase === 'trust_band'[\s\S]{0,400}?teAlignment\(pk\+'\.text_align', d\.text_align \|\| 'center'\)/.test(THM),
      "trust_band seeds 'center', which is what it renders today");

console.log('\n' + (fails
  ? 'gate_align_single_source: FAILED ' + fails + ' of ' + checks
  : 'gate_align_single_source: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
