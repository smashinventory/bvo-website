#!/usr/bin/env node
/**
 * gate_card_badge_anchor.js
 *
 * THE DEFECT
 * Every product card wrapped its whole image box in the link:
 *
 *   <a class="product-img-link">
 *     <div class="product-img">
 *       <img alt="Dakota 36in Vanity, Pebble Oak">
 *       <span class="product-badge">TRENDING</span>      <-- inside the link
 *     </div>
 *   </a>
 *
 * An anchor's text is everything inside it, so the anchor text of every
 * product link on the site began with the badge word. Seobility reported it
 * plainly:
 *
 *   /products/d100-v36-pbo-3wz   TRENDING      IMG-ALT
 *   /products/d200-v36-csn-3wz   HOT SELLER    IMG-ALT
 *   /products/d404-v72-swo-3wz   POPULAR       IMG-ALT
 *   /products/e444-v48-gw-3wz    GREAT VALUE   IMG-ALT
 *
 * On a collection page it was the damaging form of the failure: "HOT SELLER"
 * to eight DIFFERENT products from one page. And the badges come from a
 * rotation (src/utils/cardBadge.js), so the same product advertised itself
 * with different anchor text from one crawl to the next — anchor text that
 * is not merely wrong but unstable.
 *
 * Sam asked whether our card work caused it. It did not. git blame puts the
 * <a class="product-img-link"> wrapper at 5caf1de, the initial import of
 * 2026-07-13, and the badge text at 1626bda2 / a1567c10 on 2026-09-06.
 * f259c30 changed the homepage CATEGORY and STYLE tiles, not product cards,
 * and today's commits touched index.ejs only to bump a stylesheet version.
 * It became visible because 27 duplicate-anchor groups and 41 "Learn More"s
 * were removed from in front of it.
 *
 * THE FIX
 * Invert the two elements. .product-img becomes the parent; the <a> wraps
 * only the photo. The badge, the video badge and the heart button stay inside
 * .product-img, which is position:relative, so they keep their positioning
 * reference and lose their place in the anchor text.
 *
 * WHAT THIS GATE ASSERTS, AND WHY IT IS WRITTEN THIS WAY
 * Three bugs shipped past green gates on 2026-10-02 because each gate
 * restated the markup or rule I had just written instead of the condition
 * that had to hold. So nothing below matches my phrasing. It parses the card
 * region, finds the real anchor, and asks what is inside it.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0;
const ok    = m => console.log('  PASS  ' + m);
const bad   = m => { console.log('  FAIL  ' + m); fails++; };
const check = (c, m) => c ? ok(m) : bad(m);

console.log('\n=== gate_card_badge_anchor ===\n');

/* ───────────── 0. EVERY TOUCHED TEMPLATE MUST COMPILE ─────────────
   First, always. gate_lookbook_payload reported "All assertions passed"
   against a lookbook.ejs that could not be parsed at all, because every
   other assertion in it reads the file as TEXT. A gate that is green on a
   page which cannot render is worse than no gate. */
const TEMPLATES = [
  'views/pages/index.ejs',
  'views/pages/collection.ejs',
  'views/pages/search.ejs',
  'views/pages/account/favorites.ejs',
  'views/pages/product.ejs',
];

console.log('-- the templates parse --');
for (const t of TEMPLATES) {
  try {
    require('ejs').compile(read(t), { filename: path.join(ROOT, t) });
    ok(`${t} compiles`);
  } catch (e) {
    bad(`${t} DOES NOT COMPILE: ${String(e.message).split('\n')[0]}`);
  }
}

/* ───────────── the parser ─────────────
   EJS tags are stripped BEFORE any tag scanning. Two reasons, both learned
   the hard way in this repo:

   1. Every EJS tag ends in "%>", which contains a ">". So [^>]* and
      indexOf('>') both stop INSIDE an attribute whose value is an EJS tag —
      href="/products/<%= product.slug %>" being exactly that. That trap
      produced four wrong results on 2026-10-02, two of them inside gates.
      Removing the EJS first means the remaining ">" characters really are
      tag boundaries.

   2. A conditional must not hide markup from the scan. <%# ... %> comments
      are removed as well, so this file's own prose above — which quotes the
      broken structure as an example — cannot be mistaken for code. Gates
      here have failed on correct trees for precisely that. */
