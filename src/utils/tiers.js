/* ═══════════════════════════════════════════════════════════════════════════
   tiers.js — the customer tier ladder and what each one is worth.

   THE LADDER (TRADE_PROGRAM_SPEC.md §1, owner 2026-10-21). These names are
   CANONICAL — they appear in customer copy, in the admin and in the stored
   value. Do not invent "Trade+", "Gold" or "Pro".

     none             retail, no offer          0%
     platinum_member  claimed the 10% offer    10%   FIRST ORDER ONLY
     platinum_trade   approved application     15%   ongoing
     elite_trade      $20,000 rolling 12mo     20%   ongoing, COMPUTED

   ⚠️ PLATINUM MEMBER IS RETAIL, NOT TRADE. It shares this engine and is
   listed here so the ladder is in one place, but a Platinum Member has
   uploaded nothing, been approved by nobody, and gets one discount on one
   order. The shared word "Platinum" must not collapse the two: the trade
   tiers are ongoing and MAP-gated, the member tier is single-use.

   ⚠️ ELITE TRADE IS COMPUTED, NEVER STORED. The $20,000 is a ROLLING
   12-month figure, so the tier is derived at price time from captured
   revenue. Writing "elite" onto the account would freeze someone at 20%
   after their spend fell away — and the rolling window exists precisely so
   it CAN fall away. The stored column distinguishes approved-trade from
   retail; which trade tier they are on today is a calculation.

   ⚠️ THE CLOCK RUNS ON CAPTURE, NOT ORDER DATE. src/config/revenue.js is
   the single source: nothing counts until payment_captured_at is set. An
   authorised-but-uncaptured order must not move the meter, and a cancelled
   order must not leave someone promoted.

   This module is PURE — no database, no request. The caller resolves the
   facts (stored tier, rolling spend, whether a first order exists) and
   passes them in. That is what lets a gate execute it instead of
   re-implementing it, which is Rule 18.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

/* The stored values. One column with these three states beats is_trade +
   is_member booleans, which permit nonsense combinations (both true?) and
   need reconciling every time one is read. */
const STORED = Object.freeze({
  NONE:            'none',
  PLATINUM_MEMBER: 'platinum_member',
  PLATINUM_TRADE:  'platinum_trade',
});

/* elite_trade is NOT in STORED — it is never written. It exists only as a
   resolved result. */
const RESOLVED = Object.freeze({
  NONE:            'none',
  PLATINUM_MEMBER: 'platinum_member',
  PLATINUM_TRADE:  'platinum_trade',
  ELITE_TRADE:     'elite_trade',
});

const LABELS = Object.freeze({
  none:            'Retail',
  platinum_member: 'Platinum Member',
  platinum_trade:  'Platinum Trade',
  elite_trade:     'Elite Trade',
});

const PCT = Object.freeze({
  none:            0,
  platinum_member: 10,
  platinum_trade:  15,
  elite_trade:     20,
});

/** $20,000 of CAPTURED revenue in a rolling 365 days. Owner, 2026-10-21. */
const ELITE_THRESHOLD = 20000;
const ROLLING_DAYS    = 365;

/** Trade tiers are MAP-gated: never price them for a logged-out visitor. */
const TRADE_TIERS = Object.freeze([RESOLVED.PLATINUM_TRADE, RESOLVED.ELITE_TRADE]);
function isTradeTier(tier) { return TRADE_TIERS.indexOf(tier) !== -1; }

/**
 * Resolve the tier that applies RIGHT NOW.
 *
 * @param {object} f
 * @param {string}  f.storedTier      customers.tier — one of STORED
 * @param {number}  f.rollingSpend    captured revenue, last 365 days
 * @param {boolean} f.hasCapturedOrder has this customer EVER had an order
 *                                     captured? (revenue.js IS_COUNTED)
 * @param {boolean} f.isLoggedIn      MAP: trade pricing requires a session
 */
function resolveTier(f) {
  const facts = f || {};
  const stored = facts.storedTier;

  /* ⚠️ MAP COMPLIANCE, AND IT IS THE FIRST TEST ON PURPOSE.
     TRADE_PROGRAM_SPEC: "Trade pricing must never render to a logged-out
     visitor. Not in a cached page, not in a meta tag, not in structured
     data, not in the product feed, not in the Merchant Center export."
     A 15% discount on a public page is advertising below James Martin's
     MAP; the same discount behind a login is not advertised at all. The
     login gate is the COMPLIANCE mechanism, not a perk mechanism.
     Enforcement is a written warning, 24 hours, and JM may withhold
     shipment. So a logged-out request resolves to retail, full stop. */
  if (!facts.isLoggedIn) return RESOLVED.NONE;

  if (stored === STORED.PLATINUM_TRADE) {
    const spend = Number(facts.rollingSpend);
    /* >= and not >: $20,000 exactly qualifies. A customer who hits the
       number to the dollar and is told "not yet" is the kind of detail
       that costs an account. */
    return (Number.isFinite(spend) && spend >= ELITE_THRESHOLD)
      ? RESOLVED.ELITE_TRADE
      : RESOLVED.PLATINUM_TRADE;
  }

  if (stored === STORED.PLATINUM_MEMBER) {
    /* ⚠️ FIRST ORDER ONLY, measured on CAPTURE. Without this an enrolled
       customer claims 10% on their fifth purchase forever. revenue.js is
       the authority on what counts — authorised-but-uncaptured is not a
       sale, so it must not burn the offer either. */
    return facts.hasCapturedOrder ? RESOLVED.NONE : RESOLVED.PLATINUM_MEMBER;
  }

  return RESOLVED.NONE;
}

/** The percentage that tier is worth. Unknown tiers are worth nothing. */
function tierPct(tier) {
  return Object.prototype.hasOwnProperty.call(PCT, tier) ? PCT[tier] : 0;
}

function tierLabel(tier) {
  return Object.prototype.hasOwnProperty.call(LABELS, tier) ? LABELS[tier] : LABELS.none;
}

/**
 * The Elite Trade spend meter.
 *
 * ⚠️ THE FIGURE CAN GO DOWN, AND THE COPY MUST SAY SO. The window is
 * rolling, so spend ages out. A customer who drops from 20% to 15% without
 * warning will reasonably feel cheated — TRADE_PROGRAM_SPEC §1 calls this
 * out explicitly.
 */
function spendMeter(rollingSpend) {
  const spent = Math.max(0, Number(rollingSpend) || 0);
  const pct = Math.max(0, Math.min(100, (spent / ELITE_THRESHOLD) * 100));
  const remaining = Math.max(0, ELITE_THRESHOLD - spent);
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  return {
    spent,
    target: ELITE_THRESHOLD,
    remaining,
    pct: Math.round(pct * 10) / 10,
    reached: spent >= ELITE_THRESHOLD,
    spentLabel:     money(spent),
    targetLabel:    money(ELITE_THRESHOLD),
    remainingLabel: money(remaining),
  };
}

module.exports = {
  STORED, RESOLVED, LABELS, PCT,
  ELITE_THRESHOLD, ROLLING_DAYS, TRADE_TIERS,
  resolveTier, tierPct, tierLabel, isTradeTier, spendMeter,
};
