'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   csrfToken.js — ONE definition of the CSRF token, and one way to check it.

   WHY THIS FILE EXISTS
   --------------------
   The token was generated and validated inline in server.js. That was fine
   while every protected request was urlencoded, because one middleware could
   do the whole job in one place.

   It stopped being fine the moment a plain HTML form carried a file.

   THE DEFECT (found 2026-10-22, live, on /trade/apply)
   ----------------------------------------------------
   The global validator reads `req.body._csrf`. For `multipart/form-data`,
   req.body is EMPTY at that point in the chain — express.urlencoded and
   express.json do not touch multipart, and multer runs later, inside the
   route. So the token is not "wrong", it is UNREADABLE, and every plain
   multipart form POST 403s no matter what it sends.

   Proven by repro rather than inferred: same middleware order, urlencoded
   POST sees `['_csrf','name']`, multipart POST sees `[]`.

   WHY IT WAS INVISIBLE FOR MONTHS
   -------------------------------
   `b2b9256` shipped a fetch() interceptor that attaches X-CSRF-Token to every
   fetch. Header-based requests are immune to this bug, and nearly every
   upload in the admin goes through fetch. Only three surfaces post a
   multipart form the old-fashioned way:

     • /trade/apply          — the trade application (file uploads)
     • /admin/products/import     — CSV import
     • /admin/products/import-jm  — JM feed import

   All three have been returning 403 for anyone who tried them.

   THE RULE THIS FILE ENCODES
   --------------------------
   A multipart request cannot be validated until SOMETHING has parsed the
   body. So validation for those requests is DEFERRED to after multer, and
   `requireCsrf` is what performs it there. The global guard marks the
   request deferred; the route must clear it.

   ⚠️ A DEFERRED REQUEST THAT IS NEVER VERIFIED HAS NO CSRF PROTECTION AT
   ALL. That is a worse failure than a 403, and it is silent. Two things
   guard it: `assertVerified` shouts at runtime, and gate_csrf_multipart.js
   fails the build if a multer route has no requireCsrf after it.
   ═══════════════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

/** Token is an HMAC of the session id — no session write, no DB, worker-safe. */
function makeToken(sessionId) {
  return crypto.createHmac('sha256', process.env.SESSION_SECRET)
    .update(sessionId || 'anonymous')
    .digest('hex');
}

/** Methods that never carry state changes and so never need a token. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Pull the token out of wherever this request carries it.
 *
 * ⚠️ THE HEADER IS CHECKED FIRST AND THAT MATTERS FOR MULTIPART.
 * A fetch() upload carries X-CSRF-Token and is readable immediately, so it
 * never needs deferring. Only a request with NO header has to wait for the
 * body to be parsed.
 */
function tokenFrom(req) {
  /* req.body._csrf may be an array when a page nests forms — both entries
     are the same token, so take the first. */
  const raw = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  return Array.isArray(raw) ? raw[0] : raw;
}

function isMultipart(req) {
  return (req.headers['content-type'] || '').includes('multipart/form-data');
}

/**
 * Does this request carry a valid token RIGHT NOW?
 * Pure apart from reading req — no response, no side effects, so a gate can
 * execute it. Rule 14.
 */
function verify(req) {
  const token = tokenFrom(req);
  if (!token) return false;
  const expected = makeToken(req.sessionID);
  /* Lengths are equal by construction (both hex sha256) but a malformed
     client token can be any length, and timingSafeEqual throws on a length
     mismatch rather than returning false. */
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Should the failure be reported as JSON rather than an HTML error page?
 *
 * ⚠️ "multipart" IS NOT IN THIS LIST ANY MORE, AND ITS PRESENCE WAS A
 * SEPARATE BUG. The old check treated any multipart POST as an API call, so
 * a human submitting the trade application got `{"ok":false,...}` rendered
 * as a bare page — losing every field they had typed and every file they had
 * attached. A form post wants a page; a fetch wants JSON. The header the
 * client actually sends is what distinguishes them.
 */
function wantsJson(req) {
  return (req.headers.accept || '').includes('application/json')
      || req.headers['x-requested-with'] === 'XMLHttpRequest';
}

module.exports = { makeToken, verify, tokenFrom, isMultipart, wantsJson, SAFE_METHODS };
