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
const CSS = (BLOCK.match(/<style[^>]*>([\s\S]*?)<\/style>/) || ['', ''])[1];

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

check('the breadcrumb is held to one line',
  /\.breadcrumb\s*\{[^}]*white-space:\s*nowrap/.test(BLOCK));

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

/* ── RESULT ──────────────────────────────────────────────────────────────── */
console.log();
if (failures) {
  console.error(`${RED}${failures} check(s) failed.${OFF}`);
  process.exit(1);
}
console.log(`${GRN}ALL PDP MOBILE FOLD GATES PASS${OFF}`);
