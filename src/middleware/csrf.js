'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   csrf.js — the two halves of CSRF validation.

   `globalGuard`  runs app-wide, before the routers. It validates everything
                  it CAN validate, and defers what it cannot.
   `requireCsrf`  runs inside a route, AFTER multer, and performs the
                  deferred check.

   WHY TWO HALVES — see src/utils/csrfToken.js for the full defect writeup.
   Short version: for multipart/form-data, req.body is empty until multer
   runs, and multer runs inside the route. The global guard physically
   cannot read the token, so for those requests it must wait.

   ⚠️ THE DANGEROUS FAILURE IS NOT A 403, IT IS A SILENT PASS.
   If a multipart route is added and nobody mounts requireCsrf after its
   multer, that route is deferred and then never checked — i.e. it has NO
   CSRF protection and nothing says so. That is strictly worse than the bug
   being fixed here. Three things guard it, deliberately overlapping:

     1. requireCsrf clears the deferral flag.
     2. finishGuard logs loudly if a deferred request responds unverified.
     3. gates/gate_csrf_multipart.js fails the build on a multer route with
        no requireCsrf after it.

   (2) does not block the response. By the time headers are sent, the
   handler has already done its work — refusing at that point would leave a
   half-done side effect and an error page, which is the worst of both. The
   runtime job is to be impossible to miss in the log; the build-time job
   belongs to the gate.
   ═══════════════════════════════════════════════════════════════════════════ */

const t = require('../utils/csrfToken');

/** Marker, on req, meaning "nobody has checked this yet". */
const PENDING = Symbol.for('bvo.csrf.pending');

function _reject(req, res) {
  console.warn('[CSRF] token mismatch', req.method, req.path,
    '| has_token:', !!t.tokenFrom(req),
    '| has_session_id:', !!req.sessionID,
    '| multipart:', t.isMultipart(req));

  if (t.wantsJson(req)) {
    return res.status(403).json({ ok: false, error: 'Invalid CSRF token' });
  }
  return res.status(403).render('pages/error', {
    pageTitle: 'Security Error | BathroomVanitiesOutlet.com',
    message: 'Your session may have expired. Please go back and try again.',
  });
}

/**
 * App-wide guard. Mount once, before the routers.
 */
function globalGuard(req, res, next) {
  if (t.SAFE_METHODS.has(req.method)) return next();
  if (req.path.startsWith('/api/')) return next();   // API uses bearer auth

  /* A readable token is validated immediately, multipart or not — a fetch()
     upload carries X-CSRF-Token and needs no special treatment. Deferring
     is only for requests whose token is genuinely unreadable yet. */
  if (t.tokenFrom(req) !== undefined) {
    return t.verify(req) ? next() : _reject(req, res);
  }

  if (t.isMultipart(req)) {
    req[PENDING] = true;
    _armFinishGuard(req, res);
    return next();
  }

  /* Not multipart and no token anywhere — there is nothing to wait for. */
  return _reject(req, res);
}

/**
 * Route-level check for deferred (multipart) requests.
 * Mount AFTER the multer middleware that populates req.body.
 *
 * Safe to mount on a route that was not deferred — it simply re-verifies,
 * which is cheap and makes the route correct in isolation rather than
 * correct only given what ran before it.
 */
function requireCsrf(req, res, next) {
  if (t.SAFE_METHODS.has(req.method)) return next();
  if (!t.verify(req)) return _reject(req, res);
  req[PENDING] = false;
  return next();
}

/**
 * ⚠️ FAIL LOUD, NOT FAIL SILENT.
 * Wraps res.end once, to notice a deferred request that answered without
 * ever being verified. Logs; does not alter the response — see the header.
 */
function _armFinishGuard(req, res) {
  const end = res.end;
  res.end = function (...args) {
    if (req[PENDING] === true && res.statusCode < 400) {
      console.error(
        '\n[CSRF] *** UNVERIFIED MULTIPART REQUEST COMPLETED ***\n' +
        `       ${req.method} ${req.path} answered ${res.statusCode} with NO CSRF CHECK.\n` +
        '       The global guard deferred it and no requireCsrf ran afterwards,\n' +
        '       so this route is currently unprotected against CSRF.\n' +
        '       FIX: add csrf.requireCsrf immediately after the multer middleware\n' +
        '       on this route. See src/utils/csrfToken.js.\n');
    }
    return end.apply(this, args);
  };
}

module.exports = { globalGuard, requireCsrf, PENDING };
