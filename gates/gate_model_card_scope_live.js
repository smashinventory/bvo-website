'use strict';
/* Gate: model cards, checked against the RENDERED PAGE.  2026-09-29
 *
 * ── WHY THIS ONE MATTERS MOST ─────────────────────────────────────────
 *
 * Three fixes for "mirrors are in the vanity cards" all held at the
 * source level and all came back, because each time a NEW query took over
 * part of the card and started from no filter. A static gate reads the
 * queries that exist today; it is structurally blind to the one written
 * next year.
 *
 * This gate reads the page a shopper sees and checks an invariant that
 * does not care how the card was built:
 *
 *     A model card's hero price must lie inside the real price range of
 *     that model WITHIN THE CATEGORY THE PAGE IS SHOWING.
 *
 * On 2026-09-29 the Bristol card on /collections/vanity-models showed
 * $388 — a mirror, sitting correctly in the mirrors category — while
 * Bristol's real range in bathroom-vanities is $1,608-$4,237. Outside the
 * range by a factor of four. This gate would have failed on the day the
 * hero function landed, and on the day in July before it existed.
 *
 * Both numbers come from the site itself: the card price from the model
 * page, the range from that model's own product listing. No database
 * access and no fixtures to drift out of date.
 *
 * ── WHEN IT CANNOT RUN ────────────────────────────────────────────────
 * It needs a reachable site. If the host is down or unreachable it exits
 * NON-ZERO rather than passing quietly: "could not check" is not "fine",
 * and a gate that passes when it did nothing is worse than no gate.
 * Set BVO_BASE to point at a different host.
 */

const BASE = process.env.BVO_BASE
  || 'https://slategrey-falcon-350174.hostingersite.com';

/* Pages that render model cards, with the product category each one is
   showing. The listing URL is how the real range is measured — it must
   be the SAME category the model page draws from. */
const PAGES = [
  { name: 'vanity-models (no type filter — where it broke)',
    model: '/collections/vanity-models?brand=James+Martin+Vanities',
    listing: '/collections/bathroom-vanities' },
  { name: 'vanity-models + Cabinet Only',
    model: '/collections/vanity-models?brand=James+Martin+Vanities&type=Single+Sink+Cabinet+Only',
    listing: '/collections/bathroom-vanities?type=Single+Sink+Cabinet+Only' },
  { name: 'bathroom-vanity-cabinets',
    model: '/collections/bathroom-vanity-cabinets?brand=James+Martin+Vanities',
    listing: '/collections/bathroom-vanities?type=Single+Sink+Cabinet+Only&type=Double+Sink+Cabinet+Only' },
  { name: 'bathroom-vanities-with-tops',
    model: '/collections/bathroom-vanities-with-tops?brand=James+Martin+Vanities',
    listing: '/collections/bathroom-vanities?type=Single+Sink+Vanity+With+Top&type=Double+Sink+Vanity+With+Top' },
];

/* Cards to check per page. Every card would be thorough and slow; the
   leak has never been model-specific, so a sample of the first few finds
   it. Raise if a regression ever hides past the sample. */
const CARDS_PER_PAGE = 4;
const LISTING_PAGES  = 6;   // pages of the product listing to scan for the range

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

async function get(pathname) {
  const res = await fetch(BASE + pathname, { headers: { 'cache-control': 'no-cache' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${pathname}`);
  return res.text();
}

/* Deliberately regex, not a DOM library: this gate must not acquire a
   dependency that could itself drift or fail to install on the host. */
const cardBlocks = html =>
  html.split(/<article[^>]*class="[^"]*model-card/).slice(1);

const money = s => {
  const m = /\$([\d,]+(?:\.\d+)?)/.exec(s);
  return m ? parseFloat(m[1].replace(/,/g, '')) : null;
};

function cardName(block) {
  const m = /The ([A-Za-z0-9''\- ]+?) Collection/.exec(block);
  return m ? m[1].trim() : null;
}

/* Every price on a product card in the listing, so we can bound the model. */
function listingPrices(html) {
  const out = [];
  for (const b of html.split(/<article[^>]*class="[^"]*product-card/).slice(1)) {
    const m = /class="card-price__(?:sale|regular)"[^>]*>\s*\$([\d,]+(?:\.\d+)?)/.exec(b);
    if (m) out.push(parseFloat(m[1].replace(/,/g, '')));
  }
  return out;
}

(async () => {
  console.log(`--- live model-card scope check against ${BASE} ---\n`);

  try {
    await get('/');
  } catch (err) {
    console.log(`  FAIL site unreachable (${err.message})`);
    console.log('\n*** GATE COULD NOT RUN — treated as a FAILURE on purpose. ***');
    console.log('    "Could not check" is not "fine". Set BVO_BASE or bring the host up.');
    process.exit(1);
  }

  for (const page of PAGES) {
    console.log(`--- ${page.name} ---`);
    let html;
    try { html = await get(page.model); }
    catch (err) { ok(`page loads`, false, err.message); continue; }

    const blocks = cardBlocks(html).slice(0, CARDS_PER_PAGE);
    ok(`page renders model cards`, blocks.length > 0,
       'no .model-card found — the selector or the template changed, and every ' +
       'assertion below would silently pass on an empty list');

    for (const block of blocks) {
      const model = cardName(block);
      const price = money(block);
      if (!model || price == null) {
        ok('  card exposes a name and a price', false,
           `parsed name=${model} price=${price} — cannot check this card`);
        continue;
      }

      /* The model's REAL range, from the same category the page shows. */
      const prices = [];
      for (let p = 1; p <= LISTING_PAGES; p++) {
        const sep = page.listing.includes('?') ? '&' : '?';
        let lh;
        try {
          lh = await get(`${page.listing}${sep}model=${encodeURIComponent(model)}` +
                         `&brand=James%20Martin%20Vanities&page=${p}`);
        } catch { break; }
        const batch = listingPrices(lh);
        if (!batch.length) break;
        prices.push(...batch);
      }

      if (!prices.length) {
        /* A model card whose model has NO products in the page's own
           category is itself the defect — that card should not exist. */
        ok(`  ${model}: exists in this category`, false,
           'the card is rendered but the model has no products in the category ' +
           'the page is scoped to');
        continue;
      }

      const lo = Math.min(...prices), hi = Math.max(...prices);
      /* 1% tolerance: the card rounds to whole dollars for display. */
      const within = price >= lo * 0.99 && price <= hi * 1.01;
      ok(`  ${model}: hero $${price} inside category range $${lo}-$${hi}`, within,
         `hero is OUTSIDE the range — it is being drawn from a product in ` +
         `another category or type (this is the mirror-in-the-vanity-card bug)`);
    }
    console.log('');
  }

  console.log(fail ? `*** ${fail} GATE(S) FAILED ***` : 'ALL GATES PASS');
  process.exit(fail ? 1 : 0);
})().catch(err => {
  console.error('\n*** GATE CRASHED ***', err);
  process.exit(1);
});
