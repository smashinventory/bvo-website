'use strict';

/* siteAnalyticsController.js — the storefront funnel, from first-party data.
 *
 * SOURCES, AND WHY EACH ONE:
 *   site_events  view_item, add_to_cart, begin_checkout. Recorded
 *                server-side, so ad-blockers cannot thin them.
 *   orders       purchases and revenue. ALWAYS. Money has one source of
 *                truth and it is not an events table - a second purchase
 *                row would eventually disagree with the one that got
 *                charged, and the dashboard would be the last to know.
 *
 * NOT HERE: sessions, visitors, time on page, traffic sources. Those are
 * GA4's, which already collects them automatically, and they arrive in a
 * later phase through the GA4 Data API. Rebuilding them first-party would
 * mean re-implementing bot filtering and session stitching that GA already
 * does, and writing a row per page view on shared hosting.
 *
 * EVERY QUERY FILTERS is_bot = 0. The bot rows are kept rather than
 * dropped so the share is reportable - a sudden crawl is worth seeing, and
 * a funnel that silently excluded it would just look like a quiet day.
 */

const { bvoPool } = require('../config/database');
const siteEvents  = require('../services/siteEvents');
const ga4         = require('../services/ga4');

/* Orders are authoritative, and the same two conditions the customer
   analytics page uses. Kept identical on purpose: two pages reporting
   "orders" by different rules is how a number becomes untrustworthy. */
const O_OK = "o.is_test = 0 AND o.status <> 'cancelled'";

function windowDays(raw) {
  const n = parseInt(raw, 10);
  return [7, 30, 90, 365].includes(n) ? n : 30;
}

/* ── the funnel, as counts of DISTINCT SESSIONS ──────────────────────────
   Sessions, not raw events. Counting raw events makes the funnel widen at
   the top for the wrong reason: one shopper reloading a product page six
   times is one person considering one vanity, not six views worth of
   intent, and the view→cart rate would fall every time someone browsed
   carefully. Distinct sessions is the number a human means by "how many
   people got this far". */
async function funnel(days) {
  const [[ev]] = await bvoPool.query(
    `SELECT
       COUNT(DISTINCT CASE WHEN event_name = 'view_item'      THEN session_id END) AS viewed,
       COUNT(DISTINCT CASE WHEN event_name = 'add_to_cart'    THEN session_id END) AS carted,
       COUNT(DISTINCT CASE WHEN event_name = 'begin_checkout' THEN session_id END) AS checkout,
       COUNT(*)                                                                    AS raw_events
     FROM site_events
     WHERE is_bot = 0
       AND occurred_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [days]
  );

  const [[ord]] = await bvoPool.query(
    `SELECT COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS revenue
       FROM orders o
      WHERE ${O_OK}
        AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [days]
  );

  const viewed   = Number(ev.viewed)   || 0;
  const carted   = Number(ev.carted)   || 0;
  const checkout = Number(ev.checkout) || 0;
  const orders   = Number(ord.orders)  || 0;

  /* Rates are null, not 0, when the denominator is empty. "0%" reads as a
     measured failure; an empty cell reads as "nothing to measure yet",
     which is the truth on a freshly instrumented site. */
  const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

  return {
    viewed, carted, checkout, orders,
    revenue:      Number(ord.revenue) || 0,
    rawEvents:    Number(ev.raw_events) || 0,
    viewToCart:   pct(carted,   viewed),
    cartToCheck:  pct(checkout, carted),
    checkToOrder: pct(orders,   checkout),
    viewToOrder:  pct(orders,   viewed),
  };
}

/* Daily series for the chart. LEFT JOINed off a generated day spine so a
   day with no events is a zero on the line rather than a gap the chart
   silently closes up, which would make a dead weekend look like a slope. */
async function daily(days) {
  const [rows] = await bvoPool.query(
    `SELECT DATE(occurred_at) AS day,
            COUNT(DISTINCT CASE WHEN event_name = 'view_item'   THEN session_id END) AS viewed,
            COUNT(DISTINCT CASE WHEN event_name = 'add_to_cart' THEN session_id END) AS carted
       FROM site_events
      WHERE is_bot = 0
        AND occurred_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(occurred_at)
      ORDER BY day`,
    [days]
  );
  const [ords] = await bvoPool.query(
    `SELECT DATE(o.created_at) AS day, COUNT(*) AS orders
       FROM orders o
      WHERE ${O_OK}
        AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(o.created_at)
      ORDER BY day`,
    [days]
  );

  const byDay = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    byDay.set(d.toISOString().slice(0, 10), { viewed: 0, carted: 0, orders: 0 });
  }
  const key = v => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
  rows.forEach(r => { const k = key(r.day); if (byDay.has(k)) Object.assign(byDay.get(k), { viewed: +r.viewed, carted: +r.carted }); });
  ords.forEach(r => { const k = key(r.day); if (byDay.has(k)) byDay.get(k).orders = +r.orders; });

  return [...byDay.entries()].map(([day, v]) => ({ day, ...v }));
}

