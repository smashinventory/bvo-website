'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   canonicalRedirect.js — should this request be 301'd to the canonical
   host, and if so, where to.

   ── WHY THIS IS A MODULE AND NOT FOUR LINES IN server.js ───────────────

   It started as inline middleware. The problem is that a gate cannot
   reach inline middleware without booting the whole app, so the gate
   would have had to REIMPLEMENT the rule and then assert its own copy —
   which is the exact failure this codebase has hit before: the check
   passes, the shipped code is wrong, and the two never meet.

   As a pure function the gate tests the real decision, and a separate
   assertion proves server.js calls it. Mutating either one fails.

   ── THE RULE ───────────────────────────────────────────────────────────

   After cutover, both bathroomvanitiesoutlet.com and its www form resolve
   to this app and both answered 200 for every URL. The robots route
   already closes non-canonical hosts to crawlers, so nothing was indexed
   twice — but a disallowed host cannot pass signals, and the 661 old
   Shopify URLs carry signals worth keeping. A 301 consolidates them.
   Disallow only hides the problem.
   ═══════════════════════════════════════════════════════════════════════ */

/* No host is exempt.
 *
 * An earlier revision exempted *.hostingersite.com on the theory that the
 * staging hostname was an escape hatch worth preserving. That theory was
 * wrong: Hostinger performed a domain CHANGE rather than adding an alias
 * ("Website slategrey-falcon-350174.hostingersite.com domain was changed to
 * bathroomvanitiesoutlet.com", 2026-09-30 00:37:54), and the old hostname
 * now refuses connections outright — verified, ERR_HTTP2_PROTOCOL_ERROR.
 * There is nothing to protect, so the special case is gone rather than
 * left behind as dead code that implies a fallback exists. */
const EXEMPT_HOST = null;

/* Stripe's endpoint. The webhook is mounted above this middleware so it
   cannot reach here today, but retries are not worth betting on route
   ordering surviving a future edit. */
const EXEMPT_PATHS = new Set(['/checkout/webhook']);

/* Only GET and HEAD. A 301 on a POST is a trap: browsers may replay it as
   a GET and silently drop the body, so a form posted to the apex would
   appear to succeed and do nothing. */
const REDIRECTABLE = new Set(['GET', 'HEAD']);

/**
 * @param {object} req  { method, hostname, path, originalUrl }
 * @param {string} canonicalHost  e.g. 'www.bathroomvanitiesoutlet.com'
 * @returns {string|null}  absolute URL to 301 to, or null to do nothing.
 */
function redirectTarget(req, canonicalHost) {
  const canon = String(canonicalHost || '').trim().toLowerCase();
  /* No canonical host configured = no opinion. Without this a SITE_URL
     that reduces to '' would match no host and send every request to
     "https://", taking the whole site down. */
  if (!canon) return null;

  if (!REDIRECTABLE.has(String(req && req.method || '').toUpperCase())) return null;

  const host = String(req && req.hostname || '').trim().toLowerCase();
  if (!host) return null;
  if (host === canon) return null;
  if (EXEMPT_HOST && EXEMPT_HOST.test(host)) return null;
  if (EXEMPT_PATHS.has(String(req && req.path || ''))) return null;

  /* originalUrl carries the query string; path does not. Losing it would
     silently break every filtered collection URL in the old index. */
  const tail = String(req && req.originalUrl || '/') || '/';
  return `https://${canon}${tail}`;
}

module.exports = { redirectTarget, EXEMPT_HOST, EXEMPT_PATHS, REDIRECTABLE };
