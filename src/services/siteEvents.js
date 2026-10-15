'use strict';

/* siteEvents.js — first-party behaviour events.
 *
 * WHY THIS EXISTS AT ALL: "adds to cart" could not be answered from any
 * source on 2026-10-07. GA4, GTM and Clarity are all installed, but the
 * codebase contained ZERO gtag('event', ...) calls, so GA4 only ever had
 * its automatic events - page_view, session_start, scroll. And the cart
 * lives in the express-mysql-session blob with no carts or cart_items
 * table, so the database could not answer it either.
 *
 * RECORDED SERVER-SIDE, deliberately. The alternative is a browser beacon,
 * which ad-blockers and tracking prevention drop - by some measures a
 * fifth of traffic. add_to_cart in particular is already a server round
 * trip that fetches the authoritative price, so recording it there costs
 * nothing extra and cannot be blocked.
 *
 * WHAT IS **NOT** HERE: purchases. Orders are already a table, and money
 * must have exactly one source of truth. The funnel query joins `orders`
 * for its last step rather than writing a second purchase row that could
 * drift from it. Revenue is never read from this table.
 *
 * FAIL-SOFT, ALWAYS. Analytics must never break a page or a cart add. Every
 * public function swallows its own errors and returns; a dropped event is
 * an acceptable loss, a 500 on "Add to cart" is not.
 */

const crypto      = require('crypto');
const { bvoPool } = require('../config/database');

let _ready = false;

/* Self-heal, same pattern as _ensureModelGroupsTable in adminController.
   The server is deployed by git push with no migration step, so a table
   that only exists in a .sql file does not exist in production. */
