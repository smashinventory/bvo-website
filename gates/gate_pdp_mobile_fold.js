'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   gate_pdp_mobile_fold.js — the phone-only above-the-fold compaction.

   What this protects, and why each check is here rather than "obvious":

   The product page is where the money is, the fold is where the decision is
   made, and the three rules that fix it are easy to undo by accident — a
   bundle rebuild, a hand-typed media query, or someone "tidying" the inline
   style into a CSS file that the storefront does not load.

   Run: node gates/gate_pdp_mobile_fold.js
   ═══════════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const RED = '\x1b[31m', GRN = '\x1b[32m', DIM = '\x1b[2m', OFF = '\x1b[0m';
let failures = 0;

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function section(t) { console.log(`\n--- ${t} ---`); }
function check(label, ok, why) {
  if (ok) { console.log(`  ${GRN}ok${OFF}   ${label}`); return; }
  failures += 1;
  console.log(`  ${RED}FAIL${OFF} ${label}${why ? `\n       ${DIM}${why}${OFF}` : ''}`);
}

const pdp = read('views/pages/product.ejs');

/* The compaction block, isolated so a rule found elsewhere in this very
   large template cannot satisfy a check by coincidence. */
const BLOCK = (pdp.match(/ABOVE-THE-FOLD COMPACTION[\s\S]*?<\/style>/) || [''])[0];

/* ⚠️ THE CSS ONLY — THE EJS COMMENT IS STRIPPED, AND THE FIRST RUN OF THIS
   GATE IS WHY. The block opens with a long <%# ... %> comment that QUOTES
   the things the CSS must not contain: `.nav-logo`, `.site-nav`, and the
   literal `@media (max-width:480px)` lifted from breakpoints.js as an
   example of what went wrong before. Three checks duly failed against the
   documentation rather than the code. A gate that reads prose is a gate
   that fires on prose. */
/* ⚠️ EJS TAGS COME OUT BEFORE THE STYLE TAG IS MATCHED. The opening tag is
       <style nonce="<%= cspNonce %>">
   and `<style[^>]*>` stops at the FIRST '>' — the one inside the EJS tag.
   The capture then starts at '">', a parse error at character zero that
   makes a browser discard the whole sheet. A harness built on that regex
   showed this block "not working" and cost an afternoon chasing a CSS bug
   that did not exist. Strip the EJS, then the tag is well-formed. */
const CSS = ((BLOCK.replace(/<%[\s\S]*?%>/g, 'EJS'))
              .match(/<style[^>]*>([\s\S]*?)<\/style>/) || ['', ''])[1];

/* ── 1. IT EXISTS AND IT IS REACHABLE ────────────────────────────────────── */
section('the block is present and the browser will apply it');

check('the compaction block is still in product.ejs', BLOCK.length > 0,
  'the whole above-the-fold fix is gone');

check('it carries a CSP nonce',
  /<style nonce="<%= cspNonce %>">/.test(BLOCK),
  'CSP blocks unsigned <style> elements — the rules would silently never apply');

/* ── 2. THE MEDIA QUERY IS DERIVED, NEVER TYPED ──────────────────────────
   src/utils/breakpoints.js exists because hand-written media queries drifted
   from the owner's settings. mobile_max is a Theme Editor value; a literal
   here is correct until the day someone changes that setting, and then it is
   wrong in a way nobody notices because the page still renders. */
section('the band comes from settings, not from a typed number');

check('the @media condition is interpolated from breakpoints.mq.mobile',
  /@media\s+<%=\s*_bpPdp\.mq\.mobile\s*%>/.test(BLOCK),
  'the media condition is not derived from the resolved band');

