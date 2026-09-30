'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   stripeKeys.js — which Stripe credentials are in force, and a check that
   they are the ones you think they are.

   ── WHY ────────────────────────────────────────────────────────────────

   The environment carries three sets of the same three secrets:

       STRIPE_*_LIVE       the live account
       STRIPE_*_SANDBOX    the sandbox, kept for future testing
       STRIPE_*            whichever set is active

   Two things go wrong with that shape, and neither announces itself:

     1. THE WRONG SET GETS FILLED IN. The code only ever read the
        unsuffixed names, so putting live values in STRIPE_*_LIVE and
        stopping there leaves the storefront on test keys. Checkout still
        renders, the card form still works, the payment "succeeds" — and
        no money moves. The first sign is an empty Stripe dashboard.

     2. A HALF-SWAP. Live secret key, sandbox webhook secret. Payments
        take money; webhooks fail signature verification and are dropped
        silently, so orders never leave "pending" and nothing is logged
        as an error.

   Both are caught here, at boot, by reading the mode and then checking
   the keys actually match it. A mismatch throws with the variable named.

   ── HOW TO SWITCH ──────────────────────────────────────────────────────

       STRIPE_MODE=live       → uses STRIPE_*_LIVE
       STRIPE_MODE=sandbox    → uses STRIPE_*_SANDBOX
       STRIPE_MODE unset      → uses the unsuffixed STRIPE_*

   Changing one variable moves the whole set together, which is the point:
   a half-swap stops being expressible.
   ═══════════════════════════════════════════════════════════════════════ */

const FIELDS = ['SECRET_KEY', 'PUBLISHABLE_KEY', 'WEBHOOK_SECRET'];

/* What a key for each mode must start with. Stripe's own prefixes — the
   one piece of evidence that does not depend on anybody's naming. */
const PREFIX = {
  live:    { SECRET_KEY: 'sk_live_', PUBLISHABLE_KEY: 'pk_live_', WEBHOOK_SECRET: 'whsec_' },
  sandbox: { SECRET_KEY: 'sk_test_', PUBLISHABLE_KEY: 'pk_test_', WEBHOOK_SECRET: 'whsec_' },
};

/** 'live' | 'sandbox' | '' (unsuffixed). Anything unrecognised is ''. */
function mode(env = process.env) {
  const m = String(env.STRIPE_MODE || '').trim().toLowerCase();
  if (m === 'live') return 'live';
  if (m === 'sandbox' || m === 'test') return 'sandbox';
  return '';
}

/** The env var name this deployment reads for one field. */
function nameFor(field, env = process.env) {
  const m = mode(env);
  return m ? `STRIPE_${field}_${m.toUpperCase()}` : `STRIPE_${field}`;
}

/**
 * Resolve one credential.
 *
 * FALLS BACK TO THE UNSUFFIXED NAME. With STRIPE_MODE=live and no
 * STRIPE_WEBHOOK_SECRET_LIVE yet — which is exactly the state between
 * swapping keys and creating the live webhook endpoint — this uses
 * STRIPE_WEBHOOK_SECRET rather than leaving the site unable to boot.
 */
function get(field, env = process.env) {
  const primary = nameFor(field, env);
  const v = (env[primary] || '').trim();
  if (v) return v;
  const fallback = `STRIPE_${field}`;
  return (env[fallback] || '').trim();
}

const secretKey      = (env = process.env) => get('SECRET_KEY', env);
const publishableKey = (env = process.env) => get('PUBLISHABLE_KEY', env);
const webhookSecret  = (env = process.env) => get('WEBHOOK_SECRET', env);

/**
 * Every problem this file exists to catch, as a list of strings.
 * Empty array = coherent. Never throws; the caller decides what to do.
 *
 * Values are NEVER included in a message — only the variable name and the
 * prefix that was found, so this is safe to log.
 */
function problems(env = process.env) {
  const out = [];
  const m = mode(env);

  for (const f of FIELDS) {
    if (!get(f, env)) out.push(`${nameFor(f, env)} is not set`);
  }
  if (out.length) return out;

  /* Prefix check. Only meaningful when a mode is declared — with no mode
     we have nothing to compare the keys against, which is itself worth
     saying once cutover has happened. */
  if (!m) {
    out.push('STRIPE_MODE is not set, so the keys in use cannot be checked ' +
             'against a declared mode — set it to live or sandbox');
    return out;
  }

  for (const f of FIELDS) {
    const v = get(f, env);
    const want = PREFIX[m][f];
    if (!v.startsWith(want)) {
      out.push(`${nameFor(f, env)} does not start with "${want}" ` +
               `(found "${v.slice(0, 8)}…") — STRIPE_MODE says ${m}`);
    }
  }

  /* The half-swap: a live secret key next to a test publishable key, or
     the reverse. Caught above by the prefix rule, but named explicitly
     because it is the failure that looks most like success. */
  const sk = secretKey(env), pk = publishableKey(env);
  if (sk && pk) {
    const skLive = sk.startsWith('sk_live_'), pkLive = pk.startsWith('pk_live_');
    if (skLive !== pkLive) {
      out.push('the secret key and the publishable key are from DIFFERENT ' +
               'Stripe modes — the browser and the server would disagree ' +
               'about which account is taking the payment');
    }
  }
  return out;
}

/** Throw if anything is incoherent. Called where a real payment depends on it. */
function assertCoherent(env = process.env) {
  const p = problems(env);
  if (p.length) {
    throw new Error('Stripe configuration is not usable:\n  - ' + p.join('\n  - '));
  }
}

module.exports = {
  mode, nameFor, get, secretKey, publishableKey, webhookSecret,
  problems, assertCoherent, FIELDS, PREFIX,
};
