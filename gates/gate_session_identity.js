#!/usr/bin/env node
'use strict';

/* gate_session_identity.js — a session must mean a visitor.
 *
 * THE DEFECT THIS EXISTS FOR. On 2026-10-15 the Site Analytics page read
 * "Viewed a product: 15,463 sessions" for a week in which GA4 counted 389
 * sessions in total — a 40x overstatement that made every rate under it
 * meaningless.
 *
 * The SQL was right. It counted COUNT(DISTINCT session_id) and labelled the
 * result sessions. The bug was upstream: session_id was req.sessionID, and
 * express-session mints a fresh id for any client that does not return the
 * cookie. One cookieless crawler making 15,000 requests therefore wrote
 * 15,000 distinct session ids. Nothing in the dashboard could have detected
 * that, because by the time the query ran the inflation looked exactly like
 * traffic.
 *
 * TWO FIXES, BOTH GATED HERE:
 *   1. session_id is synthesised for cookieless clients, collapsing one
 *      client's whole crawl into one session.
 *   2. bot detection no longer trusts the user-agent alone, because the
 *      flood of 2026-10-01 arrived with a genuine Chrome UA and walked
 *      straight through a regex that only looks for the word "bot".
 *
 * WHAT MAKES THIS GATE WORTH HAVING RATHER THAN A COMMENT. Both fixes are
 * one line each and both are the kind of line a later refactor "simplifies"
 * back to req.sessionID without any test failing. The dashboard would go on
 * rendering a number; it would simply be wrong again, and the only way
 * anyone found out the first time was by comparing it against GA4 by hand.
 *
 * Every check below is executed against the real module where it can be,
 * not asserted against a substring. The substring checks that remain are
 * written to name the thing they protect, because a neutered `if` leaves
 * the identifier behind in dead code and a naive grep still passes — a hole
 * this codebase has already been bitten by twice.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok    = m => { checks++; console.log('  ok   ' + m); };
const bad   = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const read  = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

const SVC  = read('src/services/siteEvents.js');
const CTRL = read('src/controllers/siteAnalyticsController.js');

console.log('\ngate_session_identity — a session is a visitor, not a request\n');

/* ── 1. the module must expose its internals so this can be executed ──
   A gate that can only read source text is a spell-checker. siteEvents
   exports a __sessionInternals handle for exactly this purpose, following
   the __deleteInternals pattern ordersController already uses. */
console.log('--- the fix is testable at all ---');

/* siteEvents requires ../config/database, which refuses to load without a
   password — correct behaviour for the app, and a nuisance here. A pool is
   created lazily and never connected to, so a placeholder is enough: none of
   the functions under test touch the database. Restored afterwards so this
   gate cannot leak a fake credential into anything a push script runs next. */
const SAVED_DB_PASS = process.env.DB_PASS;
if (!process.env.DB_PASS) process.env.DB_PASS = 'gate-placeholder-no-connection-is-made';

let INT = null;
try {
  INT = require(path.join(ROOT, 'src/services/siteEvents.js')).__sessionInternals;
} catch (e) {
  bad('siteEvents.js loads', e.message);
} finally {
  if (SAVED_DB_PASS === undefined) delete process.env.DB_PASS;
  else process.env.DB_PASS = SAVED_DB_PASS;
}
check(INT && typeof INT.sessionKey === 'function',
      'siteEvents exports __sessionInternals.sessionKey',
      'without this the checks below degrade to grepping, which has missed this class of bug before');
check(INT && typeof INT.looksLikeBot === 'function',
      'siteEvents exports __sessionInternals.looksLikeBot');
check(INT && typeof INT.isStateful === 'function',
      'siteEvents exports __sessionInternals.isStateful');

if (!INT || !INT.sessionKey) {
  console.log('\ngate_session_identity: FAILED ' + fails + ' of ' + checks +
              ' (internals missing — the behavioural checks could not run)');
  process.exit(1);
}

const { sessionKey, looksLikeBot, isStateful } = INT;

/* A request fixture. `session.isNew === false` is how express-session says
   "this client sent the cookie back"; it is true only on the request that
   minted the id. */
function req({ sid = 'sid-abc', isNew = false, ua = 'Mozilla/5.0 (Macintosh) Chrome/131',
               lang = 'en-US,en;q=0.9', enc = 'gzip, deflate, br', ip = '203.0.113.7' } = {}) {
  const headers = { 'user-agent': ua, 'x-forwarded-for': ip };
  if (lang) headers['accept-language'] = lang;
  if (enc)  headers['accept-encoding'] = enc;
  return { headers, ip, sessionID: sid, session: { isNew } };
}

