/* ═══════════════════════════════════════════════════════════════════════════
   offerClaim.js — the Platinum Member 10% claim.

   ⚠️ THIS FILE IS THE REASON THE 10% IS NOT A BLANKET MARGIN CUT.

   Checkout requires an account — 45-point item 22, amended 2026-09-27:
   "NO GUEST. Account required, Wayfair-style." So EVERY first-time buyer
   creates an account whether they want an offer or not. A rule of "has an
   account and has not ordered before" would therefore grant 10% to 100% of
   new customers, silently — and on James Martin products, which already sit
   at MAP, that comes straight off the bone.

   TRADE_PROGRAM_SPEC §6: "eligibility is an explicit GRANT, never a
   property of having an account." Three conditions, ALL required:

     1. Enrolled through the offer   -> customers.offer_enrolled_at
     2. Marketing consent given      -> customers.accepts_marketing
     3. No prior captured order      -> checked at price time by tiers.js

   ⚠️ NOT signup_source. That column stays, for reporting. It is
   attribution metadata, and a money grant inferred from a descriptive
   label changes silently the day someone re-labels a path.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

/* ⚠️ REQUIRED LAZILY, INSIDE THE FUNCTIONS THAT USE IT.
   src/config/database.js calls process.exit when DB_PASS is unset, so a
   top-level require makes this whole module unloadable without a live
   environment — and a module a gate cannot LOAD is a module the gate has
   to re-implement, which is the Rule 18 trap. Deferring the require keeps
   the pure logic (session handling, the tier rules) executable by a gate
   while the database parts stay exactly as they were at runtime. */
function pool() { return require('../config/database').bvoPool; }
const tiers = require('../utils/tiers');

/* The version of the consent copy agreed to. Bump when the wording on the
   banner changes, so evidence rows say WHAT was agreed, not just that
   something was. Reuses the consent_copy_version column from #263-#266 —
   TRADE_PROGRAM_SPEC: "Do not build new evidence machinery." */
const CONSENT_COPY_VERSION = 'deals-banner-2026-10-21';

/** The session key. Survives regenerate() because establishSession carries
 *  it explicitly — see the note there and in markPending. */
const PENDING_KEY = 'pendingOfferClaim';

/**
 * Remember that this visitor arrived via the offer, BEFORE they have an
 * account.
 *
 * ⚠️ IN THE SESSION, NOT THE URL, and it has to be. The claim starts on
 * /collections/sale, goes to a login page, then to an emailed code, then
 * back. Query parameters do not survive that round trip; a session does.
 *
 * ⚠️ AND IT MUST BE CARRIED THROUGH session.regenerate(). establishSession
 * regenerates the session on sign-in to prevent fixation, which wipes
 * everything not explicitly carried. If this key is not in that carry
 * list, every claim is silently lost at the moment it would be granted.
 */
function markPending(req, optedIn) {
  if (!req || !req.session) return;
  /* ⚠️ THE TICK IS THE CLAIM. Unticked means no enrolment at all, not
     enrolment-without-consent: the 10% is consideration for the email AND
     permission to use it. Spec §6: "ticking it IS the claim." */
  if (!optedIn) return;
  req.session[PENDING_KEY] = { at: Date.now(), v: CONSENT_COPY_VERSION };
}

function hasPending(req) {
  return !!(req && req.session && req.session[PENDING_KEY]);
}

function clearPending(req) {
  if (req && req.session) delete req.session[PENDING_KEY];
}

/**
 * Grant the offer to a customer who has just signed in or been created.
 *
 * Idempotent and conservative: an existing enrolment is never overwritten,
 * and an already-trade account is never demoted to member.
 *
 * @returns {Promise<boolean>} true if this call enrolled them
 */
async function grant(customerId, ip) {
  if (!customerId) return false;
  try {
    const [rows] = await pool().query(
      'SELECT tier, offer_enrolled_at, accepts_marketing FROM customers WHERE id = ? LIMIT 1',
      [customerId]
    );
    const row = rows && rows[0];
    if (!row) return false;

    /* ⚠️ NEVER DEMOTE A TRADE ACCOUNT. A Platinum Trade customer who
       wanders onto the deals page and ticks the box must not drop from
       15% to 10%. Their marketing consent is still recorded below. */
    const keepTier = row.tier === tiers.STORED.PLATINUM_TRADE;

    /* Already enrolled: record nothing new. Re-stamping offer_enrolled_at
       would let someone refresh their way to a second "first order". */
    const alreadyEnrolled = !!row.offer_enrolled_at;

    await pool().query(
      `UPDATE customers
          SET tier                     = CASE WHEN ? THEN tier ELSE ? END,
              offer_enrolled_at        = COALESCE(offer_enrolled_at, NOW()),
              accepts_marketing        = 1,
              /* COALESCE: a customer who consented at checkout keeps that
                 original timestamp. Spec: the same consent reached by a
                 different route must not be double-counted. */
              marketing_consent_at     = COALESCE(marketing_consent_at, NOW()),
              marketing_consent_source = COALESCE(marketing_consent_source, 'deals_banner'),
              marketing_consent_ip     = COALESCE(marketing_consent_ip, ?),
              consent_copy_version     = COALESCE(consent_copy_version, ?)
        WHERE id = ?`,
      [keepTier ? 1 : 0, tiers.STORED.PLATINUM_MEMBER, ip || null, CONSENT_COPY_VERSION, customerId]
    );
    return !alreadyEnrolled;
  } catch (err) {
    /* Logged, never thrown. A failure here must not break a sign-in — the
       customer gets an account and no discount, which is recoverable;
       throwing would leave them unable to log in at all. */
    console.error('[offerClaim] grant FAILED:', err.code, err.sqlMessage || err.message);
    return false;
  }
}

/** Grant if a claim is pending, then clear it. Called after sign-in. */
async function settle(req, customerId, ip) {
  if (!hasPending(req)) return false;
  const granted = await grant(customerId, ip);
  clearPending(req);
  return granted;
}

module.exports = {
  markPending, hasPending, clearPending, grant, settle,
  PENDING_KEY, CONSENT_COPY_VERSION,
};
