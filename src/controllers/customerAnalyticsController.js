'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   customerAnalyticsController.js — the customer record, and what it means.
   Added 2026-10-04. Requires migrations/2026-10-04_customer_analytics.sql.

   ── THE TWO RULES THIS FILE EXISTS TO HOLD ─────────────────────────────

   1. TEST RECORDS ARE NEVER COUNTED. Every customer and order in the
      database on 2026-10-04 was pre-cutover testing, and counted as real
      they would report an AOV of $3,495 and a 100% account-order rate that
      describe nobody. Exclusion is not optional and not per-query
      judgement: REAL_CUSTOMER and REAL_ORDER below are the only way this
      file is allowed to name those tables.

   2. A REPORT THAT LACKS THE DATA SAYS SO. It does not draw the chart
      anyway. Cohort retention over nine customers is not a small signal,
      it is noise wearing the costume of a finding — and a chart is read as
      a claim whether or not the number under it is sound. Every report
      returns { sufficient, need, ... } and the view renders the shortfall
      instead of the graphic.

      The thresholds below are judgement, not arithmetic, and they are
      deliberately low enough to clear within months rather than years.
      They exist to stop a panel asserting something before the data can
      support it — not to be precise.
   ═══════════════════════════════════════════════════════════════════════ */

const { bvoPool }  = require('../config/database');
const SIGNUP_SRC   = require('../config/signupSources');
const brevo        = require('../services/brevoService');   // listTemplates, for the outreach panel

/* The ONLY permitted references to these tables in analytics. Written as
   fragments rather than repeated by hand so a new report cannot quietly
   omit the filter — and so the gate can assert no raw `FROM customers`
   survives in this file. */
const REAL_CUSTOMER = 'customers c';
const REAL_ORDER    = 'orders o';
const C_OK          = 'c.is_test = 0';

/* ⚠️ O_OK USED TO BE THE WHOLE STORY, AND IT WAS WRONG.
   It read:

       o.is_test = 0 AND o.status <> 'cancelled'

   — which excludes test rows and cancellations and nothing else. A checkout
   that is started and abandoned leaves status='pending',
   payment_status='pending' (checkoutController:1522), so every abandoned
   attempt counted as an order AND as revenue.

   Customer 11 read "3 orders, $1,971" having paid nothing: three attempts
   at the same $657 purchase on 2026-10-05, all of which failed because
   checkout itself was broken. Every figure on this page inherited it.

   The definition now lives in src/config/revenue.js, because it was
   duplicated across eight queries in five controllers and they did not
   agree.

   ⚠️ ONE RULE, NOT TWO. The owner's instruction, 2026-10-19: "both the
   units and the revenue do not count until the authorization is captured."
   So O_OK is capture-gated and every figure on this page — counts and
   dollars alike — moves together. An order awaiting capture appears
   nowhere, by design; IS_AUTHORIZED reports that separately. */
const revenue    = require('../config/revenue');
const REV        = revenue.O;
const O_OK = REV.IS_COUNTED;

/* Minimums before a panel is allowed to draw. See rule 2. */
const NEED = {
  trend:      { customers: 10,  label: '10 customers' },
  sources:    { customers: 10,  label: '10 customers with a recorded source' },
  repeat:     { customers: 25,  label: '25 customers' },
  ltv:        { orders:    25,  label: '25 orders' },
  cohort:     { customers: 100, months: 3, label: '100 customers and 3 months of history' },
};

const num = v => (v == null ? 0 : Number(v));

/* ── KPI strip ──────────────────────────────────────────────────────────
   Numbers that are honest at ANY size, including zero. No averages over
   tiny denominators: a "repeat rate" computed from three customers is a
   number that will mislead, so it lives in the reports with a threshold. */
