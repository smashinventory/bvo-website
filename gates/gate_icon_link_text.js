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

/* Wording changed 2026-10-02 to match the mobile drawer — see the
   "hidden desktop labels match the visible mobile drawer" section below,
   which is what keeps the two copies from drifting again. */
const LINKS = [
  { href: '/account',           label: 'My Account'  },
  { href: '/account/favorites', label: 'Saved Items' },
  { href: '/cart',              label: 'Cart'        },
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
     /<span class="sr-only">Cart \(<%= cart\.count %>\)<\/span>/.test(b));
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

/* ═══ THE DESKTOP LABELS MATCH THE MOBILE DRAWER ═══════════════════
   The navigation exists twice in the HTML — icons with hidden labels for
   desktop, a text drawer for mobile. Two hand-maintained copies of the same
   thing drift, and they already had: sentence case on one side, title case
   on the other. That was invisible while the desktop side used aria-label,
   and only surfaced once it became link text.

   The drawer's labels are VISIBLE, so they are the reference; the hidden
   ones follow. Asserted as an exact pair so neither side can be reworded
   alone. */
console.log('\n--- hidden desktop labels match the visible mobile drawer ---');
{
  const PAIRS = [
    { sr: '<span class="sr-only">My Account</span>',
      mob: '<li><a href="/account">My Account</a></li>',                 what: 'My Account' },
    { sr: '<span class="sr-only">Saved Items</span>',
      mob: '<li><a href="/account/favorites">Saved Items</a></li>',      what: 'Saved Items' },
    { sr: '<span class="sr-only">Cart (<%= cart.count %>)</span>',
      mob: '<li><a href="/cart">Cart (<%= cart.count %>)</a></li>',      what: 'Cart (n)' },
  ];
  for (const { sr, mob, what } of PAIRS) {
    ok(`${what}: the hidden desktop label is present`, header.includes(sr));
    ok(`${what}: the visible drawer label is present`, header.includes(mob));
  }
  ok('no sentence-case leftovers from the old desktop wording',
     !/sr-only">My account</.test(header) && !/sr-only">Saved items</.test(header),
     'the two copies have drifted apart again');
}

/* ═══ THE FOOTER LOGO ALT IS NOT THE WORDMARK'S LINK TEXT ══════════
   For an image link the alt IS the anchor text. The footer logo used
   alt="<%= gl.site_name %>", which renders "BathroomVanitiesOutlet.com" —
   identical to the header wordmark's link text, with both links pointing at
   "/". One phrase acting as the anchor for two separate links to the same
   page, and invisible unless you read alt attributes.

   Asserted against site_name specifically: swapping the static alt back to
   the settings value silently recreates it. */
console.log('\n--- the footer logo alt does not collide with the wordmark ---');
{
  const footer = strip(read('views/partials/footer.ejs'));
  const logo = (() => {
    const i = footer.indexOf('class="footer-brand"');
    return i < 0 ? '' : footer.slice(i, footer.indexOf('</a>', i));
  })();

  ok('the footer brand logo block was found', logo.length > 80);
  ok('its alt is static, not gl.site_name',
     /alt="Bathroom Vanities Outlet logo"/.test(logo),
     'gl.site_name renders the same string as the header wordmark link text');
  ok('the alt does NOT interpolate the site name',
     !/alt="<%=\s*gl\.site_name/.test(logo));
  ok('the alt is not the wordmark string',
     !/alt="BathroomVanitiesOutlet\.com"/.test(logo));
}

/* ═══ THE HOMEPAGE CTA DEFAULT POINTS AT A PAGE THAT EXISTS ════════
   /pages/about is a 404; the page is /pages/about-us. Live is fixed in the
   Theme Editor, so this default is inert there — it matters only for a
   fresh environment, which is exactly the case nobody tests. */
console.log('\n--- the Image with Text CTA default is not a 404 ---');
{
  const ts = read('src/services/themeSettings.js');
  const block = (() => {
    const i = ts.indexOf('  image_with_text: {');
    return i < 0 ? '' : ts.slice(i, ts.indexOf('\n  },', i));
  })();
  ok('the image_with_text defaults were found', block.length > 100);
  ok("cta_url defaults to /pages/about-us", /cta_url:\s*'\/pages\/about-us'/.test(block));
  ok("it is not the 404 /pages/about", !/cta_url:\s*'\/pages\/about'/.test(block),
     'a fresh environment would ship a dead "Our Story" button');
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
