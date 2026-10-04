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
 * product data of any kind. It charges SHIPPING only and writes the two
 * chosen samples as $0.00 order lines. The catalogue price stays the
 * truth for anyone buying a sample outright.
 *
 * (There are already 3 inactive SWATCH- rows at $0.00 from an earlier
 * attempt at exactly that duplicate-SKU approach. They are excluded by
 * is_active = 1 and are the reason this does it differently.)
 *
 * ──────────────────────────────────────────────────────────────────────
 * WHY SHIPPING IS NOT FREE
 *
 * The owner's reasoning, recorded because it will look like an oversight
 * later: a fully free offer attracts people collecting free things. A
 * small real charge qualifies intent without being a profit centre —
 * and it must not LOOK like one, which is why it is 4.99 against a true
 * cost of about 8.00 rather than marked up.
 */

/* How many the customer gets at no charge. Enforced server-side in
   samplesController; the page's own limit is a convenience, not a
   control. */
const FREE_COUNT = 2;

/* Flat, and deliberately NOT rated. weight_lbs is NULL on all 69 sample
   SKUs and ships_ltl = 0, so there is nothing for the WWEX LTL rater to
   price even if it were appropriate — these go in an envelope. Never
   send a sample order down the freight-quote path. */
const SHIPPING = 4.99;

/* The samples category. Filtering is on category_id, NOT product_type:
   product_type is NULL on 66 of the 69 rows, so a product_type filter
   would silently return 3 items. */
const CATEGORY_ID = 10;

/* What the customer sees. One string per place, so the banner and the
   page cannot drift apart. */
const COPY = {
  eyebrow:  'See it in your own light',
  headline: `Pick ${FREE_COUNT} free samples`,
  sub:      `Any ${FREE_COUNT} wood, stone or metal samples — free. `
          + `Just $${SHIPPING.toFixed(2)} shipping, which is less than it `
          + `costs us to send them.`,
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
  FREE_COUNT, SHIPPING, CATEGORY_ID, COPY, SIGNUP_SOURCE, ORDER_SOURCE,
};