async function kpis() {
  const [[c]] = await bvoPool.query(`
    SELECT COUNT(*) AS customers,
           SUM(c.created_at >= NOW() - INTERVAL  7 DAY) AS new_7d,
           SUM(c.created_at >= NOW() - INTERVAL 30 DAY) AS new_30d,
           SUM(c.email_verified_at IS NOT NULL)          AS verified,
           SUM(c.accepts_marketing = 1)                  AS opted_in
      FROM ${REAL_CUSTOMER} WHERE ${C_OK}`);

  /* Counts and revenue share one WHERE, so they cannot disagree about
     which orders are real. awaiting_capture is measured SEPARATELY, over
     the orders this predicate excludes — it is money held, not earned, and
     is never added to revenue. */
  const [[o]] = await bvoPool.query(`
    SELECT COUNT(*)                        AS orders,
           COALESCE(SUM(o.total), 0)       AS revenue,
           SUM(o.customer_id IS NULL)      AS guest_orders
      FROM ${REAL_ORDER} WHERE ${O_OK}`);

  const [[auth]] = await bvoPool.query(`
    SELECT COUNT(*)                  AS orders,
           COALESCE(SUM(o.total), 0) AS value
      FROM ${REAL_ORDER} WHERE ${REV.IS_AUTHORIZED}`);

  /* Engagement. Right now both are zero, and that is the single most
     useful fact on the page: it says whether the save mechanisms are being
     used at all. Reported as counts, never as a rate over a tiny base. */
  const [[e]] = await bvoPool.query(`
    SELECT (SELECT COUNT(*) FROM favorites)      AS favorites,
           (SELECT COUNT(*) FROM saved_bundles)  AS saved_bundles`);

  const orders = num(o.orders);
  return {
    customers:  num(c.customers),
    new7d:      num(c.new_7d),
    new30d:     num(c.new_30d),
    verified:   num(c.verified),
    optedIn:    num(c.opted_in),
    orders,
    revenue:    num(o.revenue),
    guestOrders: num(o.guest_orders),
    /* ⚠️ REPORTED, NEVER ADDED IN. Money authorized and not yet captured.
       It is shown under the revenue figure so an order in progress is
       visible rather than simply missing — but it is not revenue and the
       two must never be summed. */
    awaitingCapture: num(auth.value),
    awaitingOrders:  num(auth.orders),
    /* AOV over the SAME population as revenue: both capture-gated, so the
       divisor and the dividend always describe the same orders. Dividing
       captured revenue by a count that included authorizations would
       understate it. */
    aov:        orders ? num(o.revenue) / orders : null,
    favorites:  num(e.favorites),
    bundles:    num(e.saved_bundles),
  };
}

/* ── Signups and orders over time ───────────────────────────────────── */
async function trend(days = 90) {
  const [[{ n }]] = await bvoPool.query(
    `SELECT COUNT(*) AS n FROM ${REAL_CUSTOMER} WHERE ${C_OK}`);
  if (num(n) < NEED.trend.customers) {
    return { sufficient: false, need: NEED.trend.label, have: num(n), rows: [] };
  }
  const [rows] = await bvoPool.query(`
    SELECT d.day,
           COALESCE(s.signups, 0) AS signups,
           COALESCE(x.orders,  0) AS orders
      FROM (SELECT DATE(c.created_at) AS day FROM ${REAL_CUSTOMER} WHERE ${C_OK}
            UNION
            SELECT DATE(o.created_at) FROM ${REAL_ORDER} WHERE ${O_OK}) d
      LEFT JOIN (SELECT DATE(c.created_at) day, COUNT(*) signups
                   FROM ${REAL_CUSTOMER} WHERE ${C_OK} GROUP BY 1) s ON s.day = d.day
      LEFT JOIN (SELECT DATE(o.created_at) day, COUNT(*) orders
                   FROM ${REAL_ORDER} WHERE ${O_OK} GROUP BY 1) x ON x.day = d.day
     WHERE d.day >= CURDATE() - INTERVAL ? DAY
     ORDER BY d.day`, [days]);
  return { sufficient: true, rows };
}

/* ── Where customers came from ──────────────────────────────────────── */
async function sources() {
  const [rows] = await bvoPool.query(`
    SELECT COALESCE(c.signup_source, '') AS src, COUNT(*) AS n
      FROM ${REAL_CUSTOMER} WHERE ${C_OK} GROUP BY 1 ORDER BY n DESC`);
  const total = rows.reduce((a, r) => a + num(r.n), 0);
  /* Attribution only started on 2026-10-04. Customers created before it
     have no source and never will — shown as Unknown rather than guessed. */
  const known = rows.filter(r => SIGNUP_SRC.clean(r.src)).reduce((a, r) => a + num(r.n), 0);
  if (known < NEED.sources.customers) {
    return { sufficient: false, need: NEED.sources.label, have: known, rows: [] };
  }
  return {
    sufficient: true,
    rows: rows.map(r => ({
      key:   SIGNUP_SRC.clean(r.src),
      label: SIGNUP_SRC.label(r.src),
      n:     num(r.n),
      pct:   total ? (num(r.n) / total) * 100 : 0,
    })),
  };
}

