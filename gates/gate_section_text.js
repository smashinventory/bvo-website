#!/usr/bin/env node
'use strict';

/* gate_section_text.js — Wave 2: title and body size + colour per section.
 *
 * WHAT THIS COMMIT HAS TO BE JUDGED ON is that the rendered page does not
 * move. Every section defaults to text_manual:false, _textStyle emits
 * nothing in that state, so every style attribute it writes is empty.
 *
 * THREE THINGS WENT WRONG WHILE BUILDING IT, and they are why the checks
 * below look the way they do:
 *
 *   1. I believed before_after and testimonials already had heading_size
 *      and body_size controls, because `pk+'.heading_size'` appears in
 *      theme.ejs. It does - inside the `pkBase === 'image_with_text'`
 *      branch, which those two never enter. A name appearing in a file is
 *      not a control existing. Had the trimmed group shipped, both would
 *      have READ a setting nothing in the editor could set.
 *
 *   2. Copies (_2.._6) have no DEFAULTS entry, so every field arrives
 *      undefined - and teTextSize renders undefined as 16, teColor as
 *      #000000. Harmless under Auto, but flipping such a copy to Manual
 *      and saving would post 16px black. featured_models_2 is live on the
 *      homepage right now.
 *
 *   3. Seeding the colours blank had the same shape of bug for the BASE
 *      sections: teColor turns '' into #000000.
 *
 * AND THE ONE THAT IS A FEATURE: before_after/testimonials defaults were
 * undefined, so thinForStorage kept whatever their placebo controls
 * posted. Those values are still in the live settings. Auto-by-default is
 * what keeps them inert.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const ROOT = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok  = m => { checks++; console.log('  ok   ' + m); };
const bad = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const read  = r => fs.readFileSync(path.join(ROOT, r), 'utf8');
const strip = s => s.replace(/<%#[\s\S]*?%>/g, '').replace(/<%\/\*[\s\S]*?\*\/%>/g, '');

const IDX = strip(read('views/pages/index.ejs'));
const THM = strip(read('views/pages/admin/theme.ejs'));

const svc = read('src/services/themeSettings.js');
const di  = svc.indexOf('const DEFAULTS');
const D   = vm.runInNewContext(
  svc.slice(di, svc.indexOf('\n};', di) + 3).replace(/^const DEFAULTS\s*=/, 'x =') + '\nx;',
  { require: m => require(path.resolve(ROOT, 'src/services', m)) });

/* The real helper, pulled out of index.ejs and run - not reimplemented, so
   the gate tests the code that ships. */
const grab = n => {
  const i = IDX.indexOf('function ' + n + '(');
  if (i < 0) throw new Error('helper not found in index.ejs: ' + n);
  return IDX.slice(i, IDX.indexOf('\n}', i) + 2);
};
const H = vm.runInNewContext(
  grab('_cssLen') + grab('_cssColor') + grab('_textStyle') + '\n;({ _textStyle: _textStyle })', {});

/* The eight sections carrying the group, and the two measured palettes. */
const DARK  = { h: '#FFFFFF', b: '#FFFFFF' };
const LIGHT = { h: '#182840', b: '#6B717F' };
const SECTIONS = [
  ['categories_section', 36, LIGHT],
  ['featured_section',   36, LIGHT],
  ['featured_models',    36, LIGHT],
  ['before_after',       36, DARK ],
  ['before_after_2',     36, DARK ],
  ['testimonials',       36, LIGHT],
  ['testimonials_2',     36, LIGHT],
  ['sample_banner',      36, LIGHT],
  ['bundle_teaser',      36, LIGHT],
  ['newsletter',         33, DARK ],
];

console.log('\ngate_section_text — Auto is a no-op, Manual starts at today\n');

/* ── 1. the defaults, and the no-op ─────────────────────────────────────── */
console.log('--- defaults ---');
SECTIONS.forEach(([s, size, pal]) => {
  const v = D[s] || {};
  check(v.text_manual === false,
        s + '.text_manual defaults to Auto', 'got ' + JSON.stringify(v.text_manual));
  check(v.heading_size === size && v.heading_color === pal.h,
        s + ' title seeds the measured ' + size + 'px / ' + pal.h,
        JSON.stringify([v.heading_size, v.heading_color]));
  check(v.body_size === 14 && v.body_color === pal.b,
        s + ' body seeds the measured 14px / ' + pal.b,
        JSON.stringify([v.body_size, v.body_color]));
});