const stripEjs = s => s
  .replace(/<%#[\s\S]*?%>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<%[\s\S]*?%>/g, '');

/* Every <article class="product-card..."> ... </article> in a template. */
function cards(src) {
  const out = [];
  const re = /<article class="product-card/g;
  let m;
  while ((m = re.exec(src))) {
    const end = src.indexOf('</article>', m.index);
    if (end === -1) continue;
    out.push({
      line: src.slice(0, m.index).split('\n').length,
      html: stripEjs(src.slice(m.index, end + '</article>'.length)),
    });
  }
  return out;
}

/* The contents of the product-img-link anchor, found by walking <a>/</a>
   depth rather than by taking the first </a> — which would be wrong the
   moment anything nests. */
function imgLinkInner(html) {
  const open = /<a\b[^>]*class="product-img-link"[^>]*>/.exec(html);
  if (!open) return null;
  const from = open.index + open[0].length;
  let depth = 1;
  const re = /<\/?a\b[^>]*>/g;
  re.lastIndex = from;
  let m;
  while ((m = re.exec(html))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(from, m.index);
  }
  return null;   /* unclosed */
}

/* ───────────── 1. the badge is not in the anchor ───────────── */
console.log('\n-- no callout badge inside a product image link --');
let total = 0;
for (const t of TEMPLATES) {
  const src = read(t);
  for (const c of cards(src)) {
    const link = /class="product-img-link"/.test(c.html);
    if (!link) continue;
    total++;
    const inner = imgLinkInner(c.html);
    if (inner === null) { bad(`${t}:${c.line} — the product-img-link anchor is never closed`); continue; }

    /* THE ASSERTION THAT MATTERS. Not "the badge span appears after the
       </a>" — that is a spelling. This asks what the anchor CONTAINS. */
    check(!/product-badge/.test(inner),
          `${t}:${c.line} — no .product-badge inside the image link`);

    /* And the link must still wrap the photo, or the fix has thrown away
       the click target instead of moving the badge out of it. */
    check(/<img\b/.test(inner) || /<svg\b/.test(inner),
          `${t}:${c.line} — the image link still wraps the photo`);

    /* Interactive content nested in an anchor. collection.ejs and
       favorites.ejs both had the heart <button> inside the link; no browser
       is obliged to make that work, and it was invalid before the fix too.
       Asserted because the inversion is what removed it, and a careless
       revert would put it back silently. */
    check(!/<button\b/.test(inner),
          `${t}:${c.line} — no <button> nested inside the image link`);
  }
}
check(total === 7, `all 7 product cards were found and checked (found ${total})`);

/* A whole-file backstop, independent of the parser above. If someone adds an
   eighth card in a new template, the loop will not see it — but a badge
   sitting between an opening product-img-link and its photo would still show
   up as this ordering. */
console.log('\n-- backstop: the badge never precedes the photo inside a link --');
for (const t of TEMPLATES) {
  const flat = stripEjs(read(t));
  check(!/class="product-img-link"[\s\S]{0,400}?product-badge[\s\S]{0,400}?<\/a>/.test(flat),
        `${t} — no badge between a product-img-link and its closing tag`);
}

/* ───────────── 2. .product-img is the PARENT now ─────────────
   The CSS below depends on this nesting, so it is asserted as a condition of
   the tree rather than inferred from the stylesheet. */
console.log('\n-- .product-img wraps the link, not the other way round --');
for (const t of TEMPLATES) {
  const flat = stripEjs(read(t));
  check(!/class="product-img-link"[^>]*>\s*<div class="product-img"/.test(flat),
        `${t} — the anchor no longer wraps the .product-img box`);
}

/* ───────────── 3. THE CSS CONDITIONS THE NEW SHAPE NEEDS ─────────────
   Both properties in both files. site.css is the source and site-bundle.css
   is the hand-minified concatenation that main.ejs actually links — an edit
   to site.css alone reaches no browser at all. That is a standing trap in
   this repo and the reason both are checked. */
console.log('\n-- the stylesheet matches the new tree --');
for (const f of ['public/css/site.css', 'public/css/site-bundle.css']) {
  const rules = read(f).replace(/\/\*[\s\S]*?\*\//g, '');

  /* (a) .product-img is now the direct flex child of .product-card, which is
         display:flex;flex-direction:column. flex-shrink:0 used to live on
         .product-img-link in that position; without it here the 210px image
         box can be squashed by a long title. */
  {
    const m = rules.match(/\.product-img\{([^}]*)\}/);
    check(!!m && /flex-shrink:\s*0/.test(m[1]),
          `${f}: .product-img carries flex-shrink:0 in its new position as the flex child`);
    /* The badge's positioning reference. If this goes, top:10px/left:10px
       escapes to whatever ancestor is positioned further up and the badge
       lands somewhere else on the page. */
    check(!!m && /position:\s*relative/.test(m[1]),
          `${f}: .product-img is still the positioning context for the badges`);
  }

  /* (b) The link is now a flex ITEM inside that box and has to fill it, or
         the clickable area shrinks to the intrinsic size of its contents.
         Measured as CONDITIONS — fills the box, and centres its child — not
         as the declaration I happened to write, so any rule that satisfies
         them passes. The centring matters only for the no-image placeholder
         <svg>, which .product-img used to centre itself; that is exactly the
         kind of regression nobody looks for. */
  {
    const m = rules.match(/\.product-img-link\{([^}]*)\}/);
    check(!!m, `${f}: .product-img-link has a rule`);
    const d = m ? m[1] : '';
    check(/width:\s*100%/.test(d) && /height:\s*100%/.test(d),
          `${f}: the image link fills the 210px box, so the whole photo stays clickable`);
    check(/display:\s*flex/.test(d) && /align-items:\s*center/.test(d) && /justify-content:\s*center/.test(d),
          `${f}: ...and centres its child, so the no-image placeholder svg stays centred`);
    /* display:block was right when it was the PARENT. Left in place it would
       put the placeholder svg in the top-left corner. */
    check(!/display:\s*block/.test(d),
          `${f}: ...and is not display:block, which would un-centre the placeholder`);
  }

  /* (c) The badge must stay above the photo. It always was — asserted as the
         pre-existing fact the fix relies on, not as a rule of mine. */
  {
    const m = rules.match(/\.product-badge\{([^}]*)\}/);
    check(!!m && /position:\s*absolute/.test(m[1]),
          `${f}: .product-badge is still absolutely positioned`);
  }
}