/* ── 2. THE CORE PROPERTY: one cookieless client is one session ───────
   This is the whole bug, stated as a test. Fifteen requests from one
   crawler, each handed a different sessionID by express-session because it
   never returns the cookie, must collapse to a single session key. */
console.log('--- one cookieless client is one session ---');
{
  const keys = new Set();
  for (let i = 0; i < 15; i++) {
    keys.add(sessionKey(req({ sid: 'minted-' + i, isNew: true })));
  }
  check(keys.size === 1,
        '15 cookieless requests with 15 different sessionIDs collapse to 1 session key',
        'got ' + keys.size + ' distinct keys — this is the 15,463-vs-389 defect itself');
  check([...keys][0] !== 'minted-0',
        'the collapsed key is NOT the express-session id',
        'got ' + [...keys][0]);
}

/* The inverse, which matters just as much: a client that DOES keep state
   must keep its own id, or two unrelated visitors behind one NAT would be
   merged and the funnel would understate instead. */
console.log('--- a stateful client keeps its own identity ---');
check(sessionKey(req({ sid: 'real-session-1', isNew: false })) === 'real-session-1',
      'a client that returned the cookie keeps its express-session id');
{
  const a = sessionKey(req({ sid: 'visitor-a', isNew: false, ip: '198.51.100.1' }));
  const b = sessionKey(req({ sid: 'visitor-b', isNew: false, ip: '198.51.100.1' }));
  check(a !== b,
        'two stateful visitors behind one IP stay two sessions',
        'collapsing these would understate traffic, which is the opposite error');
}

/* ── 3. the synthetic key must actually discriminate ──────────────────
   A key that is constant for everyone would pass check 2 while destroying
   the metric, so prove it separates genuinely different clients. */
console.log('--- the synthetic key discriminates ---');
{
  const k1 = sessionKey(req({ isNew: true, ip: '192.0.2.1' }));
  const k2 = sessionKey(req({ isNew: true, ip: '192.0.2.2' }));
  check(k1 !== k2, 'two cookieless clients on different IPs are two sessions',
        'a constant key would hide all traffic behind one row');

  const k3 = sessionKey(req({ isNew: true, ip: '192.0.2.1', ua: 'Mozilla/5.0 Firefox/130' }));
  check(k1 !== k3, 'cookieless clients differing only by user-agent are two sessions');

  check(/^anon-/.test(k1),
        'synthetic keys are prefixed so they are identifiable in the table',
        'got ' + k1);
  check(k1.length <= 128,
        'the synthetic key fits session_id VARCHAR(128)',
        'length ' + k1.length);
}

/* The raw IP must never land in the column. This is a privacy property, and
   the only way to hold it is to assert the address does not appear. */