async function ensureTable() {
  if (_ready) return;
  await bvoPool.query(`
    CREATE TABLE IF NOT EXISTS site_events (
      id           BIGINT AUTO_INCREMENT PRIMARY KEY,
      event_name   VARCHAR(40)  NOT NULL,
      occurred_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      session_id   VARCHAR(128)          DEFAULT NULL,
      customer_id  INT                   DEFAULT NULL,
      product_id   INT                   DEFAULT NULL,
      qty          INT          NOT NULL DEFAULT 0,
      /* CENTS, as an integer. A FLOAT column silently turns 19.99 into
         19.989999999999998 and makes every SUM slightly wrong. */
      value_cents  INT          NOT NULL DEFAULT 0,
      path         VARCHAR(255)          DEFAULT NULL,
      referrer     VARCHAR(255)          DEFAULT NULL,
      /* Flags, not deletions. A bot or a staff session is still evidence;
         it just must not be counted as a customer. Every dashboard query
         filters on these, which is why they are NOT NULL with a default -
         a NULL would silently fall out of "WHERE is_bot = 0". */
      is_bot       TINYINT(1)   NOT NULL DEFAULT 0,
      is_test      TINYINT(1)   NOT NULL DEFAULT 0,
      /* Did this request carry OUR session cookie back to us?
         session_id comes from req.sessionID, and express-session mints a
         fresh one for any client that does not return the cookie. A crawler
         therefore produces one brand-new "session" PER REQUEST, which is how
         15,463 sessions appeared against GA4's 389. This column is the
         evidence that the client keeps state, which no cookieless crawler
         can fake by spoofing a user-agent. */
      stateful     TINYINT(1)   NOT NULL DEFAULT 0,
      KEY idx_event_time (event_name, occurred_at),
      KEY idx_time       (occurred_at),
      KEY idx_session    (session_id),
      KEY idx_product    (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  /* Existing installs already have the table, so CREATE TABLE IF NOT EXISTS
     is a no-op there and the new column would never appear. Added separately,
     tolerating the duplicate-column error the second time around. */
  try {
    await bvoPool.query('ALTER TABLE site_events ADD COLUMN stateful TINYINT(1) NOT NULL DEFAULT 0');
  } catch (e) {
    if (e && e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
  _ready = true;
}

/* Deliberately coarse. The job is to keep obvious crawlers out of the
   funnel, not to win an arms race - and anything this misses is visible
   as a session with views and no other events. */
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|headless|puppeteer|playwright|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|monitor|scrapy|httpclient|java\/|go-http|okhttp|screaming frog|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|claudebot|ccbot|perplexity/i;

/* HEADER HEURISTICS, because the user-agent is the one thing a crawler can
   trivially lie about. The 2026-10-01 flood arrived with a real Chrome UA and
   sailed through the regex above.

   A browser that renders a page for a person always negotiates content: it
   states what languages it reads and what encodings it accepts. Automated
   clients routinely omit both because nothing is going to read the result.
   Neither header alone is conclusive, so both must be missing. */
function headersLookAutomated(req) {
  const h = (req && req.headers) || {};
  return !h['accept-language'] && !h['accept-encoding'];
}

function looksLikeBot(req) {
  const ua = String((req.headers && req.headers['user-agent']) || '');
  if (!ua) return true;               // no UA at all is never a real browser
  if (BOT_RE.test(ua)) return true;
  return headersLookAutomated(req);
}

/* True when the client sent our session cookie back, proving it keeps state
   across requests. express-session sets isNew on the request that mints the
   id; every later request from the same browser clears it.

   A real visitor's FIRST event is therefore not stateful, and a one-page
   bounce never becomes stateful. The dashboard counts a session as human if
   ANY of its events were stateful, so a genuine two-page visit counts in
   full - the cost is confined to true single-page bounces, which were never
   going to be purchase intent anyway. A crawler, having no cookie jar, can
   never satisfy this at all. */
function isStateful(req) {
  const sess = req && req.session;
  if (!sess) return false;
  return sess.isNew === false;
}

/* Money arrives as a float from the DB. Round once, here, so every caller
   cannot each pick a different rounding. */
/* ── THE SESSION-INFLATION FIX ───────────────────────────────────────────
   req.sessionID is only meaningful for a client that returns our cookie.
   For one that does not, express-session mints a fresh id on EVERY request,
   so a crawler making 15,000 requests wrote 15,000 distinct "sessions" — and
   that, not a mislabelled column, is why the tile read 15,463 against GA4's
   389 for the same week.

   So: stateful clients keep their real session id; everyone else gets a
   synthetic id derived from who they appear to be, which collapses one
   cookieless client's whole crawl into ONE session.

   The day is in the key so the bucket rolls over nightly rather than
   accumulating forever, which mirrors how GA4 ends sessions.

   COST, stated plainly: a real visitor's first request is not yet stateful,
   so it lands in the synthetic bucket and their later requests land in the
   cookie bucket — one person can count as two sessions. That overcounts by
   at most 2x in the worst case; the bug it replaces overcounted by 40x. It
   also means two visitors behind one office NAT with the same browser share
   a synthetic bucket for their first request each.

   The IP is hashed and never stored. */
function syntheticSessionId(req) {
  const h  = (req && req.headers) || {};
  const ip = (h['cf-connecting-ip'] || h['x-real-ip'] ||
              String(h['x-forwarded-for'] || '').split(',')[0] ||
              (req && req.ip) || '').trim();
  const day = new Date().toISOString().slice(0, 10);
  const hash = crypto.createHash('sha256')
    .update(ip + '|' + (h['user-agent'] || '') + '|' + (h['accept-language'] || '') + '|' + day)
    .digest('hex').slice(0, 24);
  return 'anon-' + hash;
}

function sessionKey(req) {
  if (isStateful(req)) return clip(req && req.sessionID, 128);
  return syntheticSessionId(req);
}

function toCents(v) {
  const n = Number(v);
  if (!isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function clip(s, n) {
  if (s === undefined || s === null) return null;
  const t = String(s).trim();
  return t ? t.slice(0, n) : null;
}

/**
 * Record one event. Never throws.
 *
 * @param {object} req   the Express request, for session/UA/path
 * @param {string} name  'view_item' | 'add_to_cart' | 'begin_checkout'
 * @param {object} [f]   { product_id, qty, value, path }
 */
async function record(req, name, f) {
  try {
    f = f || {};
    await ensureTable();

    const sess = req && req.session;
    await bvoPool.query(
      `INSERT INTO site_events
         (event_name, session_id, customer_id, product_id, qty, value_cents,
          path, referrer, is_bot, is_test, stateful)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        String(name).slice(0, 40),
        sessionKey(req),
        /* customerId, camelCase. The session key is spelled that way in all
           34 places that read it; customer_id is the COLUMN name, and I had
           written the column name here. It would have logged NULL for every
           signed-in shopper and nothing would have looked broken. */
        (sess && sess.customerId) || null,
        Number(f.product_id) > 0 ? Number(f.product_id) : null,
        Number(f.qty) > 0 ? Number(f.qty) : 0,
        toCents(f.value),
        clip(f.path || (req && req.originalUrl), 255),
        clip(req && req.headers && req.headers.referer, 255),
        looksLikeBot(req) ? 1 : 0,
        /* There is no session-level test flag - is_test lives on the
           customers and orders TABLES (see customerAnalyticsController's
           C_OK / O_OK). So this column can only be set for a signed-in
           customer, and is resolved by the dashboard query joining
           customers, not guessed here. Left 0: an unknown is not a test. */
        0,
        isStateful(req) ? 1 : 0,
      ]
    );
  } catch (err) {
    /* Swallowed on purpose - see the header. Logged so a broken table or a
       bad column shows up in the runtime log rather than vanishing. */
    console.error('[siteEvents] record failed (ignored):', err && err.message);
  }
}

module.exports = {
  record, ensureTable, looksLikeBot, toCents,

  /* Exposed for gate_session_identity.js, which has to EXECUTE these rather
     than grep for them. The session-inflation bug was invisible to every
     text-level check: the code read correctly and produced a number, the
     number was simply 40x too large. Only running the functions against a
     fixture catches that, and only a gate that can run them can catch it
     again. Named with the __ prefix that ordersController's __deleteInternals
     already established, to mark it as a test seam and not an API. */
  __sessionInternals: { sessionKey, syntheticSessionId, isStateful, looksLikeBot, headersLookAutomated },
};
