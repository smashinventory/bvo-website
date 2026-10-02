#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_footer_and_headings.js

   Two changes that share one failure mode: both are deletions, and a
   deletion that goes one item too far is invisible in review.

   1. The footer's SHOP column was removed. HELP and COMPANY must survive.
   2. Four things that were headings are no longer headings.

   WHY THE FOOTER HALF MATTERS MORE THAN IT LOOKS
   HELP and COMPANY carry Shipping Policy, Returns & Refunds, Contact Us,
   About Us, Privacy Policy and Terms. Google Merchant Center's policy
   reviewer looks for exactly those, and the footer is where reviewers expect
   them. The account is under review. Losing them in a later "the footer is
   cluttered" pass would not throw an error, would not fail a page load, and
   would not be noticed until a GMC rejection arrives weeks later with no
   obvious cause. So they are asserted by name.

   Run:  node gates/gate_footer_and_headings.js
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

const footer = strip(read('views/partials/footer.ejs'));
const index  = strip(read('views/pages/index.ejs'));
const drawer = strip(read('views/partials/cart-drawer.ejs'));
const bundle = read('public/css/site-bundle.css');
const css    = read('public/css/site.css');
const css2   = read('public/css/site2.css');

/* ═══ 1. THE SHOP COLUMN IS GONE ═══════════════════════════════════ */
console.log('--- the footer SHOP column is gone ---');
{
  ok('the shop menu is no longer read',
     !/_colShop/.test(footer),
     'the variable is still being populated — the column probably still renders');
  ok('the Shop heading no longer renders',
     !/col_shop_heading/.test(footer));
  ok('no link to the ?type= faucets alias remains in the footer',
     !/type=Bathroom\+Faucets/.test(footer));
}

/* ═══ 2. THE POLICY COLUMNS SURVIVED ═══════════════════════════════
   Named individually and deliberately. "two columns remain" would pass
   while pointing at the wrong two. */
