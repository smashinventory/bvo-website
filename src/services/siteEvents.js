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
      KEY idx_event_time (event_name, occurred_at),
      KEY idx_time       (occurred_at),
      KEY idx_session    (session_id),
      KEY idx_product    (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  _ready = true;
}

/* Deliberately coarse. The job is to keep obvious crawlers out of the
   funnel, not to win an arms race - and anything this misses is visible
   as a session with views and no other events. */
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|headless|puppeteer|playwright|lighthouse|pingdom|uptime|curl|wget|python-requests|axios|monitor|scrapy|httpclient|java\/|go-http|okhttp|screaming frog|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|claudebot|ccbot|perplexity/i;

/* HEADER HEURISTICS, because the user-agent is the one thing a crawler can
   trivially lie about. The flood of 2026-10-01 arrived with a genuine Chrome
   user-agent and sailed straight through the regex above.

   A browser rendering a page for a person always negotiates content: it says
   what languages it reads and what encodings it accepts. Automated clients
   routinely omit both, because nothing is going to read the result.

   BOTH must be missing. Plenty of real clients omit one, and a false positive
   here deletes real traffic, which is worse than the overcount being fixed. */
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

/* Did this client send our session cookie back, proving it keeps state across
   requests.

   NOTE the deliberate lack of a question mark on the line above. That is not a
   typo. See the comment on sessionKey below. */
/* ⚠️ THE COOKIE NAME, AND A COUPLING THAT MUST BE GATED. server.js calls
   session({...}) WITHOUT a `name` option, so express-session uses its
   default. If anyone ever sets a custom name there and not here, every
   client silently becomes cookieless, the funnel reads zero, and nothing
   errors. gate_session_identity asserts the two agree. */
const SESSION_COOKIE = 'connect.sid';

/* ── WHAT "STATEFUL" ACTUALLY MEANS ──────────────────────────────────────
   2026-10-20. The previous version of this function read:

       return sess.isNew === false;

   ⚠️ express-session HAS NO isNew PROPERTY. Not in 1.19.0, not in any
   version - grep the package, there are zero occurrences. So this compared
   `undefined === false` and returned FALSE FOR EVERY REQUEST. From the
   moment the synthetic id shipped on 10-16, every client on the site was
   recorded as cookieless, real humans included, and nothing could ever be
   stateful again.

   It was invisible because the number it produced looked plausible: the
   7-day window still reached back over 10-16, whose rows carried real
   cookie-backed ids from the ORIGINAL per-request bug, so the tile showed
   ~5,000 "stateful" sessions that were pure residue. Those age out and the
   funnel goes to zero. The tell was already on the page - cart adds fell
   from 5 to 1 and checkouts from 4 to 0 the moment the predicate shipped,
   because those were real people being excluded.

   ⚠️ AND THE GATE CERTIFIED IT. gate_session_identity fabricated requests
   as { session: { isNew: false } } and asserted isStateful returned true -
   under a heading reading "isStateful reads the cookie, not the request".
   It tested the implementation's assumption rather than the library's
   behaviour, so it agreed with the bug. Fixtures now carry a real Cookie
   header instead of a property that does not exist.

   ── HOW THIS ONE IS CORRECT ─────────────────────────────────────────────
   express-session index.js:228 reads

       var cookieId = req.sessionID = getcookie(req, name, secrets);

   so when the client returns a cookie WE signed, req.sessionID IS the id
   carried in that cookie. When the signature does not verify, getcookie
   returns undefined and a fresh random id is generated instead.

   Comparing the id embedded in the raw cookie against req.sessionID
   therefore answers exactly the right question, with no dependency on
   cookie-parser (absent) or cookie-signature (present only as a transitive
   dependency of express-session, which is not ours to rely on) and without
   handling the secret.

   ⚠️ WHY NOT JUST "DOES THE REQUEST CARRY A connect.sid COOKIE". Because a
   crawler replaying one junk cookie value would pass that test on every
   request while express-session minted it a NEW id each time - one row per
   request, which is precisely the 15,000-per-day bug this whole feature
   exists to kill. The equality check is what makes a forged or stale
   cookie fall through to the synthetic bucket where it belongs. */
function isStateful(req) {
  const sid = req && req.sessionID;
  if (!sid) return false;

  const header = (req.headers && req.headers.cookie) || '';
  if (!header) return false;

  const m = new RegExp('(?:^|;\\s*)' + SESSION_COOKIE.replace('.', '\\.') +
                       '=([^;]*)').exec(header);
  if (!m || !m[1]) return false;

  let raw = m[1];
  try { raw = decodeURIComponent(raw); } catch (e) { /* keep it raw */ }

  /* Signed cookies are "s:<id>.<signature>". An unsigned one is not ours. */
  if (raw.slice(0, 2) !== 's:') return false;

  const dot = raw.lastIndexOf('.');
  const fromCookie = dot > 2 ? raw.slice(2, dot) : raw.slice(2);

  return fromCookie === String(sid);
}

/* Money arrives as a float from the DB. Round once, here, so every caller
   cannot each pick a different rounding. */