/* ── First-time vs returning ────────────────────────────────────────── */
async function repeatRate() {
  const [[{ n }]] = await bvoPool.query(
    `SELECT COUNT(*) AS n FROM ${REAL_CUSTOMER} WHERE ${C_OK}`);
  if (num(n) < NEED.repeat.customers) {
    return { sufficient: false, need: NEED.repeat.label, have: num(n) };
  }
  const [[r]] = await bvoPool.query(`
    SELECT SUM(k.orders = 1) AS one_time, SUM(k.orders > 1) AS repeat_buyers
      FROM (SELECT o.customer_id, COUNT(*) AS orders
              FROM ${REAL_ORDER} WHERE ${O_OK} AND o.customer_id IS NOT NULL
             GROUP BY o.customer_id) k`);
  const one = num(r.one_time), rep = num(r.repeat_buyers);
  return { sufficient: true, oneTime: one, repeat: rep,
           rate: (one + rep) ? (rep / (one + rep)) * 100 : 0 };
}

/* ── Lifetime value ─────────────────────────────────────────────────── */
async function ltv() {
  const [[{ n }]] = await bvoPool.query(
    `SELECT COUNT(*) AS n FROM ${REAL_ORDER} WHERE ${O_OK}`);
  if (num(n) < NEED.ltv.orders) {
    return { sufficient: false, need: NEED.ltv.label, have: num(n), rows: [] };
  }
  const [rows] = await bvoPool.query(`
    SELECT CASE WHEN spend <   1000 THEN 'Under $1k'
                WHEN spend <   2500 THEN '$1k – $2.5k'
                WHEN spend <   5000 THEN '$2.5k – $5k'
                WHEN spend <  10000 THEN '$5k – $10k'
                ELSE '$10k+' END AS band,
           COUNT(*) AS customers, ROUND(AVG(spend), 2) AS avg_spend
      FROM (SELECT o.customer_id, SUM(o.total) AS spend
              FROM ${REAL_ORDER} WHERE ${O_OK} AND o.customer_id IS NOT NULL
             GROUP BY o.customer_id) t
     GROUP BY band ORDER BY MIN(spend)`);
  return { sufficient: true, rows };
}

/* ── Cohort retention ───────────────────────────────────────────────────
   The heaviest ask in the suite and the one most often shipped empty.
   Needs BOTH a population and elapsed time: 100 customers all acquired
   last week still cannot show month-3 retention, because month 3 has not
   happened. Both are checked. */
async function cohorts() {
  const [[c]] = await bvoPool.query(`
    SELECT COUNT(*) AS n,
           TIMESTAMPDIFF(MONTH, MIN(c.created_at), NOW()) AS months
      FROM ${REAL_CUSTOMER} WHERE ${C_OK}`);
  if (num(c.n) < NEED.cohort.customers || num(c.months) < NEED.cohort.months) {
    return { sufficient: false, need: NEED.cohort.label,
             have: `${num(c.n)} customers, ${num(c.months)} month(s) of history`, rows: [] };
  }
  const [rows] = await bvoPool.query(`
    SELECT DATE_FORMAT(c.created_at, '%Y-%m') AS cohort,
           TIMESTAMPDIFF(MONTH, c.created_at, o.created_at) AS month_n,
           COUNT(DISTINCT o.customer_id) AS buyers
      FROM ${REAL_CUSTOMER}
      JOIN ${REAL_ORDER} ON o.customer_id = c.id AND ${O_OK}
     WHERE ${C_OK}
     GROUP BY cohort, month_n
     ORDER BY cohort, month_n`);
  return { sufficient: true, rows };
}

/* ── Customer list ──────────────────────────────────────────────────────
   Searchable and paginated from the first row, because this is the screen
   that stays useful at every size — it is the one Shopify users open most,
   and it is a list, not a chart. */