check('no hand-typed max-width media query in the block',
  !/@media[^{]*\(\s*max-width\s*:\s*\d/.test(CSS),
  'a literal px media query has crept back in');

check('the band is resolved from the owner\'s settings',
  /breakpoints\.resolve\(\s*settings\s*\|\|\s*\{\}\s*\)/.test(pdp),
  'resolve() is not being called with settings');

/* ── 3. THE THREE RULES THAT DO THE WORK ─────────────────────────────────
   Measured contribution of each, 390x844: thumbs -224px, title -70px,
   breadcrumb -20px. Lose any one and the Add to Cart button falls back
   below the fold. */
section('all three savings are still in place');

check('thumbnails are a flex scroller, not the 3-column grid',
  /\.gallery-thumbs\s*\{[^}]*display:\s*flex/.test(BLOCK) &&
  /\.gallery-thumbs\s*\{[^}]*overflow-x:\s*auto/.test(BLOCK),
  'the thumbnail strip is the single biggest offender at 288px');

check('the grid column count is explicitly reset',
  /grid-template-columns:\s*none/.test(BLOCK),
  'without the reset, an edit to the desktop grid rule leaks into the scroller');

check('thumbs are pinned to a small fixed size',
  /\.gallery-thumb\s*\{[^}]*flex:\s*0\s+0\s+56px/.test(BLOCK));

check('hidden thumbs are revealed and the See-more button is hidden',
  /\.thumb-hidden\s*\{\s*display:\s*block/.test(BLOCK) &&
  /\.gallery-seemore-btn\s*\{\s*display:\s*none/.test(BLOCK),
  'in a scroller the button is dead weight and the hidden thumbs unreachable');

check('the title is clamped to two lines',
  /-webkit-line-clamp:\s*2/.test(BLOCK),
  'the title was 130px across four lines');

/* The approved mockup has no breadcrumb in the proposed frame. Hidden,
   not deleted — the markup and its BreadcrumbList structured data must
   survive for Google and for every width above the mobile band. */
check('the breadcrumb is hidden on phones',
  /\.breadcrumb\s*\{\s*display:\s*none/.test(BLOCK));
check('the breadcrumb markup itself still renders',
  /<div class="breadcrumb">/.test(pdp),
  'hiding is a CSS decision; deleting it would cost the structured data');

/* ── 4. WHAT THE BLOCK MUST NOT DO ───────────────────────────────────────
   The logo is the tempting fourth change and the wrong one to make here.
   .nav-logo is emitted per band from logo_width_mobile / logo_height_mobile
   (header.ejs), the nav height derives from it, and the <img> width/height
   attributes reserve layout space against CLS from the same numbers. A
   hard-coded height in this block would silently desync all three. */
section('the logo stays with the system that owns it');

check('the block does not restyle .nav-logo',
  !/\.nav-logo/.test(CSS),
  'shrinking the phone logo is a Theme Editor change, not a CSS override here');

check('the block does not restyle the nav bar height',
  !/\.site-nav/.test(CSS));

/* ── 5. IT STAYS OUT OF THE BUNDLE ───────────────────────────────────────
   main.ejs:178 documents that the bundle's rebuild recipe does not reproduce
   the file, and breakpoints.js records a rule that sat in site4.css for weeks
   while phones rendered the old value. Inline is the whole point. */
section('the rules are inline, not waiting on a bundle rebuild');

/* ⚠️ SCOPED TO .detail-title. The first version asserted that site4.css
   contained no -webkit-line-clamp at all and failed immediately: that file
   legitimately clamps product-card titles and other text. The risk being
   guarded is a COPY OF THIS RULE sitting in a stylesheet the storefront
   never loads, which would read as "already fixed" to the next person. */
check('no duplicate .detail-title clamp in the admin-only stylesheet',
  !/\.detail-title[^{]*\{[^}]*-webkit-line-clamp/.test(read('public/css/site4.css')),
  'site4.css is linked ONLY by the admin layout — a copy there would mislead');

check('product.ejs did not gain a new stylesheet link for this',
  (pdp.match(/<link[^>]+stylesheet/g) || []).length === 1,
  'the compaction should need no new stylesheet');

/* ── 6. THE TEMPLATE STILL COMPILES ──────────────────────────────────────
   An EJS syntax error here is a 500 on every product page. */
section('the template still compiles');

let compiles = true, compileErr = '';
try {
  require('ejs').compile(pdp, { filename: path.join(ROOT, 'views/pages/product.ejs') });
} catch (e) { compiles = false; compileErr = e.message; }
check('product.ejs compiles as EJS', compiles, compileErr);

/* The helper must actually be exposed, or the render throws on <%= %>. */
check('breakpoints is on res.locals for every request',
  /res\.locals\.breakpoints\s*=\s*require\(/.test(read('src/server.js')),
  'the template cannot require() — an undefined local throws at render');

check('breakpoints.resolve().mq.mobile really exists',
  typeof require('../src/utils/breakpoints').resolve({}).mq.mobile === 'string');

/* ── 7. THE REORDER ──────────────────────────────────────────────────────
   This is what moves Add to Cart above the fold, and it rests on one
   mechanism that is not obvious from reading the rules. */
section('the buy box is compacted under a shrunken hero');

/* Declarations only — comments stripped. A check that asks "does this
   value appear" must read rules, not the prose explaining them: an earlier
   integer check matched the 8.5 inside the comment warning against 8.5. */
const RULES = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

check('.detail-info is dissolved so its children can be ordered',
  /\.detail-info\s*\{\s*display:\s*contents/.test(RULES),
  'without display:contents, order cannot sort the buy box against the gallery');

check('the layout is a two-column grid on phones',
  /\.detail-layout\s*\{[^}]*display:\s*grid/.test(RULES) &&
  /grid-template-columns:\s*118px\s+1fr/.test(RULES),
  'the buy row needs a grid: 118px for the stepper, the rest for the button');

/* ⚠️ THE GALLERY IS NOT A CHILD OF .detail-info. Without an explicit
   grid-column it auto-places into column one and the product photo is
   squeezed into the 118px stepper track — measured at 89px tall on the
   live page before this line existed. */
check('the gallery is told to span both columns',
  /\.detail-layout\s*>\s*\*\s*\{\s*grid-column:\s*1\s*\/\s*-1/.test(RULES),
  'the gallery is a child of .detail-layout, not .detail-info');

/* The owner rejected the shrunken hero: on a product sold by appearance
   the viewer is the page, and the measurement showed the space was not
   needed — the trust row finishes at 843 against an 844 fold. */
check('the hero keeps its full size',
  !/\.gallery-main\s*\{[^}]*aspect-ratio/.test(RULES),
  'do not override the hero aspect ratio; it was measured as unnecessary');

check('the buy row puts the stepper and the button side by side',
  /\.detail-qty\s*\{[^}]*grid-column:\s*1/.test(RULES) &&
  /form:not\(\.bis\)\s*\{[^}]*grid-column:\s*2/.test(RULES));

/* ⚠️ :not(.bis) MATTERS. On out-of-stock pages the back-in-stock capture
   form is also a child of .detail-ctas; without the exclusion it would be
   pulled into the narrow second column instead of spanning the width. */
check('the back-in-stock form is excluded from the narrow column',
  /form:not\(\.bis\)/.test(RULES),
  'it would otherwise be squeezed into the button column');

/* The savings badge must never wrap to its own line - it is the reason
   the price is interesting, and a shopper should not have to find it. */
check('price, was-price and savings badge are held on one line',
  /\.detail-price-row\s*\{[^}]*flex-wrap:\s*nowrap/.test(RULES) &&
  /\.detail-save\s*\{[^}]*white-space:\s*nowrap/.test(RULES));

check('all three scale with the viewport rather than wrapping',
  (RULES.match(/font-size:\s*clamp\(/g) || []).length >= 3,
  'clamp() on price, was and badge is what keeps them on one line');

check('all three trust statements are held on one row',
  /\.pdp-trust-bar\s*\{[^}]*flex-wrap:\s*nowrap/.test(RULES) &&
  /\.pdp-trust-bar\s+\.ptb-item\s*\{[^}]*white-space:\s*nowrap/.test(RULES));

check('a catch-all order exists so nothing defaults to 0',
  /\.detail-info\s*>\s*\*\s*\{[^}]*order:\s*10/.test(RULES),
  'default order is 0 — one unlisted child silently jumps to the very top');

/* ⚠️ EVERY order VALUE MUST BE AN INTEGER. A draft used order:8.5 for the
   gallery; fractional values are invalid, the declaration is dropped, and
   an unordered .detail-gallery falls back to 0 — putting the gallery back
   on top and inverting the entire change, silently. */
const orders = [...RULES.matchAll(/order:\s*([^;]+);/g)].map(m => m[1].trim());
check('every order value is an integer',
  orders.length > 0 && orders.every(v => /^-?\d+$/.test(v)),
  `non-integer: ${orders.filter(v => !/^-?\d+$/.test(v)).join(', ')}`);

const ord = sel => {
  const m = RULES.match(new RegExp('\\' + sel + '\\s*\\{[^}]*order:\\s*(-?\\d+)'));
  return m ? Number(m[1]) : null;
};
/* ⚠️ .detail-ctas IS NOT IN THIS LIST, AND MUST NOT BE. It is
   display:contents — it has no order of its own; its children carry the
   values (the add-to-cart form at 7, the wishlist at 8). Listing it here
   made ord() return null and the sequence check fail on a correct file. */
const seq = ['.detail-gallery', '.detail-badges', '.product-brand', '.detail-title',
             '.detail-price-row', '.detail-shipping', '.detail-qty',
             '.pdp-trust-bar'].map(x => [x, ord(x)]);

check('all eight ordered elements carry a value', seq.every(([, v]) => v !== null),
  seq.filter(([, v]) => v === null).map(([x]) => x).join(', '));

check('the sequence matches the mockup, strictly increasing',
  seq.every(([, v], i) => i === 0 || v > seq[i - 1][1]),
  seq.map(([x, v]) => `${x}=${v}`).join('  '));

/* ⚠️ THE HERO LEADS. An earlier draft put the buy box above the image,
   which strips the photo out of the opening screen on a $2,400 vanity.
   The mockup never asked for that — "hero 300→232px" means keep it. */
check('the product photo still leads the page',
  ord('.detail-gallery') === 1,
  'the image is what sells a vanity; it leads, it does not follow the button');

/* ⚠️ THE QTY STEPPER MUST LAND JUST BELOW THE TRUST ROW, NOT AT THE END.
   A draft used order:11, which sorts after the order:10 catch-all — on the
   live page the stepper landed at 2,948px, below the specifications table.
   Anyone wanting two units would have scrolled three thousand pixels. */
/* The stepper now shares a row with the button rather than following the
   trust row, so it carries the same order value as the add-to-cart form
   and grid places the two side by side. */
check('the stepper and the buy button share an order value',
  ord('.detail-qty') === 7,
  `qty=${ord('.detail-qty')} — it must sit on the button's row, not its own`);



/* ── 8. NOTHING LEAKS TO DESKTOP ────────────────────────────────────────
   The whole change is mobile-only by construction. One rule outside the
   media query would reach every product page at every width. */
section('desktop is untouched');

const outside = RULES.replace(/@media[^{]*\{[\s\S]*\}\s*$/, '').trim();
check('no rule sits outside the mobile media query', outside === '',
  `found outside the query: ${outside.slice(0, 120)}`);

/* The fold block itself must stay CSS-only. The expert CTA that follows
   is markup, and it carries its own <style> precisely so this guarantee
   survives — see the comment above that second block. */
check('the fold block adds no markup of its own',
  !/<(div|p|a|span|button)\b/.test(BLOCK),
  'the fold rework is CSS; markup belongs to the blocks after it');

/* ── 9. THE PRODUCT-EXPERT CALL ──────────────────────────────────────────
   Three things make this safe, and each has been got wrong once already in
   adjacent work: it must not render without a number, it must not render
   on out-of-stock pages, and the href must be dialable. */
section('the expert call is gated the way the owner chose');

check('it renders only when a phone number is set',
  /_expertPhone\s*=\s*String\(/.test(pdp) && /contact_phone/.test(pdp),
  'a tel: link to an empty string is worse than no control at all');

/* ⚠️ IN-STOCK ONLY. Owner decision, Option B of
   docs/mockups/expert_cta_out_of_stock_options.html: on an out-of-stock
   page the back-in-stock capture form is the single ask. */
check('it renders only on in-stock pages',
  /if\s*\(product\.inStock\s*&&\s*_expertPhone\)/.test(pdp),
  'Option B — the capture form is the only ask on out-of-stock pages');

check('non-dialable characters are stripped from the href',
  /href="tel:<%=\s*_expertPhone\.replace\(\/\[\^0-9\\+\]\/g, ''\)/.test(pdp) ||
  /_expertPhone\.replace\(\/\[\^0-9\+\]\/g,\s*''\)/.test(pdp),
  '(877) 777-1948 must become tel:8777771948');

check('the number is visible as text from the tablet band up',
  /\.pdp-expert-num\s*\{\s*display:\s*none/.test(pdp) &&
  /@media <%= _bpPdp\.mq\.tabletAndUp %>/.test(pdp),
  'a tel: link on a laptop may hand off to an app the visitor lacks');

check('the hours line is present',
  /pdp-expert-hours/.test(pdp),
  'a call button with no hours invites the 9pm call that rings out');

/* ── 9b. THE BUTTON MUST STAY ON ONE LINE ────────────────────────────────
   This gate cannot measure pixels — there is no browser here. What it CAN
   do is pin the three things that were decided BY measurement on the live
   page, so that changing any of them fails loudly and sends the next
   person back to re-measure rather than shipping a wrapped button.

   The measurements, taken on the deployed page at three widths. Usable
   inner width is about the viewport minus 92px:

     label "Questions? Call an expert."          213px
     the same label plus the 16px icon + 8px gap 237px
     former label "…Call a product expert."      274px
     proposed      "…Call our experts."          233px

     320px phone   228px available  → only the 213px label clears it
     360px Android 268px available
     375px iPhone  283px available

   The icon pushed the content past the button at every width and
   flex-wrap:wrap silently moved it to its own row — a 73px-tall button
   with the glyph stranded above the words, live, with every gate green. */
section('the call button cannot silently wrap again');

const CTA_MARKUP = (pdp.match(/<a class="btn btn-outline pdp-expert-cta[\s\S]*?<\/a>/) || [''])[0];

check('the call button contains no icon',
  CTA_MARKUP !== '' && !/<svg/.test(CTA_MARKUP),
  're-adding the icon costs 24px and overflows the 320px phone (237 > 228)');

check('the label is the measured one',
  /<span>Questions\? Call an expert\.<\/span>/.test(CTA_MARKUP),
  'this exact string measures 213px and clears the narrowest phone by 15px; ' +
  'any other wording has to be measured on the live page before it ships');

/* ⚠️ nowrap, NOT wrap. wrap is what hid the overflow: it rearranged the
   contents rather than letting anything look broken, so nothing failed
   and the button shipped two rows tall. */
check('the button does not wrap its contents',
  /\.pdp-expert-cta\s*\{[^}]*flex-wrap:\s*nowrap/.test(pdp) &&
  !/\.pdp-expert-cta\s*\{[^}]*flex-wrap:\s*wrap/.test(pdp),
  'wrap hides an overflow instead of showing it; nowrap makes it visible');

/* ── RESULT ──────────────────────────────────────────────────────────────── */
console.log();
if (failures) {
  console.error(`${RED}${failures} check(s) failed.${OFF}`);
  process.exit(1);
}
console.log(`${GRN}ALL PDP MOBILE FOLD GATES PASS${OFF}`);