/* ───────────── 4. the cache buster ─────────────
   site-bundle.css is the only stylesheet the browser gets. Without the bump
   the CDN serves v=28 and the inverted markup renders against the old rules:
   a 210px box with no flex-shrink and a display:block link. */
console.log('\n-- the cache buster --');
{
  const main = read('views/layouts/main.ejs');
  const m = main.match(/site-bundle\.css\?v=(\d+)/);
  check(!!m && Number(m[1]) >= 29,
        `main.ejs requests site-bundle.css?v=${m ? m[1] : 'NONE'} (>= 29, or nobody gets the new rules)`);
}

/* ───────────── 5. the JS still finds what it moved ─────────────
   public/js/carousels.js repaints a card in place when a colour swatch is
   clicked: it REMOVES the badge and the video badge and repoints the image
   link. All of it is card.querySelector(...) plus n.parentNode.removeChild(n),
   which is parent-agnostic — that is why the inversion was safe. Asserted so
   that a future rewrite to, say, imgLink.querySelector() fails here rather
   than leaving a stale "POPULAR" badge on a product that is no longer the
   popular one. */
console.log('\n-- the in-place colour swap does not assume the old nesting --');
{
  const js = read('public/js/carousels.js');
  const block = (js.match(/\/\* ── things that belonged to the original SKU ──[\s\S]{0,700}?\}\);/) || [''])[0];
  check(block.length > 50, 'the badge-removal block was located in carousels.js');
  /* The condition: the lookup is scoped to the clicked CARD, and does not
     descend through the image link to find the badge. */
  check(/\bcard\.querySelector\(sel\)/.test(block),
        'badges are found from the clicked CARD');
  check(!/product-img-link/.test(block),
        '...without reaching through the image link, which no longer contains them');
  /* Scoped to the card and nothing wider. document.querySelector(sel) would
     compile, run, and strip the badge off the FIRST card on the page instead
     of the one that was clicked — a bug you would only catch by clicking a
     swatch on the second card and watching a third one change. */
  check(!/document\.querySelector(?!All)/.test(block),
        '...and not from the document, which would repaint the wrong card');

  /* NOT asserted: that removal is spelled parentNode.removeChild(n). The
     mutation sweep flagged n.remove() as "passing", and it was right to —
     n.remove() is equally parent-agnostic and equally correct. Pinning the
     spelling would have made this gate reject a clean refactor while
     catching nothing. That is the same tautology that let a live layout bug
     through on 2026-10-02; the fix is to assert the condition, which the
     three checks above do. */

  const links = (js.match(/\[[^\]]*'\.product-img-link'[\s\S]{0,120}?forEach/) || [''])[0];
  check(/card\.querySelector/.test(js) && links.length > 10,
        'the SKU links are also repointed from the card scope');
}

console.log(`\n${fails ? 'FAILED: ' + fails + ' assertion(s)' : 'All assertions passed.'}\n`);
process.exit(fails ? 1 : 0);