console.log('--- the no-op, through the real helper ---');
SECTIONS.forEach(([s]) => {
  const t = H._textStyle(D[s], 'heading_size', 'heading_color');
  const b = H._textStyle(D[s], 'body_size',    'body_color');
  check(t === '' && b === '',
        s + ' emits no style attribute while Auto is on', 'title[' + t + '] body[' + b + ']');
});

/* ── 2. the safety properties of the helper ─────────────────────────────── */
console.log('--- _textStyle behaviour ---');
check(H._textStyle({ heading_size: 72, heading_color: '#ff0000' }, 'heading_size', 'heading_color') === '',
      'a stale stored value is inert while Auto is on - the whole reason the toggle exists');
check(H._textStyle({ text_manual: true, heading_size: 72, heading_color: '#ff0000' },
                   'heading_size', 'heading_color') === 'font-size:72px;color:#ff0000;',
      'and takes effect once Manual is chosen deliberately');
check(H._textStyle({ text_manual: true, heading_size: 0, heading_color: '' },
                   'heading_size', 'heading_color') === '',
      'the 0 sentinel never becomes the real declaration 0px');
check(H._textStyle({ text_manual: undefined, heading_size: 40 }, 'heading_size', 'heading_color') === '',
      'undefined means Auto, not "Manual with blank fields" - a _N copy predating this');
check(H._textStyle({ text_manual: true, heading_size: '40px);color:red' },
                   'heading_size', 'heading_color') === '',
      'a size that is not a plain length is rejected, not interpolated');
check(H._textStyle({ text_manual: true, heading_color: 'red;font-size:99px' },
                   'heading_size', 'heading_color') === '',
      'and so is a colour that carries a second declaration');
check(/if \(d\.text_manual !== true\) return '';/.test(IDX),
      'the gate is === true, so undefined cannot fall through to Manual');

