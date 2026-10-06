#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_filter_form_action.js — the filter form's action stays scoped

   A GET form with no action submits to the current path. On a filter landing
   page the path IS the filter, and pathToFilter re-applies it after the form
   is read — so unchecking the box did nothing. An action pointing at the bare
   collection makes the form the only source of filter state.

   It is applied ONLY on landing pages. /collections/vanity-models/<brand>/
   <model> survives purely by inheriting its path: `model` is not a hidden
   input in either form. Widening this drops the model on the first filter
   click, which is a worse bug than the one it fixes.

   This gate exists to stop someone "finishing the job".
   See docs/rollbacks/ROLLBACK_filter_form_action.md
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

const view = read('views/pages/collection.ejs');

/* A naive /<form[^>]*>/ truncates at the `>` inside an EJS `%>` — which is
   exactly where the conditional action lives, so the first version of this
   gate reported "no action" against code that has one. Scan to the first `>`
   that is OUTSIDE an EJS tag. */
function formTag(src, id) {
  const at = src.indexOf(`id="${id}"`);
  if (at < 0) return '';
  const start = src.lastIndexOf('<form', at);
  if (start < 0) return '';
  let inEjs = false;
  for (let i = start; i < src.length; i++) {
    if (!inEjs && src.startsWith('<%', i)) { inEjs = true; i++; continue; }
    if (inEjs  && src.startsWith('%>', i)) { inEjs = false; i++; continue; }
    if (!inEjs && src[i] === '>') return src.slice(start, i + 1);
  }
  return '';
}

const tag = formTag(view, 'filter-form');

console.log('--- the filter form ---');

ok('the #filter-form tag is findable', !!tag, 'markup changed shape');

ok('it has an action',
   /action=/.test(tag),
   'without one the form submits to the current path, and on a landing page '
   + 'the path is the filter — unchecking the box does nothing');

ok('the action is CONDITIONAL on landing',
   /if\s*\([^)]*landing[^)]*\)[\s\S]*action=/.test(tag),
   'an unconditional action drops the model on /vanity-models/<brand>/<model>, '
   + 'where `model` is not a hidden input and survives only via the path');

ok('the action points at a bare collection, never a filtered path',
   /action="\/collections\/<%=\s*category\.slug\s*%>"/.test(tag)
     && !/action="[^"]*\/(style|size|color)\//.test(tag),
   'pointing it at a filtered path reintroduces exactly the bug');

/* The dependency this is scoped around. If someone later adds `model` as a
   hidden input to #filter-form, the conditional CAN be widened — and this
   assertion is where they will find out. */
const filterFormBlock = view.slice(view.indexOf(tag), view.indexOf('</form>', view.indexOf(tag)));
ok('model is still NOT a hidden input (the reason for the scoping)',
   !/name="model"/.test(filterFormBlock),
   'model is now carried by the form — the landing-only scoping can be '
   + 'revisited, see ROLLBACK_filter_form_action.md');

console.log('\n--- the sort form is deliberately untouched ---');
const sortTag = formTag(view, 'sort-form');
ok('the #sort-form tag is findable', !!sortTag);
ok('#sort-form still has no action',
   !!sortTag && !/action=/.test(sortTag),
   'it was left alone on purpose; changing it is a separate piece of work '
   + 'with its own verification');

if (fail) { console.log(`\n*** ${fail} GATE(S) FAILED ***`); process.exit(1); }
console.log('\nall filter-form action gates pass');