/* ── THE SESSION-INFLATION FIX ───────────────────────────────────────────
   req.sessionID is only meaningful for a client that returns our cookie. For
   one that does not, express-session mints a fresh id on EVERY request, so a
   crawler making 15,000 requests wrote 15,000 distinct "sessions". That, not
   a mislabelled column, is why the tile read 15,463 against GA4's 389 for the
   same week.

   So: stateful clients keep their real session id; everyone else gets a
   synthetic id derived from who they appear to be, collapsing one cookieless
   client's entire crawl into ONE session. The calendar day is part of the key
   so the bucket rolls over nightly rather than accumulating forever.

   COST, stated rather than discovered later: a real visitor's FIRST request
   has not returned the cookie yet, so it lands in the synthetic bucket while
   their later requests land in the cookie bucket. One person can count as two
   sessions. Worst case 2x, against the 40x it replaces. Two people behind one
   office NAT on the same browser also share a synthetic bucket for their
   first request each.

   The IP is hashed and never stored.

   A NOTE ON PUNCTUATION, which sounds absurd and cost two outages. The first
   version of this fix carried a question mark in a comment inside the CREATE
   TABLE below. mysql2 had namedPlaceholders enabled pool-wide, and the
   named-placeholders library does not understand SQL comments: it read that
   mark as a positional parameter on a statement with no parameters and threw
   inside the driver, killing the process on every boot. The flag is now
   scoped to the JM importer so this can no longer happen, and gate_named_
   placeholders enforces it. The comments in this file still avoid the
   character, as a second line of defence. */
const SYNTHETIC_PREFIX = 'anon-';

function syntheticSessionId(req) {
  const h  = (req && req.headers) || {};
  const ip = (h['cf-connecting-ip'] || h['x-real-ip'] ||
              String(h['x-forwarded-for'] || '').split(',')[0] ||
              (req && req.ip) || '').trim();
  const day = new Date().toISOString().slice(0, 10);
  const hash = crypto.createHash('sha256')
    .update(ip + '|' + (h['user-agent'] || '') + '|' + (h['accept-language'] || '') + '|' + day)
    .digest('hex').slice(0, 24);
  return SYNTHETIC_PREFIX + hash;
}

/* ── WHAT THE DASHBOARD MAY CALL A SESSION ───────────────────────────────
   2026-10-19. The synthetic id above collapses ONE cookieless client into
   one session per day. It is powerless against the inverse, which is what
   actually arrived: 8,471 distinct synthetic ids over two days carrying
   8,487 events between them - 1.002 each - with no referrer on 99.8% of
   them and the busiest single path in the window reaching 13 hits. That is
   thousands of distinct IP and user-agent pairs taking one page each,
   spread flat across the catalogue. The IP is part of the hash key, so
   rotating it defeats the collapsing by construction, and the clients send
   a browser user-agent with real content-negotiation headers, so neither
   BOT_RE nor headersLookAutomated sees them either.

   Chasing that with better user-agent matching is an arms race run blind:
   this table stores no user-agent and no IP, deliberately. So the rule is
   definitional instead, and it is the one honest line available.

     A CLIENT THAT NEVER RETURNS OUR SESSION COOKIE IS NOT A SESSION.

   WHAT IT COSTS, stated rather than discovered later. A real visitor who
   lands straight on a product page has not returned the cookie yet, so
   their first event is synthetic. If they do ANYTHING else they become
   stateful and are counted. So the only person dropped is the direct-
   landing single-page bouncer - someone who never carts and never orders,
   and who therefore only ever widened the TOP of the funnel and made every
   rate below it look worse than it was. Two days of data put that group at
   19 sessions carrying a google.com referrer, against 8,471 crawler hits.

   The rows are KEPT and the volume is REPORTED on the page, same as the
   bot share. A crawl is evidence, and a funnel that silently dropped it
   would read as a quiet week.

   ⚠️ THE PREFIX IS DECLARED ONCE, ABOVE. The controller used to be the
   second place that knew the string, which is how revenue.js and
   deliveryLocation.js were both born. Read it from here. */
function statefulPredicate(col = 'session_id') {
  if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(String(col))) {
    throw new Error(`siteEvents: refusing a non-identifier column: ${col}`);
  }
  return `${col} NOT LIKE '${SYNTHETIC_PREFIX}%'`;
}

/* The complement, for the one place that REPORTS the dropped volume. */
function cookielessPredicate(col = 'session_id') {
  if (!/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/.test(String(col))) {
    throw new Error(`siteEvents: refusing a non-identifier column: ${col}`);
  }
  return `${col} LIKE '${SYNTHETIC_PREFIX}%'`;
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
          path, referrer, is_bot, is_test)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
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

  /* ⚠️ THE ONLY PREDICATE A DASHBOARD MAY USE TO COUNT SESSIONS. See the
     comment block above statefulPredicate for why, and for what it costs. */
  statefulPredicate, cookielessPredicate, SYNTHETIC_PREFIX,

  /* Exposed for gate_session_identity.js, which has to EXECUTE these rather
     than grep for them. The inflation bug was invisible to every text-level
     check: the code read correctly and produced a number, the number was
     simply 40x too large. Only running the functions against a fixture
     catches that. Named with the __ prefix that ordersController's
     __deleteInternals established, to mark it as a test seam and not an API. */
  __sessionInternals: { sessionKey, syntheticSessionId, isStateful, looksLikeBot, headersLookAutomated },
};
