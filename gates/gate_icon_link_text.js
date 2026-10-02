#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_icon_link_text.js — the three icon links in the header carry real
   text, not an aria-label.

   WHY THIS NEEDS A GATE AT ALL
   The change is invisible. Nothing moves on screen, nothing moves for a
   screen reader. The only observable difference is in a crawler's view of
   the HTML, which nobody checks. So the obvious "tidy-up" — putting the
   aria-label back because it reads cleaner — silently undoes it and no one
   notices until the next report.

   TWO FAILURE MODES, BOTH SILENT:

   1. aria-label comes back ALONGSIDE the span. The accessible name is then
      the aria-label and the span is never announced — two labels, one dead,
      free to drift apart. Asserted: these links have NO aria-label.

   2. .sr-only becomes display:none. Clipped text is read by crawlers and
      announced by assistive tech; display:none text is neither. The link
      looks identical and the warning comes straight back.

   Run:  node gates/gate_icon_link_text.js
   Exit: 0 = pass, 1 = fail
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const strip = (s) => s.replace(/<%\/\*[\s\S]*?\*\/%>/g, '').replace(/<!--[\s\S]*?-->/g, '');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

const header = strip(read('views/partials/header.ejs'));
const bundle = read('public/css/site-bundle.css');

/* Slice each link out of the markup so assertions are scoped to it and
   cannot be satisfied by some other link elsewhere in the header. */
const linkBlock = (href) => {
  const i = header.indexOf(`<a href="${href}" class="nav-icon-btn`);
  if (i < 0) return null;
  const j = header.indexOf('</a>', i);
  return j < 0 ? null : header.slice(i, j);
};

const LINKS = [
  { href: '/account',           label: 'My account'    },
  { href: '/account/favorites', label: 'Saved items'   },
  { href: '/cart',              label: 'Shopping cart' },
];

console.log('--- each icon link carries real text ---');
for (const { href, label } of LINKS) {
  const b = linkBlock(href);
  ok(`${href}: the link was found`, !!b);
  if (!b) continue;

  ok(`${href}: has an .sr-only label`, /<span class="sr-only">/.test(b),
     'a crawler reads link text and does not count aria-label');
  ok(`${href}: the label reads "${label}…"`, b.includes(label));

  /* Failure mode 1. */
  ok(`${href}: has NO aria-label`, !/aria-label=/.test(b),
     'an aria-label would win the accessible name and silence the span — ' +
     'two labels, one of them dead');

  /* The icon itself must stay hidden, or it is announced alongside the
     label as a meaningless graphic. */
  ok(`${href}: the svg is still aria-hidden`, /<svg[^>]*aria-hidden="true"/.test(b));
}

console.log('\n--- the cart count has one source ---');
{
  const b = linkBlock('/cart') || '';
  ok('the count is inside the sr-only label',
     /<span class="sr-only">Shopping cart \(<%= cart\.count %> items\)<\/span>/.test(b));
  ok('the visible badge stays aria-hidden',
     /<span class="nav-cart-badge" aria-hidden="true">/.test(b),
     'otherwise the count is announced twice — once as the badge, once in ' +
     'the label');
}

/* ═══ FAILURE MODE 2 ═══════════════════════════════════════════════ */
console.log('\n--- .sr-only is clipped, not display:none ---');
{
  const m = bundle.match(/\.sr-only\{[^}]*\}/);
  ok('.sr-only exists in the shipped bundle', !!m);
  const rule = m ? m[0] : '';
  ok('it uses clip, not display:none', /clip:/.test(rule) && !/display:\s*none/.test(rule),
     'display:none text is read by neither crawlers nor screen readers — ' +
     'the labels would vanish for both and nothing would look different');
  ok('it is absolutely positioned out of flow', /position:absolute/.test(rule),
     'otherwise it takes layout space and shifts the icons');
  ok('it is 1px, not zero-sized', /width:1px/.test(rule) && /height:1px/.test(rule),
     'some assistive tech skips zero-sized elements');
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