console.log('--- the IP is hashed, not stored ---');
{
  const ip = '198.51.100.42';
  const k  = sessionKey(req({ isNew: true, ip }));
  check(!k.includes(ip), 'the client IP does not appear in the session key', k);
  check(!k.includes('198.51'), 'no octet of the client IP appears in the session key', k);
}
check(/createHash\(/.test(SVC) && /\.update\(/.test(SVC),
      'the key is built with a hash rather than concatenated');

/* ── 4. the key must roll over, or the bucket accumulates forever ─────
   Without a date in the key, one NAT would be one "session" for the life of
   the table and the daily chart would flatten to a line. */
console.log('--- the synthetic bucket rolls over daily ---');
check(/toISOString\(\)\.slice\(0, 10\)/.test(SVC),
      'a calendar day is part of the synthetic key');
{
  /* Executed, not grepped: move the clock a day and the key must change. */
  const RealDate = Date;
  const at = iso => class extends RealDate {
    constructor(...a) { return a.length ? new RealDate(...a) : new RealDate(iso); }
  };
  const fixture = { isNew: true, ip: '203.0.113.99' };
  global.Date = at('2026-10-15T12:00:00Z'); const day1 = sessionKey(req(fixture));
  global.Date = at('2026-10-16T12:00:00Z'); const day2 = sessionKey(req(fixture));
  global.Date = at('2026-10-15T23:30:00Z'); const day1b = sessionKey(req(fixture));
  global.Date = RealDate;
  check(day1 !== day2, 'the same cookieless client is a new session on the next day');
  check(day1 === day1b, 'the same cookieless client is ONE session within a day',
        'a key that changed within the day would restore the inflation');
}

/* ── 5. bot detection may not rest on the user-agent alone ───────────
   The 2026-10-01 flood — 6,491 GA4 sessions, 96% Direct, 18-second average
   duration — presented a real Chrome UA. A UA-only filter reported 72.7%
   bot share and still missed it entirely. */
console.log('--- bot detection does not trust the user-agent alone ---');
check(looksLikeBot({ headers: {} }) === true,
      'no user-agent at all is a bot');
check(looksLikeBot({ headers: { 'user-agent': 'Googlebot/2.1' } }) === true,
      'a self-declaring crawler is a bot');
check(looksLikeBot({ headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
      } }) === true,
      'a PERFECT Chrome user-agent with no Accept-Language and no Accept-Encoding is a bot',
      'this is the exact shape of the 2026-10-01 flood; a UA regex cannot catch it');
check(looksLikeBot(req()) === false,
      'a real browser — Chrome UA, Accept-Language, Accept-Encoding — is not a bot',
      'false positives here delete real traffic, which is worse than the bug being fixed');
check(looksLikeBot(req({ lang: '', enc: 'gzip' })) === false,
      'ONE missing negotiation header is not enough to call it a bot',
      'both must be absent — many real clients omit Accept-Language');
check(looksLikeBot(req({ lang: 'en-US', enc: '' })) === false,
      'a missing Accept-Encoding alone is not enough either');

/* The named crawlers are a maintenance list. Only agents whose names do NOT
   already contain bot/crawl/spider are asserted here: GPTBot, ClaudeBot,
   AhrefsBot, SemrushBot and Bytespider all match the original regex through
   the substrings "bot" and "spider", so asserting them would look like
   coverage while testing nothing — the first draft of this gate did exactly
   that, and the mutation harness caught it. The agents below are the ones
   that genuinely need a named token, because an HTTP library identifies
   itself by library name and nothing else. */
console.log('--- the named-crawler list covers the clients that need naming ---');
[['Scrapy/2.11 (+https://scrapy.org)', 'Scrapy'],
 ['okhttp/4.12.0',                     'okhttp'],
 ['Go-http-client/2.0',                'Go-http-client'],
 ['Java/17.0.9',                       'Java HTTP client'],
].forEach(([ua, name]) => {
  check(looksLikeBot({ headers: { 'user-agent': ua, 'accept-language': 'en', 'accept-encoding': 'gzip' } }) === true,
        name + ' is recognised even with browser-like headers');
  check(!/bot|crawl|spider/i.test(ua),
        name + ' is a fixture the original bot|crawl|spider regex would have missed',
        'if this fails the check above proves nothing');
});

/* ── 6. isStateful must mean what the name says ───────────────────────
   If this returned true unconditionally the whole fix would be a no-op and
   check 2 would fail — but it could also be made to return false
   unconditionally, which silently routes every visitor into the synthetic
   bucket and quietly merges real people. Both directions are asserted. */
console.log('--- isStateful reads the cookie, not the request ---');
check(isStateful({ session: { isNew: false } }) === true,
      'a returned cookie is stateful');
check(isStateful({ session: { isNew: true } }) === false,
      'a freshly minted session is not yet stateful');
check(isStateful({}) === false,
      'no session object at all is not stateful');
check(isStateful({ session: {} }) === false,
      'an undefined isNew is not treated as stateful',
      'defaulting to true here would restore the bug for every cookieless client');

/* ── 7. nothing may write req.sessionID straight into the column ──────
   The regression this gate exists to prevent, stated literally. */
console.log('--- the raw express-session id never reaches the column ---');
{
  const insert = SVC.slice(SVC.indexOf('INSERT INTO site_events'));
  check(!/clip\(\s*req\s*&&\s*req\.sessionID/.test(insert),
        'the INSERT parameter list does not contain clip(req.sessionID)',
        'this exact expression is what produced 15,463 phantom sessions');
  check(/sessionKey\(req\)/.test(insert),
        'the INSERT parameter list calls sessionKey(req)');
}

/* ── 8. the dashboard still counts sessions, not events ──────────────
   Carried over from gate_site_analytics because the two halves only work
   together: collapsing the ids is pointless if the query starts counting
   rows, and counting distinct ids is pointless if the ids are per-request.
   Either change alone re-inflates the tile. */
console.log('--- the dashboard still counts distinct sessions ---');
/* Scoped to funnel() deliberately. daily() contains near-identical SQL, so a
   whole-file regex passes as long as EITHER query is intact — the first draft
   of this gate did that and the mutation harness proved it: breaking the
   funnel left the gate green because daily() still matched. */
const FUNNEL = (() => {
  const i = CTRL.indexOf('async function funnel(');
  const j = CTRL.indexOf('\nasync function daily(', i);
  return i > -1 && j > i ? CTRL.slice(i, j) : '';
})();
check(FUNNEL.length > 0, 'funnel() can be located in the controller',
      'the checks below are scoped to it and are worthless without it');
['view_item', 'add_to_cart', 'begin_checkout'].forEach(ev =>
  check(new RegExp("COUNT\\(DISTINCT CASE WHEN event_name = '" + ev + "'\\s+THEN session_id END\\)").test(FUNNEL),
        ev + ' is counted as distinct sessions in funnel()'));
check(/WHERE is_bot = 0/.test(FUNNEL),
      'funnel() excludes rows flagged as bots');

/* daily() feeds the chart under the tile. If it inflates while the tile is
   correct, the page contradicts itself, which is how the defect was found in
   the first place. */
const DAILY = (() => {
  const i = CTRL.indexOf('async function daily(');
  const j = CTRL.indexOf('\nasync function topAdded(', i);
  return i > -1 && j > i ? CTRL.slice(i, j) : '';
})();
check(DAILY.length > 0, 'daily() can be located in the controller');
['view_item', 'add_to_cart'].forEach(ev =>
  check(new RegExp("COUNT\\(DISTINCT CASE WHEN event_name = '" + ev + "'\\s+THEN session_id END\\)").test(DAILY),
        ev + ' is counted as distinct sessions in daily() too'));
check(/WHERE is_bot = 0/.test(DAILY),
      'daily() excludes rows flagged as bots');

/* ── 9. NO SCHEMA CHANGE, AND NO PLACEHOLDER CHARACTERS IN SQL ──
   The first version of this fix added a `stateful` column and an ALTER to
   create it. The column was only ever diagnostic, it was never read by any
   dashboard query, and it took the Site Analytics page down when the ALTER
   failed. It is gone, and it must stay gone.

   The same version also carried a question mark in a comment inside the
   CREATE TABLE. named-placeholders read it as a positional parameter on a
   statement with no parameters and killed the process on every boot - two
   outages. namedPlaceholders is now scoped to the JM importer so this file
   can no longer trigger it, but the character stays out of here as a second
   line of defence, and this check is what keeps it out. */
console.log('--- no schema change, and no placeholder characters in SQL ---');
check(!/stateful\s+TINYINT/.test(SVC),
      'no `stateful` column is declared',
      'it was never read by any query and its ALTER took a page down');
check(!/ALTER TABLE site_events/.test(SVC),
      'no ALTER TABLE is attempted',
      'a schema change that can half-apply is worse than no schema change');
{
  const np = require('named-placeholders')();
  const i2 = SVC.indexOf('CREATE TABLE IF NOT EXISTS site_events');
  const CREATE = i2 > -1 ? SVC.slice(i2, SVC.indexOf('`);', i2)) : '';
  check(CREATE.length > 0, 'the CREATE TABLE can be extracted');
  let threw = false;
  try { np(CREATE, undefined); } catch (e) { threw = true; }
  check(!threw,
        'the CREATE TABLE survives named-placeholders with no parameters',
        'this is the exact failure that crashed the site on 2026-10-16');
  /* Proof the detector detects, so the check above is not vacuous. */
  let caught = false;
  try { np('CREATE TABLE t (a INT) /* back to us? */', undefined); } catch (e) { caught = true; }
  check(caught, 'and the detector trips on a comment that DOES carry one');

  const comments = SVC.match(/\/\*[\s\S]*?\*\//g) || [];
  const offenders = comments.filter(c => /\?/.test(c));
  check(offenders.length === 0,
        'no comment anywhere in siteEvents.js contains a question mark',
        offenders.map(c => c.slice(0, 70)).join(' | '));
}

/* The 2026-10-15 backfill that cleaned the historical inflation has
   already been run against production and is not part of this change. */

console.log('\n' + (fails
  ? 'gate_session_identity: FAILED ' + fails + ' of ' + checks
  : 'gate_session_identity: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