/* ── 3. every call site pairs the right element with the right field ────── */
console.log('--- call sites ---');
const SITES = [
  ['categories title',  /_csTag %> class="section-title" id="<%= _csId %>" style="<%= _textStyle\(_d,'heading_size','heading_color'\)/],
  ['featured title',    /_fsTag %> class="section-title" id="<%= _fsId %>" style="<%= _textStyle\(_d,'heading_size','heading_color'\)/],
  ['models title',      /<h2 class="section-title" id="<%= _fmId %>" style="<%= _textStyle\(_d,'heading_size','heading_color'\)/],
  ['before_after title',/_baTag %> class="section-title" id="ba-heading-<%= sectionKey %>" style="<%= _textStyle\(_d,'heading_size','heading_color'\)/],
  ['testimonials title',/_testTag %> class="section-title" id="test-heading-<%= sectionKey %>" style="<%= _textStyle\(_d,'heading_size','heading_color'\)/],
  ['sample_banner title',/_sbTag %> class="section-title" id="sb-heading" style="<%= _textStyle\(sb_,'heading_size','heading_color'\)/],
  ['bundle_teaser title',/_btTag %> class="section-title" id="bt-heading" style="<%= _textStyle\(bt_,'heading_size','heading_color'\)/],
  ['newsletter heading', /_newsTag %> class="newsletter-heading" id="news-heading" style="<%= _textStyle\(news,'heading_size','heading_color'\)/],
  ['sample_banner sub',  /<p class="section-sub" style="<%= _textStyle\(sb_,'body_size','body_color'\)/],
  ['bundle_teaser sub',  /<p class="section-sub" style="<%= _textStyle\(bt_,'body_size','body_color'\)/],
  ['newsletter sub',     /<p class="newsletter-sub" style="<%= _textStyle\(news,'body_size','body_color'\)/],
];
SITES.forEach(([label, re]) => check(re.test(IDX), label + ' reads its own object and its own field'));

/* sample_banner renders through TWO paths - the overlay variant and the
   plain one - and only one of them was wired the first time a similar
   change went in for buttons. Both, or neither. */
const sbTitles = (IDX.match(/id="sb-heading" style="<%= _textStyle\(sb_,'heading_size'/g) || []).length;
const sbSubs   = (IDX.match(/_textStyle\(sb_,'body_size','body_color'\)/g) || []).length;
check(sbTitles === 2, 'both sample_banner render paths style the title (' + sbTitles + '/2)');
check(sbSubs   === 2, 'both sample_banner render paths style the subtitle (' + sbSubs + '/2)');

/* FIVE generic subtitles, not four. Four share one identical conditional
   line - categories, featured products, before/after, testimonials - and
   featured_models has a fifth that differs only in carrying a default
   string, so it does not match the same literal. I counted the identical
   four, wired all five, and asserted four; the gate caught its own
   expectation rather than the code. Counted at all because replacing a
   subset of identical lines is completely silent in review. */
const genericSubs = (IDX.match(/<p class="section-sub" style="<%= _textStyle\(_d,'body_size','body_color'\)/g) || []).length;
check(genericSubs === 5,
      'all five generic .section-sub call sites are wired (' + genericSubs + '/5)',
      'a partial replace leaves some sections unstyleable and looks identical in review');
check(!/<p class="section-sub"><%=/.test(IDX),
      'no .section-sub is left without a style hook');

/* ── 4. the editor ──────────────────────────────────────────────────────── */
console.log('--- editor ---');
check(/function teTextGroup\(pk, d, base\)/.test(THM),
      'teTextGroup takes the base key, so a copy can fall back to it');
check(/var pick = function \(f\) \{ return \(d\[f\] !== undefined && d\[f\] !== ''\) \? d\[f\] : b\[f\]; \};/.test(THM),
      'and actually uses it - a copy shows the base value, not 16px black');
check(/teToggle\(pk \+ '\.text_manual'[\s\S]{0,80}d\.text_manual === true\)/.test(THM),
      'the toggle reflects === true, matching the template');

[['categories_section'], ['featured_section'], ['featured_models'],
 ['sample_banner'], ['bundle_teaser'], ['newsletter']].forEach(([s]) => {
  const re = new RegExp("teTextGroup\\('" + s + "'[^%]*'" + s + "'\\)");
  check(re.test(THM), s + ' panel emits the group and passes its own base key');
});
check(/\/\^\(before_after\|testimonials\)\/\.test\(pkBase\)/.test(THM),
      'before_after and testimonials get the group from the duplicatable loop');
check(/_DUPL_BASE_HAS_OWN_PANEL\.has\(pkBase\) && pk !== pkBase/.test(THM),
      'and copies of the featured bases do too - excluding the bases, which have their own panel');

/* THE DUPLICATE-NAME CHECK. Two inputs with one name means the last wins
   on POST, so whichever the admin did not touch is the one that counts.
   teTextGroup must not be reachable in the same panel as the branch that
   emits heading_size directly. */
const iwtBranch = THM.slice(THM.indexOf("pkBase === 'image_with_text'"),
                            THM.indexOf("pkBase === 'video_text'"));
check(/teTextSize\(pk\+'\.heading_size'/.test(iwtBranch),
      "image_with_text's own heading_size control is where it always was");
check(!/teTextGroup/.test(iwtBranch),
      'and teTextGroup is not also emitted there, which would double the name');

/* ── 5. lockGroup covers every flag, bases and copies ───────────────────── */
console.log('--- lock wiring ---');
check(/var secs = <%- JSON\.stringify\(TEXT_GROUP_SECTIONS\) %>/.test(THM),
      'the lock list is generated from the same array the panels use');
const listM = THM.match(/var TEXT_GROUP_SECTIONS = \[([\s\S]*?)\];/);
const listed = listM ? (listM[1].match(/'[a-z_0-9]+'/g) || []).map(s => s.replace(/'/g, '')) : [];
['categories_section','featured_section','featured_models','before_after',
 'testimonials','sample_banner','bundle_teaser','newsletter'].forEach(s => {
  check(listed.includes(s), s + ' is in TEXT_GROUP_SECTIONS');
});
check(/lockGroup\(s \+ '\.text_manual',\s*\[s \+ '\.heading_size', s \+ '\.heading_color',\s*s \+ '\.body_size',\s*s \+ '\.body_color'\]\)/.test(THM),
      'and each flag locks all four of its fields');
const dupM = THM.match(/\['before_after', 'testimonials', 'categories_section',\s*'featured_section', 'featured_models'\]\.forEach/);
check(!!dupM, 'the copy sweep covers every base whose copies render a title');

console.log('\n' + (fails
  ? 'gate_section_text: FAILED ' + fails + ' of ' + checks
  : 'gate_section_text: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
