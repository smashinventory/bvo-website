#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_card_anchors.js — homepage tiles link from their title, not from the
   whole card, and the whole card still clicks.

   Run:  node gates/gate_card_anchors.js
   Exit: 0 = pass, 1 = fail

   WHY
   The category tiles and style-guide tiles were each a single <a> wrapping
   the entire card, so the anchor text was the heading plus the description
   plus the CTA run together — up to 158 characters naming no single subject.

   TWO WAYS THIS CAN REGRESS, AND BOTH ARE SILENT:

   1. The card goes back to being an <a>. Nothing breaks visually. The long
      anchor text comes back and nobody notices for months.

   2. The CSS overlay is removed or renamed while the markup stays. Then only
      the tile's TITLE is clickable and the rest of the card is dead. That is
      worse than the original problem and it is the kind of thing a stylesheet
      cleanup does by accident.

   So this asserts the markup and the CSS together. Either one alone is a
   half-truth.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

/* Comments are stripped before anything is asserted, and this is not cosmetic.
   index.ejs carries a comment explaining what the old markup was, and that
   comment contains the literal text <a class="cat-card"> — so an un-stripped
   scan reports the defect is still present when it is not. The reverse is the
   real hazard: an assertion satisfied by prose describing code, while the code
   itself says something else. Both EJS comments (which never reach the
   browser) and HTML comments (which do, but are inert) are removed. Output
   tags are left alone, since the assertions below match on them. */
