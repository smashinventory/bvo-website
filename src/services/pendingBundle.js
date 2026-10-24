/* ═══════════════════════════════════════════════════════════════════════════
   pendingBundle.js — a bundle built while signed OUT, saved after sign-in.

   THE BUG THIS EXISTS FOR (owner, 2026-10-24):

     Build a bundle signed out -> press Save -> asked for an email -> verify
     by code -> land on the dashboard WITH NO BUNDLE SAVED. The only way to
     keep it was to sign in first and build the whole thing again.

   Two separate faults produced that, and both are fixed around this file:

     1. THE SELECTION WAS NEVER STORED. bundleController.saveBundle answered
        401 and the builder redirected to sign in, discarding `state` in the
        page. The old comment in bundle-builder.ejs said so outright — "the
        first pass does not restore the selection" — which documented the
        behaviour without making it acceptable.

     2. THE RETURN URL WAS IGNORED. The builder sent ?next=/bundle-builder
        while the login page reads `return_to` out of req.session.returnTo,
        falling back to '/account'. The names never matched, so every visitor
        landed on the dashboard regardless. That is the dashboard the owner
        described.

   ⚠️ IN THE SESSION, NOT THE URL. The round trip is Save -> login page ->
   emailed code -> back. Query parameters do not survive that; a session
   does. Exactly the reasoning in offerClaim.js, which solves the identical
   shape of problem, and this file deliberately mirrors its structure rather
   than inventing a second pattern.

   ⚠️ AND IT MUST BE CARRIED THROUGH session.regenerate(). establishSession
   regenerates on sign-in to prevent fixation, which wipes everything not
   explicitly named in its carry list. A pending bundle missing from that
   list is silently destroyed at the exact moment it would be redeemed —
   the same way the cart was silently emptied before 2026-09-28 and every
   offer claim was lost before the key was added there.

   ⚠️ ONE DEFINITION OF A VALID BUNDLE. normalise() and insert() live here
   and are used BOTH by the signed-in save path and by the post-sign-in
   redemption. bundleController previously owned private _id/_qty helpers;
   had the redemption grown its own copy, the two would have drifted — the
   Rule 18 trap, where a second implementation agrees with itself instead of
   with the subject.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

/* ⚠️ REQUIRED LAZILY. src/config/database.js calls process.exit when
   DB_PASS is unset, so a top-level require makes this module unloadable
   without a live environment — and a module a gate cannot LOAD is one the
   gate must re-implement. Deferring keeps normalise() executable by a gate
   while the database half stays exactly as it is at runtime. Same reasoning
   as offerClaim.js. */
function pool() { return require('../config/database').bvoPool; }

/** Survives regenerate() only because establishSession names it. */
const PENDING_KEY = 'pendingBundle';

/** A scripted loop must not be able to fill the table. Generous on purpose:
 *  someone planning two bathrooms may legitimately save several. */
const MAX_SAVED = 50;

/** Qty ceiling per line — mirrors the builder's own cap. */
const MAX_QTY = 20;

function _id(v) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function _qty(v) {
  const n = parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_QTY) : 1;
}

/**
 * Turn a request body into a bundle row, or null if there is nothing worth
 * saving.
 *
 * ⚠️ RETURNS null FOR AN EMPTY BUNDLE RATHER THAN AN EMPTY OBJECT. Saving
 * one would put a card in the dashboard with nothing in it, which reads as
 * a bug to the customer. It also means a stray Save press by a signed-out
 * visitor who has picked nothing cannot plant a pending row that silently
 * appears after they sign in for some unrelated reason.
 */
function normalise(body) {
  const b = body || {};
  const row = {
    cabinet_id: _id(b.cabinet),
    top_id:     _id(b.top),
    mirror_id:  _id(b.mirror),
    faucet_id:  _id(b.faucet),
    mirror_qty: _qty(b.mirrorQty),
    faucet_qty: _qty(b.faucetQty),
  };
  const hasAnything = !!(row.cabinet_id || row.top_id || row.mirror_id || row.faucet_id);
  return hasAnything ? row : null;
}

/** Remember a bundle built before the visitor had an account. */
function markPending(req, body) {
  if (!req || !req.session) return null;
  const row = normalise(body);
  if (!row) return null;
  req.session[PENDING_KEY] = { at: Date.now(), row };
  return row;
}

function hasPending(req) {
  return !!(req && req.session && req.session[PENDING_KEY]
            && req.session[PENDING_KEY].row);
}

function peek(req) {
  return hasPending(req) ? req.session[PENDING_KEY].row : null;
}

function clearPending(req) {
  if (req && req.session) delete req.session[PENDING_KEY];
}

/**
 * Write a bundle row for a customer. The ONE insert, shared by the
 * signed-in path and the redemption path.
 *
 * @returns {Promise<{ok:boolean, id?:number, error?:string}>}
 */
async function insert(customerId, row) {
  if (!customerId) return { ok: false, error: 'sign-in-required' };
  if (!row)        return { ok: false, error: 'empty-bundle' };

  const [[{ n }]] = await pool().query(
    'SELECT COUNT(*) AS n FROM saved_bundles WHERE customer_id = ?', [customerId]
  );
  if (n >= MAX_SAVED) return { ok: false, error: 'too-many-saved' };

  const [r] = await pool().query(
    `INSERT INTO saved_bundles
       (customer_id, cabinet_id, top_id, mirror_id, mirror_qty, faucet_id, faucet_qty)
     VALUES (?,?,?,?,?,?,?)`,
    [customerId, row.cabinet_id, row.top_id, row.mirror_id,
     row.mirror_qty, row.faucet_id, row.faucet_qty]
  );
  return { ok: true, id: r.insertId };
}

/**
 * Redeem a pending bundle immediately after sign-in.
 *
 * ⚠️ NEVER THROWS, AND THE SESSION KEY IS CLEARED EITHER WAY. This runs on
 * the sign-in path. A failure here must not turn a successful sign-in into
 * an error page — the customer would be left unable to log in because of a
 * saved bundle, which is far worse than a lost bundle. And leaving the key
 * behind on failure would re-attempt the same doomed insert on every later
 * sign-in, forever.
 *
 * ⚠️ CALL IT AFTER establishSession, never before. regenerate() wipes the
 * session, so a redemption done first would read a key that is about to be
 * destroyed and attribute the row to a session that no longer exists. Same
 * ordering rule offerClaim.settle already obeys.
 */
async function settle(req, customerId) {
  if (!hasPending(req)) return { ok: false, error: 'nothing-pending' };
  const row = peek(req);
  clearPending(req);
  if (!customerId) return { ok: false, error: 'sign-in-required' };
  try {
    return await insert(customerId, row);
  } catch (err) {
    console.error('[pendingBundle.settle] insert failed:', err && err.message);
    return { ok: false, error: 'save-failed' };
  }
}

module.exports = {
  PENDING_KEY, MAX_SAVED, MAX_QTY,
  normalise, markPending, hasPending, peek, clearPending, insert, settle,
};
