'use strict';

/**
 * sampleOffer.js — the one place the sample offer's numbers live.
 *
 * Every figure the customer is shown and every figure they are charged
 * comes from here. The offer appears in at least four places (the banner
 * under the hero, the picker page, the confirmation, the email), and an
 * offer that says "2 free" on the banner and lets you pick 3 on the page
 * is worse than no offer.
 *
 * ──────────────────────────────────────────────────────────────────────
 * THE SAMPLES ARE $9.99 IN THE CATALOGUE AND THAT IS NOT CHANGED.
 *
 * All 69 live at category_id = 10, is_active = 1, price 9.99. This offer
 * does NOT edit them, does not add $0 duplicates, and does not touch
 * product data of any kind. It writes the first two chosen samples as
 * $0.00 order lines and sells any extras at list. The catalogue price
 * stays the truth for anyone buying a sample outright.
 *
 * (There are already 3 inactive SWATCH- rows at $0.00 from an earlier
 * attempt at exactly that duplicate-SKU approach. They are excluded by
 * is_active = 1 and are the reason this does it differently.)
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHAT STOPS PEOPLE TAKING FREE SAMPLES FOREVER
 *
 * Not a shipping charge. An earlier draft used $4.99 shipping as a
 * qualifier; the owner dropped it, correctly, because BVO advertises
 * free shipping on every other page and charging for one cart type
 * contradicts that.
 *
 * The limit is ONE REDEMPTION PER EMAIL AND PER MAILING ADDRESS, held in
 * sample_redemptions as two unique indexes. The address half is the one
 * that bites: a new email is free to make, a new house is not. Beyond
 * the first two, extras are simply sold at the catalogue price.
 */

/* How many the customer gets at no charge. Enforced server-side in
   samplesController; the page's own limit is a convenience, not a
   control. */
const FREE_COUNT = 2;

/* What an EXTRA sample costs — the catalogue price, unchanged. Read from
   the product row at add-to-cart time, not from here; this constant
   exists only so the page can say the number in prose without a second
   query. If the catalogue price ever changes, change it there and here.
 *
 * ⚠️ THERE IS NO SHIPPING CONSTANT, and its absence is deliberate. An
 * earlier draft charged $4.99 shipping on a samples-only cart. The owner
 * removed it: BVO advertises free shipping everywhere, so charging for
 * one cart type contradicts the promise on every other page. The whole
 * shipping concept is therefore untouched by this offer — no
 * samples-only test in the totals code, nothing to get wrong. If someone
 * reintroduces a shipping charge here, they are reopening that. */
const EXTRA_PRICE = 9.99;

/* The samples category. Filtering is on category_id, NOT product_type:
   product_type is NULL on 66 of the 69 rows, so a product_type filter
   would silently return 3 items. */
const CATEGORY_ID = 10;

/* What the customer sees. One string per place, so the banner and the
   page cannot drift apart. */
const COPY = {
  eyebrow:  'See it in your own light',
  headline: `Pick ${FREE_COUNT} free samples`,
  sub:      `Any ${FREE_COUNT} wood, stone or metal samples, free, with `
          + `free shipping. Want more? Extras are $${EXTRA_PRICE.toFixed(2)} each.`,
  cta:      'Choose your samples',
  /* Said plainly on the page. A screen finish is not a real finish, and
     the honest version of this offer is the persuasive one. */
  why:      'Screens lie about colour. Wood grain and stone veining look '
          + 'different under your own bathroom light than they do on a '
          + 'phone, and a vanity is not something you want to guess at.',
};

/* The signup_source recorded when a sample request creates an account.
   MUST be a key in config/signupSources.js or attribution silently
   becomes 'Unknown' — that file is the closed vocabulary. */
const SIGNUP_SOURCE = 'sample_request';

/* Stamped on orders.order_source so these are separable in the admin and
   in the customer analytics without adding a column. */
const ORDER_SOURCE = 'sample_request';

module.exports = {
  FREE_COUNT, EXTRA_PRICE, CATEGORY_ID, COPY, SIGNUP_SOURCE, ORDER_SOURCE,
};