/* What people actually put in the cart. Joined to products for the name so
   the table is readable without a second lookup; LEFT JOIN so a deleted
   product still shows its adds rather than vanishing from history. */
async function topAdded(days, limit = 15) {
  const [rows] = await bvoPool.query(
    `SELECT e.product_id,
            COALESCE(p.name, CONCAT('#', e.product_id)) AS name,
            p.slug,
            COUNT(*)                        AS adds,
            COUNT(DISTINCT e.session_id)    AS sessions,
            SUM(e.qty)                      AS units,
            ROUND(SUM(e.value_cents) / 100, 2) AS value
       FROM site_events e
       LEFT JOIN products p ON p.id = e.product_id
      WHERE e.is_bot = 0
        AND e.event_name = 'add_to_cart'
        AND e.occurred_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY e.product_id, p.name, p.slug
      ORDER BY adds DESC
      LIMIT ?`,
    [days, limit]
  );
  return rows;
}

/* Viewed a lot, carted rarely. The most actionable table on the page:
   these are the products where the listing is doing its job and something
   after it is not - price, photography, stock message. Floored at 20 views
   so a product seen twice and carted never cannot top the list. */
async function viewedNotCarted(days, limit = 15) {
  const [rows] = await bvoPool.query(
    `SELECT v.product_id,
            COALESCE(p.name, CONCAT('#', v.product_id)) AS name,
            p.slug,
            v.views,
            COALESCE(c.adds, 0) AS adds,
            ROUND(COALESCE(c.adds, 0) / v.views * 100, 1) AS rate
       FROM (SELECT product_id, COUNT(DISTINCT session_id) AS views
               FROM site_events
              WHERE is_bot = 0 AND event_name = 'view_item'
                AND occurred_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                AND product_id IS NOT NULL
              GROUP BY product_id) v
       LEFT JOIN (SELECT product_id, COUNT(DISTINCT session_id) AS adds
                    FROM site_events
                   WHERE is_bot = 0 AND event_name = 'add_to_cart'
                     AND occurred_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
                   GROUP BY product_id) c ON c.product_id = v.product_id
       LEFT JOIN products p ON p.id = v.product_id
      WHERE v.views >= 20
      ORDER BY rate ASC, v.views DESC
      LIMIT ?`,
    [days, days, limit]
  );
  return rows;
}

/* Reported, not hidden. A crawl that triples the event table is something
   the owner should see, and it explains an otherwise baffling quiet day. */
async function botShare(days) {
  const [[r]] = await bvoPool.query(
    `SELECT SUM(is_bot = 1) AS bot, COUNT(*) AS total
       FROM site_events
      WHERE occurred_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [days]
  );
  const total = Number(r.total) || 0;
  return { bot: Number(r.bot) || 0, total,
           pct: total > 0 ? Math.round((Number(r.bot) / total) * 1000) / 10 : null };
}

/* How much history exists. Without this the page cannot distinguish "no
   one added to cart" from "we started recording an hour ago", and the
   first thing anyone does with a new dashboard is misread exactly that. */
async function coverage() {
  const [[r]] = await bvoPool.query(
    `SELECT MIN(occurred_at) AS first_event, COUNT(*) AS n FROM site_events`
  );
  return { firstEvent: r.first_event, total: Number(r.n) || 0 };
}

exports.dashboard = async (req, res, next) => {
  try {
    /* The table may not exist yet on a server that has not taken a single
       event. Create it here too so the page renders empty rather than 500s
       on its first visit. */
    await siteEvents.ensureTable();

    const days = windowDays(req.query.days);
    /* GA4 joins the same Promise.all rather than being awaited after it:
       it is a network round trip and the four local queries should not sit
       waiting on it. ga4.traffic() resolves to {ok:false} instead of
       rejecting, so a dead or unconfigured GA cannot take the page down -
       the first-party funnel is ours and must render regardless. */
    const [f, series, added, leaking, bots, cov, traffic] = await Promise.all([
      funnel(days), daily(days), topAdded(days), viewedNotCarted(days),
      botShare(days), coverage(), ga4.traffic(days),
    ]);

    res.render('pages/admin/marketing/site-analytics', {
      pageTitle: 'Site Analytics',
      path:      req.originalUrl,
      days, funnel: f, series, topAdded: added,
      viewedNotCarted: leaking, bots, coverage: cov,
      traffic,
      gaConfigured: ga4.config().ready,
    });
  } catch (err) { next(err); }
};
