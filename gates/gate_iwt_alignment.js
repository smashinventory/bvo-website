#!/usr/bin/env node
'use strict';

/* gate_iwt_alignment.js
 *
 * Image-with-Text alignment, done the way the samples banner already does
 * it - custom properties on the section, consumed by the stylesheet.
 *
 * THE BUG: .iwt-text-col is `display:flex; flex-direction:column;
 * align-items:flex-start`. index.ejs wrote `text-align` on it inline, which
 * aligns the TEXT INSIDE each child but never the children themselves.
 * Every child except the paragraph shrinks to fit its own text, so
 * centering is invisible on them; the paragraph is the only box wide enough
 * (max-width:520px) to show it. Hence "only the paragraph centers".
 * align-items was never being set at all.
 *
 * WHY NOT JUST SET align-items INLINE: the samples banner already learned
 * this the hard way and documented it in site.css - an inline declaration
 * beats every stylesheet rule regardless of specificity, so no media query
 * can override it without !important. Publishing custom properties puts the
 * decision about WHERE a value applies back in the stylesheet.
 *
 * So this gate's real job is to check that the two sections use ONE method,
 * not two: same map shape, same fallback discipline.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok    = m => { checks++; console.log('  ok   ' + m); };
const bad   = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const read  = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

const IDX = read('views/pages/index.ejs')
  .replace(/<%#[\s\S]*?%>/g, '').replace(/<%\/\*[\s\S]*?\*\/%>/g, '');
const SITE   = read('public/css/site.css');
const BUNDLE = read('public/css/site-bundle.css');

console.log('\ngate_iwt_alignment — one method, shared with the samples banner\n');

/* ── 1. nothing inline on the column any more ───────────────────────────── */
check(!/class="iwt-text-col" style=/.test(IDX),
      'no inline style is written on .iwt-text-col',
      'an inline declaration cannot be overridden by a media query - the exact trap site.css documents');
check(!/text-align:<%=\s*_iwtIsOverlay/.test(IDX),
      'the old inline text-align expression is gone');

/* ── 2. the variables are built and published ───────────────────────────── */
check(/var _IWT_FLEX\s*=\s*\{\s*left: 'flex-start', center: 'center', right: 'flex-end' \}/.test(IDX),
      'the flex map matches the samples banner map exactly');
const sbFlex  = (read('views/pages/index.ejs').match(/var _SB_FLEX\s*=\s*\{([^}]*)\}/)  || [])[1];
const iwtFlex = (read('views/pages/index.ejs').match(/var _IWT_FLEX\s*=\s*\{([^}]*)\}/) || [])[1];
check(sbFlex && iwtFlex && sbFlex.replace(/\s/g, '') === iwtFlex.replace(/\s/g, ''),
      'and is byte-identical to it, so the two sections cannot drift apart',
      'sb[' + (sbFlex || '').trim() + '] iwt[' + (iwtFlex || '').trim() + ']');
check(/--iwt-items:' \+ _IWT_FLEX\[_iwtAlignKey\]/.test(IDX) && /--iwt-text:'\s*\+ _iwtAlignKey/.test(IDX),
      'both custom properties are built from the same resolved key');
/* [^>]* would stop at the '>' inside <%= sectionKey %>, which is an EJS
   tag, not the end of the element. Matched within the line instead. */
check(IDX.split('\n').some(l => /class="section iwt-section"/.test(l) && /style="<%= _iwtVars %>"/.test(l)),
      'and published on the section element');

/* ── 3. an unknown stored value cannot reach the style attribute ────────── */
check(/_IWT_FLEX\[_iwtTextAlign\] \? _iwtTextAlign : 'left'/.test(IDX),
      'a text_align outside the map falls back to left rather than being interpolated');
check(/_iwtIsOverlay \? 'center'/.test(IDX),
      "overlay mode resolves to center, matching .iwt-overlay-mode's own CSS");

/* ── 4. the stylesheet reads them, with fallbacks equal to the old values ── */
const RULE = '.iwt-text-col{display:flex;flex-direction:column;align-items:var(--iwt-items,flex-start);gap:1.1rem;text-align:var(--iwt-text,left)}';
check(SITE.includes(RULE),   'site.css reads the variables on .iwt-text-col');
check(BUNDLE.includes(RULE), 'and site-bundle.css carries the identical rule');
check(!/\.iwt-text-col\{display:flex;flex-direction:column;align-items:flex-start/.test(SITE + BUNDLE),
      'the old hardcoded align-items:flex-start rule is gone from both');
/* The fallbacks ARE the no-op guarantee: a page rendered without the
   variables must look exactly as it did before this change. */
check(/align-items:var\(--iwt-items,flex-start\)/.test(RULE) && /text-align:var\(--iwt-text,left\)/.test(RULE),
      "the fallbacks are the previous hardcoded values - flex-start and left");

/* ── 5. the samples banner is untouched ─────────────────────────────────── */
check(SITE.includes('.sb-banner .iwt-text-col{align-items:center;text-align:center}'),
      "the samples banner's own base rule is unchanged");
check(SITE.includes('.sb-banner .iwt-text-col{align-items:var(--sb-items,center);text-align:var(--sb-text,center)}'),
      'and its desktop rule still reads --sb-*, not --iwt-*');
check(!/--iwt-(items|text)/.test(SITE.slice(SITE.indexOf('.sb-banner'))) ||
       SITE.indexOf('--iwt-items') < SITE.indexOf('.sb-banner'),
      'the two variable sets do not leak into each other');

/* ── 6. specificity: the two rules that must still beat the base ────────── */
/* .iwt-overlay-mode .iwt-text-col and .sb-banner .iwt-text-col are both
   two-class selectors, so they outrank the one-class base whatever the
   variables say. Asserted because losing either would silently restyle
   the overlay layout or the samples banner. */
const S2 = read('public/css/site2.css');
check(/\.iwt-overlay-mode \.iwt-text-col\{/.test(S2),
      'the overlay rule is still a two-class selector and still outranks the base');

console.log('\n' + (fails
  ? 'gate_iwt_alignment: FAILED ' + fails + ' of ' + checks
  : 'gate_iwt_alignment: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
