'use strict';

/* adPrivacy.js — may advertising tags run for THIS request?
 *
 * Added 2026-10-30 with the Meta pixel (BVO's own pixel, 1499344253267498,
 * owned by Smash Inventory Solutions). The owner chose the "middle path"
 * that is standard for US retailers:
 *
 *   - no pre-consent cookie banner (an EU/UK model, not the US norm)
 *   - the pixel runs by default
 *   - a "Your Privacy Choices" link in the footer turns it off
 *   - a browser Global Privacy Control signal turns it off automatically
 *   - the Privacy Policy discloses the sharing (edited in the admin page
 *     editor, not here — see docs/reference/PRE_LAUNCH_CHECKLIST.md)
 *
 * TWO SIGNALS, EITHER ONE OPTS OUT:
 *
 *   Sec-GPC: 1      The browser sends this on every request when the visitor
 *                   has Global Privacy Control switched on (Firefox, Brave,
 *                   DuckDuckGo, extensions). California treats it as a valid
 *                   opt-out of sharing, and the Sephora enforcement (2022)
 *                   was specifically about ignoring it alongside pixels.
 *                   It is checked per request and never stored — if the
 *                   visitor turns GPC off, the pixel comes back on its own.
 *
 *   bvo_ad_optout=1 Set by the /privacy-choices page. First-party, httpOnly,
 *                   one year. httpOnly because only the server reads it: the
 *                   decision is made at render time and the pixel is simply
 *                   not written into the page, so there is nothing for page
 *                   script to check and nothing for a blocked script to miss.
 *
 * WHY SERVER-SIDE AND NOT A JS CHECK: an opted-out visitor's browser never
 * receives the Meta snippet at all. A client-side check would download and
 * start fbevents.js before deciding, which is exactly what opt-out forbids.
 *
 * HTML is served Cache-Control: no-store (server.js), so a page rendered for
 * an opted-out visitor can never be served from a proxy to anybody else.
 * If that header is ever relaxed, this file stops being correct.
 *
 * No cookie-parser in this app — the one cookie is read by hand below.
 */

const COOKIE  = 'bvo_ad_optout';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function hasOptOutCookie(req) {
  const raw = String((req && req.headers && req.headers.cookie) || '');
  return raw.split(';').some(p => p.trim() === COOKIE + '=1');
}

function hasGpc(req) {
  return String((req && req.headers && req.headers['sec-gpc']) || '').trim() === '1';
}

/** { optedOut, gpc, cookie } — optedOut is true if EITHER signal is present. */
function status(req) {
  const gpc = hasGpc(req);
  const cookie = hasOptOutCookie(req);
  return { optedOut: gpc || cookie, gpc, cookie };
}

function isSecure(req) {
  return !!(req.secure ||
    String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https');
}

/** Record the visitor's choice. on=true opts OUT of advertising tags. */
function setOptOut(req, res, on) {
  const opts = { httpOnly: true, sameSite: 'lax', secure: isSecure(req), path: '/' };
  if (on) res.cookie(COOKIE, '1', Object.assign({ maxAge: ONE_YEAR_MS }, opts));
  else    res.clearCookie(COOKIE, opts);
}

module.exports = { COOKIE, status, setOptOut, hasGpc, hasOptOutCookie };
