'use strict';
/* Gates for the in-place colour swap on product cards, 2026-09-28.
 *
 * WHAT IS AT STAKE
 *
 * This feature exists because the card used to NAVIGATE on a swatch
 * click, and it navigated because swapping only the photo produced a
 * card that lied: one colour's picture over another colour's price,
 * above a link to a third thing. The owner asked for the swap; the lie
 * is the thing that must not come back with it.
 *
 * So the assertions below are almost all of one shape: every element on
 * the card that NAMES A SKU must move together, or be removed. A field
 * that updates the photo and forgets the price is worse than the bug
 * that was reported, because the shopper cannot see that it is wrong.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
/* Comments are not code. This trap has bitten these gates repeatedly:
   an assertion passes on the paragraph explaining the behaviour rather
   than the line implementing it. */
const executable = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const visible = src => src
  .replace(/<%\/\*[\s\S]*?\*\/%>/g, '').replace(/<%#[\s\S]*?%>/g, '');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const model  = executable(read('src/models/Product.js'));
const colRaw = read('views/pages/collection.ejs');
const col    = visible(colRaw);
const js     = read('public/js/carousels.js');
const jsX    = executable(js);
const layout = read('views/layouts/main.ejs');

/* ═══ 1. THE SERVER CARRIES A COMPLETE VARIANT ═════════════════════ */
console.log('--- the data needed to repaint honestly ---');
/* Without any one of these the card cannot update the field it drives,
   and would leave the ORIGINAL product's value sitting there. */
const siblingQuery = model.slice(model.indexOf('const ph ='),
                                 model.indexOf('siblings = rowsOut'));
ok('the sibling query block was found', siblingQuery.length > 200,
   'every assertion in this section would pass on an empty string');
for (const f of ['id', 'price', 'compare_price', 'primary_image_url', 'qty_on_hand']) {
  ok(`sibling query selects ${f}`, new RegExp(`\\b${f}\\b`).test(siblingQuery),
     'the card cannot repaint that field');
}
ok('colorVariants is exported',
   /r\.colorVariants\s*=/.test(model), 'the template has nothing to emit');
for (const k of ['slug', 'id', 'price', 'compare_price', 'image', 'qty']) {
  ok(`colorVariants carries ${k}`,
     new RegExp(`\\b${k}:`).test(model.slice(model.indexOf('r.colorVariants'),
                                             model.indexOf('r.sizeKey'))),
     'dropped between the query and the view');
}
/* colorLinks is read by other templates. Widening it in place would
   change all of them for the benefit of one card. */
ok('colorLinks is left slug-only',
   /r\.colorLinks = Object\.fromEntries\(Object\.entries\(colorLinks\)\.map\(\(\[k, v\]\) => \[k, v\.slug\]\)\)/
     .test(model), 'other templates read colorLinks and would break');
/* A sibling whose photo lives only in product_images is not image-less.
   Asserted on the SIBLING QUERY slice, not the whole file: the listing
   query further down contains the identical COALESCE, so a file-wide
   match passed even with the sibling query mutated back. */
ok('the sibling photo uses the same COALESCE as the listing',
   /COALESCE\(p\.primary_image_url, pi\.url\)/.test(siblingQuery),
   'colours with a product_images photo would needlessly keep navigating');
ok('the sibling query still cannot take the listing down',
   /catch[\s\S]{0,300}console\.warn\('\[Product\.attachVariantLinks\]/.test(model),
   'a variant query failure would 500 the collection page');

/* ═══ 2. THE SWATCH EMITS IT — AND ONLY WHEN IT IS COMPLETE ════════ */
console.log('\n--- what the swatch carries ---');
ok('the swatch emits data-variant', /data-variant="<%= JSON\.stringify\(_pSwSwap\)/.test(col),
   'nothing for the client to read');
ok('saved-state is resolved server-side',
   /saved:[\s\S]{0,120}savedProductIds\.has\(_pSwVar\.id\)/.test(col),
   'the heart would keep the ORIGINAL product\'s filled/empty look');
ok('and guarded, because not every page defines it',
   /typeof savedProductIds !== 'undefined'[\s\S]{0,80}savedProductIds\.has\(_pSwVar\.id\)/.test(col),
   'ReferenceError renders a blank collection page');
/* THE CENTRAL RULE. A colour with no price or no photo cannot be shown
   honestly in place, so that swatch — not the whole card — keeps the
   old navigate behaviour. */
ok('an incomplete variant does NOT get data-variant',
   /_pSwVar\.price != null && _pSwVar\.image/.test(col),
   'a colour with no price would repaint using the PREVIOUS colour\'s figure');
ok('and falls back to navigation instead',
   /if \(_pSwSwap\) \{ %>data-variant=[\s\S]{0,140}\} else if \(_pSwHref\) \{ %>data-variant-href=/.test(col),
   'that swatch would become inert — a click doing nothing at all');
ok('was-price is only set when it is really higher',
   /Number\(_pSwVar\.compare_price\) > Number\(_pSwVar\.price\)/.test(col),
   'a "Save $0" badge, or a strikethrough below the sale price');

/* ═══ 3. SIZE CHIPS ARE UNCHANGED ══════════════════════════════════ */
console.log('\n--- size chips still navigate ---');
/* Owner: "just do color swatch. We have filters to assist with config.
   No need to overcomplicate this scope." */
/* Anchored on the LAST sizes row: model cards render an identical
   class earlier in the file, and slicing to the first "btn btn-sage"
   produced an EMPTY string — which passed the "no data-variant" half of
   this pair while asserting nothing at all. */
const _szStart  = col.lastIndexOf('model-card-sizes-row');
const sizeBlock = col.slice(_szStart, col.indexOf('</article>', _szStart));
ok('the size-chip block was actually found',
   sizeBlock.length > 200 && /model-card-size-btn/.test(sizeBlock),
   'the two assertions below would pass on an empty string');
ok('size chips still carry data-variant-href', /data-variant-href/.test(sizeBlock), 'scope crept');
ok('size chips do NOT carry data-variant',    !/data-variant="/.test(sizeBlock), 'scope crept');
ok('the navigate handler survives for them',
   /closest\('\[data-variant-href\]'\)/.test(jsX), 'size chips would go inert');

/* ═══ 4. EVERY SKU-BEARING ELEMENT MOVES OR GOES ═══════════════════ */
console.log('\n--- nothing is left describing the old SKU ---');
const swap = jsX.slice(jsX.indexOf('var BUNNY'));
ok('the photo',        /\.product-img-pri/.test(swap),        'photo not swapped');
/* Setting src while a srcset is present changes NOTHING on screen. */
ok('and its srcset, or the swap is invisible',
   /setAttribute\('srcset'/.test(swap) && /removeAttribute\('srcset'\)/.test(swap),
   'the browser keeps serving the candidate it already picked');
ok('the price block', /\[data-card-price\]/.test(swap),       'price left on the old colour');
ok('the price block is rebuilt whole, not patched',
   /price\.innerHTML =/.test(swap),
   'the previous colour\'s Save badge would survive onto a full-price colour');
ok('the was-price and Save badge',
   /card-price__was/.test(swap) && /card-save-badge/.test(swap), 'stale discount shown');
ok('the stock line',   /\[data-card-qty\]/.test(swap),        'other colour\'s stock');
ok('all three links',
   /'\.product-img-link', '\.product-title a', '\.btn-sage'/.test(swap),
   'a link still points at the previous colour');
ok('the heart id and slug',
   /data-product-id[\s\S]{0,120}data-product-slug/.test(swap), 'favourites the wrong SKU');
ok('the heart filled state',  /is-saved/.test(swap),          'shows another product\'s save');
ok('the active swatch moves', /classList\.add\('is-active'\)/.test(swap), 'no selection feedback');
/* These belong to the rendered product and are NOT carried per colour,
   so they are removed rather than left lying. */
ok('the hover photo is removed',  /product-img-hov/.test(swap),   'hover shows the old SKU');
ok('the corner badge is removed', /\.product-badge/.test(swap),   'a BEST badge on another SKU');
ok('the video badge is removed',  /\.product-video-badge/.test(swap), 'plays the old SKU\'s video');
ok('the price hook exists in the markup', /data-card-price/.test(col), 'JS finds nothing');
ok('the qty hook exists in the markup',   /data-card-qty/.test(col),   'JS finds nothing');

/* ═══ 5. IT MUST BE THE ONLY HANDLER THAT RUNS ═════════════════════ */
console.log('\n--- site.js must not run its partial swap on top ---');
/* site.js binds .model-card-swatch on the BUBBLE phase and swaps only
   the photo. If it ran after this, it would re-create the mismatch. */
ok('the listener is capture-phase', /\}, true\);/.test(swap), 'site.js would win');
ok('it stops propagation',  /e\.stopPropagation\(\)/.test(swap), 'site.js runs its partial swap');
ok('it prevents the default too', /e\.preventDefault\(\)/.test(swap), 'form/anchor default fires');
ok('modified clicks are left alone',
   /e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey \|\| e\.button !== 0/.test(swap),
   'cmd-click could no longer open anything');
ok('it is scoped to product cards',
   /closest\('\.product-card'\)/.test(swap),
   'a model card would lose its own in-place behaviour');
ok('malformed JSON degrades to a normal click',
   /catch \(err\) \{ return null; \}/.test(js) || /catch[\s\S]{0,60}return null/.test(swap),
   'a parse error would throw on every click');

/* ═══ 6. THE QTY BAND IS THE SAME LADDER ═══════════════════════════ */
console.log('\n--- the two copies of the stock ladder agree ---');
/* Duplicated deliberately (display banding, not data) — so assert they
   cannot drift. A mismatch would make the number JUMP on a swap even
   when the stock is identical. */
const bands = [[3,3],[6,4],[9,5],[12,6],[15,7],[20,8]];
for (const [bound, out] of bands) {
  ok(`band <= ${bound} -> ${out} in both`,
     new RegExp(`<=\\s*${bound}\\s*\\?\\s*${out === bound ? '_pQtyRaw' : out}`).test(colRaw)
       || new RegExp(`<= ${bound} \\? ${out}`).test(colRaw),
     'the client ladder disagrees with the server ladder');
  ok(`  and in carousels.js`,
     new RegExp(`<=\\s*${bound}\\s*\\?\\s*${out === bound ? 'q' : out}`).test(swap),
     'the number would jump on swap');
}
ok('zero stock still greys the card',
   /product-card--no-stock/.test(swap) && /card-qty--zero/.test(swap),
   'an out-of-stock colour would look in stock');

/* ═══ 7. CACHE ═════════════════════════════════════════════════════ */
console.log('\n--- the browser actually gets the new file ---');
/* .htaccess sets long cache headers on /js. Without a bump, returning
   visitors keep the navigating version and the bug "is not fixed". */
ok('carousels.js is cache-busted past v=2',
   /carousels\.js\?v=([3-9]|\d\d)/.test(layout), 'returning visitors keep the old file');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