const stripComments = (s) => s
  .replace(/<%\/\*[\s\S]*?\*\/%>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const view   = stripComments(read('views/pages/index.ejs'));
const css    = read('public/css/site2.css');
const bundle = read('public/css/site-bundle.css');
const layout = read('views/layouts/main.ejs');

/* ═══ 1. THE CARDS ARE NOT LINKS ═══════════════════════════════════ */
console.log('--- the tiles are not themselves links ---');
{
  /* The \s after <a is load-bearing. Without it, <a[^>]* happily matches the
     first two characters of <article class="cat-card"> — so the assertion
     that the card is NOT an anchor fails on the very markup that fixes it. */
  ok('the category tile is an <article>, not an <a>',
     /<article class="cat-card">/.test(view) && !/<a\s[^>]*class="cat-card"/.test(view),
     'a card-sized <a> swallows the heading and description into its anchor text');

  ok('the style-guide tile is an <article>, not an <a>',
     /<article class="hp-inspo-card">/.test(view) && !/<a\s[^>]*class="hp-inspo-card"/.test(view));
}

/* ═══ 2. THE LINK IS ON THE TITLE ══════════════════════════════════ */
console.log('\n--- each tile links from its title ---');
{
  ok('the category title carries the link',
     /<h3><a href="<%= _csHref\(cat\.slug\) %>" class="card-stretch"><%= cat\.name %><\/a><\/h3>/.test(view),
     'the anchor text should be exactly the category name and nothing else');

  ok('the style-guide title carries the link',
     /<h3 class="hp-inspo-card-title"><a href="\/inspiration\/<%= p\.slug %>" class="card-stretch"><%= p\.title %><\/a><\/h3>/.test(view));

  /* The destinations must not have drifted while the markup moved. */
  ok('the category link still points at _csHref(cat.slug)',
     /href="<%= _csHref\(cat\.slug\) %>"/.test(view));
  ok('the style-guide link still points at /inspiration/<slug>',
     /href="\/inspiration\/<%= p\.slug %>"/.test(view));
}

/* ═══ 3. EXACTLY ONE LINK PER TILE ═════════════════════════════════
   Slice each card block out and count anchors inside it. Two links to the
   same place inside one tile is the thing the restructure was meant to
   avoid, and it is easy to reintroduce by adding a "Shop Now" anchor. */
console.log('\n--- exactly one link inside each tile ---');
{
  const blockFor = (open, close) => {
    const s = view.indexOf(open);
    if (s < 0) return null;
    const e = view.indexOf(close, s);
    return e < 0 ? null : view.slice(s, e);
  };
  const cat = blockFor('<article class="cat-card">', '</article>');
  const ins = blockFor('<article class="hp-inspo-card">', '</article>');

  ok('the category tile block was found', !!cat && cat.length > 200);
  ok('the style-guide tile block was found', !!ins && ins.length > 200);

  if (cat) ok('the category tile contains exactly one <a>',
     (cat.match(/<a\s/g) || []).length === 1,
     `found ${(cat.match(/<a\s/g) || []).length} — a second link competes with the first`);
  if (ins) ok('the style-guide tile contains exactly one <a>',
     (ins.match(/<a\s/g) || []).length === 1,
     `found ${(ins.match(/<a\s/g) || []).length}`);

  /* The CTA text must survive as plain text, not become a second link. */
  if (cat) ok('"Shop Now" is still a <span>, not a second link',
     /<span class="cat-link">Shop Now/.test(cat));
  if (ins) ok('"Read guide" is still a <span>, not a second link',
     /<span class="hp-inspo-card-cta">Read guide/.test(ins));
}

/* ═══ 3b. THE MEGAMENU PROMO CARD ══════════════════════════════════
   Same defect, different file — it was missed when the homepage tiles were
   fixed, and it was the single remaining over-length anchor on the page
   (155 characters). It lives in the header, so it is on EVERY page. */
console.log('\n--- the megamenu promo card ---');
{
  const hdr = stripComments(read('views/partials/header.ejs'));

  ok('the promo card is a <div>, not an <a>',
     /<div class="mega-promo-card">/.test(hdr) && !/<a\s[^>]*class="mega-promo-card"/.test(hdr),
     'a card-sized <a> here puts the eyebrow, title, sub AND cta into one ' +
     'anchor text — 155 characters, on every page of the site');

  ok('the link sits on the promo title',
     /<p class="mega-promo-title"><a href="[^"]*" class="card-stretch">/.test(hdr));

  /* [\s\S] not [^>]: the href is an EJS tag, so the attribute value itself
     contains a ">" (in "%>"). A [^>]* class pattern stops dead inside the
     tag and the assertion fails on correct markup — the same shape of bug as
     <a[^>]* matching the first two characters of <article. */
  ok('the promo title still renders the editable title field',
     /<p class="mega-promo-title"><a [\s\S]{0,140}?class="card-stretch"><%=\s*_vmp\.title\s*\|\|/.test(hdr),
     'the Theme Editor field must survive the restructure');

  ok('the destination is still the editable url field',
     /<a href="<%= _vmp\.url \|\| '\/collections\/vanity-models' %>" class="card-stretch">/.test(hdr));

  const block = (() => {
    const s = hdr.indexOf('<div class="mega-promo-card">');
    return s < 0 ? '' : hdr.slice(s, hdr.indexOf('</div>', s));
  })();
  ok('exactly one <a> inside the promo card',
     (block.match(/<a\s/g) || []).length === 1,
     `found ${(block.match(/<a\s/g) || []).length}`);
  ok('the CTA is still a <span>, not a second link',
     /<span class="mega-promo-cta">/.test(block));

  /* .card-stretch::after positions against the nearest POSITIONED ancestor.
     Without this the overlay escapes the card and covers the megamenu. */
  ok('.mega-promo-card is position:relative in the shipped bundle',
     /\.mega-promo-card\{[^}]*position:relative/.test(bundle),
     'the overlay would escape the card and cover the whole dropdown');
}

/* ═══ 4. THE WHOLE TILE STILL CLICKS ═══════════════════════════════
   This is the half that fails silently and hurts shoppers rather than
   rankings. Without the overlay only the title is clickable. */
console.log('\n--- the CSS that keeps the whole tile clickable ---');
{
  ok('.card-stretch::after exists',
     /\.card-stretch::after\s*\{/.test(css),
     'without this ONLY the tile title is clickable and the rest of the card ' +
     'is dead — worse than the problem this change fixed');

  const rule = css.slice(css.indexOf('.card-stretch::after'),
                         css.indexOf('}', css.indexOf('.card-stretch::after')));
  ok('the overlay is absolutely positioned', /position:\s*absolute/.test(rule));
  ok('the overlay covers the card (inset: 0)', /inset:\s*0/.test(rule));
  ok('the overlay has content, or it will not render',
     /content:\s*""/.test(rule),
     'a ::after with no content property is not generated at all');

  ok('both card types are position:relative',
     /\.cat-card\s*,\s*\.hp-inspo-card\s*\{[^}]*position:\s*relative/.test(css),
     'without this the overlay escapes the card and covers the page — it ' +
     'positions against the nearest positioned ancestor');

  /* The titles were plain text; they are anchors now, and the global rule is
     a{color:var(--color-amber)}. Without this they render amber, not navy. */
  ok('.card-stretch inherits its colour and drops the underline',
     /\.card-stretch\s*,\s*\.card-stretch:hover\s*\{[^}]*color:\s*inherit[^}]*text-decoration:\s*none/.test(css),
     'the tile titles will render amber and underlined instead of navy');
}

/* ═══ 4b. THE STYLESHEET THE BROWSER ACTUALLY LOADS ═════════════════
   THIS IS THE SECTION THAT NEARLY DID NOT EXIST, AND IT IS THE ONE THAT
   MATTERS MOST.

   site2.css is a SOURCE file. No page links it. main.ejs links exactly one
   stylesheet — site-bundle.css, a hand-minified concatenation of brand.css +
   site.css + site2.css + the first ~8KB of site4.css. Editing site2.css and
   stopping there changes precisely nothing in any browser.

   The failure that produces is the bad one: the markup ships (so the cards
   are no longer links) while the CSS does not (so the overlay is absent), and
   only each tile's title is clickable. Everything looks normal. Most of the
   tile silently stops working.

   The bundle cannot be regenerated by concatenating the sources — it is
   minified, and main.ejs documents a previous attempt that got this wrong. So
   the rule is patched into both by hand, and this asserts they agree. */
console.log('\n--- the rules reached site-bundle.css, which is what ships ---');
{
  ok('site-bundle.css carries the overlay',
     /\.card-stretch::after\{[^}]*content:""[^}]*position:absolute[^}]*inset:0/.test(bundle),
     'site2.css is a source file that no page links — the bundle is what the ' +
     'browser loads. Patch both.');

  ok('site-bundle.css carries position:relative on the cards',
     /\.cat-card,\.hp-inspo-card\{position:relative\}/.test(bundle));

  ok('site-bundle.css carries the colour inherit',
     /\.card-stretch,\.card-stretch:hover\{color:inherit;text-decoration:none\}/.test(bundle));

  /* A correct bundle behind a stale ?v= is the same outage with an extra step:
     the CDN and every returning visitor keep the old file. */
  const m = layout.match(/site-bundle\.css\?v=(\d+)/);
  ok('the layout links site-bundle.css with a version', !!m);
  /* FLOOR RAISED WITH EVERY BUNDLE CHANGE. v=22 shipped the card-stretch
     overlay; v=23 the footer retrack, the demoted-heading selectors and the
     .footer-brand p max-width. Raising it here is the only mechanical thing
     forcing the bump — nothing else connects the stylesheet to the link. */
  ok(`the cache-buster is at least v=26 (found v=${m ? m[1] : '?'})`,
     !!m && Number(m[1]) >= 26,
     'returning visitors and the CDN will keep serving the bundle that has ' +
     'no overlay rule, against markup that needs it');
}

/* ═══ 5. RULE 11 — THE CDN FILE SIZE LIMIT ═════════════════════════
   BVO_AUDIT_BRIEF.md Rule 11: Hostinger's CDN hard-limits a static file at
   ~80KB. Adding CSS here without checking is how site.css broke once. */
console.log('\n--- Rule 11: site2.css is under the 80KB CDN limit ---');
{
  const bytes = Buffer.byteLength(css, 'utf8');
  ok(`site2.css is ${(bytes / 1024).toFixed(1)} KB`,
     bytes < 80 * 1024,
     'over the Hostinger CDN limit — split into site3.css and link it in main.ejs');
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