console.log('\n--- HELP and COMPANY survived (GMC policy review depends on these) ---');
{
  /* WORD BOUNDARIES ARE LOAD-BEARING HERE.

     The first version of this gate tested /_colHelp/ and /_colCompany/, and
     the mutation sweep walked straight past renaming _colHelp -> _colHelpX,
     which is what a careless refactor looks like. A bare substring matches
     its own corrupted form, so the assertion passed while the Help column
     rendered empty — and an empty Help column is Shipping Policy, Returns &
     Refunds and Contact Us gone from the site during a GMC review.

     Asserting both the declaration AND the loop that consumes it, because a
     variable that is declared and never read is the same outcome. */
  ok('the help menu is declared',
     /\bvar _colHelp\s*=\s*_fm\.help\b/.test(footer),
     'Shipping Policy, Returns & Refunds and Contact Us disappear with it');
  ok('the help menu is actually looped over',
     /\b_colHelp\.forEach\b/.test(footer),
     'declared but never read renders an empty column — same outcome');

  ok('the company menu is declared',
     /\bvar _colCompany\s*=\s*_fm\.company\b/.test(footer),
     'About Us, Privacy Policy and Terms disappear with it');
  ok('the company menu is actually looped over',
     /\b_colCompany\.forEach\b/.test(footer));

  /* What this gate CANNOT prove: that those menus contain any links. The
     labels and URLs live in nav_menus (Menu Manager), not in this template,
     and a gate has no database. Emptying footer-help in the admin would
     still pass every assertion here. */
  ok('the Help column heading still renders',    /col_help_heading/.test(footer));
  ok('the Company column heading still renders', /col_company_heading/.test(footer));

  /* ── THE LABELS ARE NOT HEADINGS, AND THE GROUPS ARE STILL NAMED ──
     They were <h4>, valid only while the footer brand name above them was
     an <h3>. Demoting that brand name removed the H3 and left every page
     jumping H2 -> H4, which Lighthouse flags. The fix is to drop the
     heading entirely rather than re-level it.

     Both halves are asserted, because the second is the one that fails
     silently. Removing a heading and leaving two unlabelled lists of links
     looks identical on screen and is worse for a screen reader user than
     the skipped level was. The <nav aria-labelledby> is what replaces the
     handle they lost. */
  ok('no heading of any level survives in the footer',
     !/<h[1-6][\s>]/.test(footer),
     'a heading here reintroduces the skipped level — the last heading ' +
     'before the footer is H1 on /cart, H2 on most pages and H3 on ' +
     'collections, so no single level is safe on all of them');

  ok('the Help label renders as plain text',
     /<div class="footer-col-title" id="footer-col-help">/.test(footer));
  ok('the Company label renders as plain text',
     /<div class="footer-col-title" id="footer-col-company">/.test(footer));

  ok('each column is a <nav> landmark',
     (footer.match(/<nav class="footer-col"/g) || []).length === 2,
     'without this the labels are decoration and the link groups are ' +
     'anonymous to assistive technology');
  ok('the Help nav is named by its own visible label',
     /<nav class="footer-col" aria-labelledby="footer-col-help">/.test(footer));
  ok('the Company nav is named by its own visible label',
     /<nav class="footer-col" aria-labelledby="footer-col-company">/.test(footer));

  /* aria-labelledby, not aria-label: the accessible name has to track the
     Theme Editor value. A hardcoded aria-label would keep saying "Help"
     after the visible label was renamed. */
  ok('the names are not hardcoded aria-labels',
     !/<nav class="footer-col" aria-label="/.test(footer),
     'the name would stop matching the visible text once it is renamed');

  ok('the label styling followed off the tag',
     /\.footer-col-title\{/.test(bundle)
       && !/\.footer-col h4\{/.test(bundle) && !/\.footer-col h2\{/.test(bundle),
     'the labels lose their uppercase white styling and render as body text');
  ok('exactly two footer columns remain',
     (footer.match(/class="footer-col"/g) || []).length === 2,
     `found ${(footer.match(/class="footer-col"/g) || []).length}`);
}

/* ═══ 3. THE GRID MATCHES THE COLUMN COUNT ═════════════════════════
   The template and the stylesheet have to agree. They are different files
   and nothing connects them, so dropping a column without retracking the
   grid leaves an empty cell the width of a whole column. */
console.log('\n--- the grid was retracked to match ---');
{
  const want = '.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr;';
  ok('site.css: brand + 2 columns', css.includes(want),
     'still 2fr 1fr 1fr 1fr — an empty column-wide gap where Shop used to be');
  ok('site-bundle.css: brand + 2 columns (this is the file that ships)',
     bundle.includes(want));
  ok('no 4-track footer grid survives anywhere',
     !css.includes('2fr 1fr 1fr 1fr') && !bundle.includes('2fr 1fr 1fr 1fr'));

  /* Dropping the Shop column widened the brand column from 461px to 601px at
     1440, which let the strapline run most of a line further before wrapping.
     Measured on the live page at the retracked width: the line breaks after
     "prices" anywhere in 342-366px, and 356 is the middle of that window.
     Asserted as an exact value because any other number silently moves the
     break — 341 breaks after "accessories", 367 after "that". */
  const mw = '.footer-brand p{font-size:.8rem;line-height:1.6;margin-bottom:16px;max-width:356px}';
  ok('the footer strapline is capped at 356px (source)', css.includes(mw));
  ok('the footer strapline is capped at 356px (shipped bundle)', bundle.includes(mw),
     'without it the line runs to "...make sense. Free shipping on every"');
}

/* ═══ 4. THE DEMOTED HEADINGS ══════════════════════════════════════ */
console.log('\n--- things that are no longer headings ---');
{
  ok('trust band: the three stat values are not <h3>',
     (index.match(/<div class="trust-item-value">/g) || []).length === 3
       && !/<h3><%= _d\.stat/.test(index),
     '"10,000+", "500+" and "Free" were headings announcing nothing');

  ok('trust band: the stat values are <div>, not <p>',
     !/<p class="trust-item-value">/.test(index),
     '.trust-item p styles the small uppercase LABEL — a <p> here would ' +
     'inherit it and lose the large amber figure');

  ok('the stat LABELS are still <p>',
     (index.match(/<\/div><p><%= _d\.stat\d_label/g) || []).length === 3,
     'the label is the part that carries the meaning; it must survive');

  ok('footer brand name is not a heading',
     /<div class="footer-brand-name">/.test(footer) && !/<h3><%= nav\.brand_line1/.test(footer));

  ok('cart drawer title is not a heading',
     /<div class="cd-title">/.test(drawer) && !/<h2 class="cd-title">/.test(drawer),
     'this partial is on every page — it was one stray heading per URL');

  ok('the cart drawer is still named for screen readers',
     /<aside class="cart-drawer"[^>]*aria-label="Shopping cart"/.test(drawer),
     'the <aside> label is what announces the region now that the h2 is gone — ' +
     'without it the drawer becomes an unnamed landmark');
}

/* ═══ 5. THE DEMOTIONS DID NOT CHANGE HOW ANYTHING LOOKS ═══════════
   Each demotion moved a tag-based CSS selector to a class-based one. Miss
   one and the element keeps its markup but loses its styling — the stat
   figure drops from 3rem amber to default body text and nobody reading the
   diff would see it. */
console.log('\n--- the styles followed the markup ---');
{
  ok('.trust-item .trust-item-value is styled (source)',
     /\.trust-item \.trust-item-value\{[^}]*font-size:clamp\(2rem/.test(css2));
  ok('.trust-item .trust-item-value is styled (shipped bundle)',
     /\.trust-item \.trust-item-value\{[^}]*font-size:clamp\(2rem/.test(bundle),
     'the figure will render as plain body text');
  ok('.footer-brand-name is styled (source)',      /\.footer-brand-name\{/.test(css));
  ok('.footer-brand-name is styled (bundle)',      /\.footer-brand-name\{/.test(bundle));
  ok('.footer-brand-name span keeps the amber accent', /\.footer-brand-name span\{/.test(bundle));

  ok('no orphaned .trust-item h3 rule remains',   !/\.trust-item h3\{/.test(bundle));
  ok('no orphaned .footer-brand h3 rule remains', !/\.footer-brand h3\{/.test(bundle));

  /* .cd-title was already a class selector, so nothing had to move. Asserted
     so that a later "tidy-up" to .cd-header h2 fails here instead of silently
     unstyling the cart drawer header. */
  ok('.cd-title is still keyed on the class, not the tag', /\.cd-title\{/.test(bundle));
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