async function list({ q = '', page = 1, perPage = 50, sort = 'recent' } = {}) {
  const where = [C_OK];
  const args  = [];
  if (q) {
    where.push('(c.email LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like, like);
  }
  const ORDER = {
    recent: 'c.created_at DESC',
    spend:  'total_spent DESC',
    orders: 'order_count DESC',
    email:  'c.email ASC',
  }[sort] || 'c.created_at DESC';

  const [[{ n }]] = await bvoPool.query(
    `SELECT COUNT(*) AS n FROM ${REAL_CUSTOMER} WHERE ${where.join(' AND ')}`, args);

  const offset = Math.max(0, (Number(page) - 1) * perPage);
  const [rows] = await bvoPool.query(`
    SELECT c.id, c.email, c.first_name, c.last_name, c.created_at,
           c.signup_source, c.accepts_marketing,
           c.email_verified_at IS NOT NULL AS verified,
           /* The JOIN itself is capture-gated, so order_count, total_spent
              and last_order_at all describe the same set of orders. A
              customer whose only order is awaiting capture reads as zero
              orders and $0 — which is the rule, applied consistently. */
           COUNT(o.id)                AS order_count,
           COALESCE(SUM(o.total), 0)  AS total_spent,
           MAX(o.created_at)          AS last_order_at
      FROM ${REAL_CUSTOMER}
      LEFT JOIN ${REAL_ORDER} ON o.customer_id = c.id AND ${O_OK}
     WHERE ${where.join(' AND ')}
     GROUP BY c.id
     ORDER BY ${ORDER}
     LIMIT ? OFFSET ?`, [...args, perPage, offset]);

  return {
    rows: rows.map(r => ({ ...r, source_label: SIGNUP_SRC.label(r.signup_source) })),
    total: num(n),
    page: Number(page),
    pages: Math.max(1, Math.ceil(num(n) / perPage)),
  };
}

/* ── GET /admin/marketing/customers ─────────────────────────────────── */
exports.dashboard = async (req, res) => {
  try {
    const [k, t, s, rr, l, co, listing] = await Promise.all([
      kpis(), trend(), sources(), repeatRate(), ltv(), cohorts(),
      list({ q: req.query.q || '', page: req.query.page || 1, sort: req.query.sort || 'recent' }),
    ]);

    /* Test records are excluded everywhere above, so the page says how many
       it is ignoring. A dashboard that silently drops rows is one nobody
       can reconcile against the database. */
    const [[x]] = await bvoPool.query(`
      SELECT (SELECT COUNT(*) FROM customers WHERE is_test = 1) AS customers,
             (SELECT COUNT(*) FROM orders    WHERE is_test = 1) AS orders`);

    return res.render('pages/admin/marketing/customers', {
      pageTitle: 'Customers | BVO Admin',
      layout:    'layouts/admin',
      kpis: k, trend: t, sources: s, repeatRate: rr, ltv: l, cohorts: co,
      listing,
      excluded: { customers: num(x.customers), orders: num(x.orders) },
      q:    req.query.q    || '',
      sort: req.query.sort || 'recent',
    });
  } catch (err) {
    console.error('[customerAnalytics.dashboard]', err);
    /* There is no pages/admin/error.ejs in this codebase — rendering one
       would 500 inside the 500 handler and show a blank page. Plain text is
       ugly and unambiguous, which is the right trade for an admin screen
       nobody browses to by accident. */
    return res.status(500).type('text/plain').send(
      'Unable to load customer analytics.' +
      (process.env.NODE_ENV === 'production' ? '' : '\n\n' + err.stack));
  }
};

/* ── GET /admin/marketing/customers/:id ─────────────────────────────── */
exports.detail = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/marketing/customers');

    /* No is_test filter HERE, on purpose. The list is analytics; this is the
       record. Being able to open a test account is how it gets recognised
       as one — and how the flag gets set. */
    const [[customer]] = await bvoPool.query(
      'SELECT * FROM customers WHERE id = ? LIMIT 1', [id]);
    if (!customer) return res.redirect('/admin/marketing/customers');

    const [orders] = await bvoPool.query(`
      /* ⚠️ payment_status AND payment_captured_at ARE REQUIRED HERE.
         The spent total below is computed in JavaScript with
         revenue.isCounted(), which reads both. Omit them and every row has
         payment_captured_at === undefined, isCounted() returns false for
         everything, and the page shows $0 for a customer who has paid —
         silently, with no error.

         That is the same undefined-column trap that produced the checkout
         409 and the NULL payment intent in order_deletions. If you add a
         column to the predicate, add it to this SELECT. */
      SELECT o.id, o.order_number, o.status, o.total, o.created_at, o.is_test,
             o.payment_status, o.payment_captured_at
        FROM orders o WHERE o.customer_id = ? ORDER BY o.created_at DESC`, [id]);

    const [addresses] = await bvoPool.query(
      'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY id', [id]);

    const [favs] = await bvoPool.query(`
      SELECT p.id, p.name, p.slug, p.price, p.primary_image_url, f.created_at
        FROM favorites f JOIN products p ON p.id = f.product_id
       WHERE f.customer_id = ? ORDER BY f.created_at DESC`, [id]);

    const [bundles] = await bvoPool.query(
      'SELECT * FROM saved_bundles WHERE customer_id = ? ORDER BY created_at DESC', [id]);

    /* ── the outreach panel's data ─────────────────────────────────────
       Templates for the Template Response dropdown, and everything ever
       sent to this person.

       ⚠️ BOTH WRAPPED. customer_messages is created by the 2026-10-19
       migration, and the admin must keep working on a server where that
       has not been run yet — an unrun migration should degrade the panel,
       not 500 the whole customer record. email_templates is read through
       its own try for the same reason.

       This is the pattern adminController._ensureModelGroupsTable uses,
       minus the self-heal: a CREATE TABLE issued from a page render is how
       a schema ends up differing between environments. */
    let templates = [];
    try { templates = await brevo.listTemplates(); }
    catch (e) { console.error('[customerAnalytics.detail] templates:', e && e.message); }

    let messages = [], messagesTableMissing = false;
    try {
      const [m] = await bvoPool.query(
        `SELECT id, order_id, to_email, kind, template_key, subject,
                sent_ok, error, actor, created_at
           FROM customer_messages
          WHERE customer_id = ?
          ORDER BY created_at DESC
          LIMIT 50`, [id]);
      messages = m;
    } catch (e) {
      messagesTableMissing = e && e.code === 'ER_NO_SUCH_TABLE';
      if (!messagesTableMissing)
        console.error('[customerAnalytics.detail] messages:', e && e.message);
    }

    return res.render('pages/admin/marketing/customer-detail', {
      pageTitle: `${customer.email} | BVO Admin`,
      layout: 'layouts/admin',
      customer,
      sourceLabel: SIGNUP_SRC.label(customer.signup_source),
      orders, addresses, favorites: favs, bundles,
      templates, messages, messagesTableMissing,
      /* Set by the outreach handlers on redirect. Strings, never HTML:
         the view escapes them. */
      msgOk:  req.query.msg_ok  || '',
      msgErr: req.query.msg_err || '',
      /* ⚠️ THE SHARED PREDICATE, not a hand-written filter. This line read
         `orders.filter(o => String(o.is_test) !== '1')` — test rows only —
         which is why customer 11 showed $1,971 from three failed checkout
         attempts. revenue.isCounted() is the same rule the SQL uses, and
         gate_revenue_definition runs both over identical fixtures so they
         cannot drift. */
      spent:  orders.filter(revenue.isCounted).reduce((a, o) => a + num(o.total), 0),
      /* Shown separately so an order awaiting capture is visible as money
         in flight rather than simply missing. */
      inFlight: orders.filter(revenue.isAuthorized).reduce((a, o) => a + num(o.total), 0),
    });
  } catch (err) {
    console.error('[customerAnalytics.detail]', err);
    return res.status(500).type('text/plain').send(
      'Unable to load that customer.' +
      (process.env.NODE_ENV === 'production' ? '' : '\n\n' + err.stack));
  }
};

/* ── POST /admin/marketing/customers/:id/test ───────────────────────────
   Toggle the exclusion flag. The reason this is in the UI at all: the next
   round of testing will create more rows, and a flag nobody can set is a
   flag that rots. Also flips the customer's orders, because a test customer
   with real-looking orders is the same poisoned metric by another route. */
exports.toggleTest = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  try {
    if (Number.isInteger(id) && id > 0) {
      const flag = req.body.is_test === '1' ? 1 : 0;
      await bvoPool.query('UPDATE customers SET is_test = ? WHERE id = ?', [flag, id]);
      await bvoPool.query('UPDATE orders    SET is_test = ? WHERE customer_id = ?', [flag, id]);
    }
  } catch (err) {
    console.error('[customerAnalytics.toggleTest]', err);
  }
  return res.redirect(`/admin/marketing/customers/${id}`);
};

/* Exported for the gate, which tests the real thresholds rather than a
   restatement of them. */
exports._internals = { NEED, REAL_CUSTOMER, REAL_ORDER, C_OK, O_OK };
