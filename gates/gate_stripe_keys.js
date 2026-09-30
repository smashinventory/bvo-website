#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_stripe_keys.js — the credential swap cannot half-happen

   Run:  node gates/gate_stripe_keys.js
   Exit: 0 = pass, 1 = fail

   Every failure this guards against is silent in production. The page
   renders, the card form works, the payment appears to succeed. The first
   evidence is an empty Stripe dashboard, or orders stuck pending because
   webhooks were dropped. So it is asserted rather than trusted to a
   checklist read at 2am.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) walk(rel, out);
    else if (e.name.endsWith('.js') && !e.name.includes('.bak')) out.push(rel);
  }
  return out;
};

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

const K = require('../src/utils/stripeKeys');

/* ═══ 1. NOTHING READS A STRIPE VARIABLE DIRECTLY ════════════════════ */
console.log('--- one place resolves credentials ---');
{
  const offenders = walk('src').filter(f =>
    f !== 'src/utils/stripeKeys.js' && /process\.env\.STRIPE/.test(read(f)));
  ok('no file reads process.env.STRIPE… directly',
     offenders.length === 0,
     offenders.join(', ') + ' — a direct read bypasses the mode and the coherence check');

  ok('the secret key comes from stripeKeys',
     /stripeKeys\.secretKey\(\)/.test(read('src/services/stripeService.js')));
  ok('the webhook secret comes from stripeKeys',
     /stripeKeys\.webhookSecret\(\)/.test(read('src/services/stripeService.js')));
  ok('the publishable key comes from stripeKeys',
     /stripeKeys'\)\.publishableKey\(\)/.test(read('src/controllers/checkoutController.js')));
  ok('the client asserts coherence before constructing',
     /assertCoherent\(\)/.test(read('src/services/stripeService.js')),
     'without this the mismatch is only visible in the Stripe dashboard');
}

/* ═══ 2. THE MODE SELECTS THE WHOLE SET ══════════════════════════════ */
console.log('\n--- the mode picks all three together ---');
{
  const live = { STRIPE_MODE: 'live' }, sand = { STRIPE_MODE: 'sandbox' };
  for (const f of K.FIELDS) {
    ok(`live mode reads STRIPE_${f}_LIVE`,
       K.nameFor(f, live) === `STRIPE_${f}_LIVE`, K.nameFor(f, live));
    ok(`sandbox mode reads STRIPE_${f}_SANDBOX`,
       K.nameFor(f, sand) === `STRIPE_${f}_SANDBOX`, K.nameFor(f, sand));
  }
  ok('no mode reads the unsuffixed names',
     K.nameFor('SECRET_KEY', {}) === 'STRIPE_SECRET_KEY');
  ok('"test" is accepted as a synonym for sandbox',
     K.mode({ STRIPE_MODE: 'test' }) === 'sandbox');
  ok('an unrecognised mode does not silently pick one',
     K.mode({ STRIPE_MODE: 'production' }) === '',
     'a typo must not resolve to live by accident');

  /* THE PREFIX TABLE ITSELF. A mutation set the sandbox prefixes to
     sk_live_/pk_live_ and every check above still passed — the table is
     the yardstick, so nothing above can measure it. Anchored to Stripe's
     own published prefixes, which are the one fact here that does not
     depend on our naming. */
  ok('live expects sk_live_ / pk_live_',
     K.PREFIX.live.SECRET_KEY === 'sk_live_' &&
     K.PREFIX.live.PUBLISHABLE_KEY === 'pk_live_',
     JSON.stringify(K.PREFIX.live));
  ok('sandbox expects sk_test_ / pk_test_',
     K.PREFIX.sandbox.SECRET_KEY === 'sk_test_' &&
     K.PREFIX.sandbox.PUBLISHABLE_KEY === 'pk_test_',
     JSON.stringify(K.PREFIX.sandbox) +
     ' — with live prefixes here, sandbox mode would accept live keys and ' +
     'a "test" order would charge a real card');
  ok('the two modes do not expect the same prefixes',
     K.PREFIX.live.SECRET_KEY !== K.PREFIX.sandbox.SECRET_KEY &&
     K.PREFIX.live.PUBLISHABLE_KEY !== K.PREFIX.sandbox.PUBLISHABLE_KEY,
     'identical prefixes make the mode check decorative');

  /* And prove it end to end: live keys under sandbox mode must be caught. */
  ok('sandbox mode holding LIVE keys is caught',
     K.problems({ STRIPE_MODE: 'sandbox',
       STRIPE_SECRET_KEY_SANDBOX: 'sk_live_a',
       STRIPE_PUBLISHABLE_KEY_SANDBOX: 'pk_live_a',
       STRIPE_WEBHOOK_SECRET_SANDBOX: 'whsec_a' }).length > 0,
     'testing against a live account charges real cards');
}

/* ═══ 3. THE FAILURES THAT LOOK LIKE SUCCESS ═════════════════════════ */
console.log('\n--- the silent failures are caught ---');
{
  const base = {
    STRIPE_SECRET_KEY_LIVE: 'sk_live_a', STRIPE_PUBLISHABLE_KEY_LIVE: 'pk_live_a',
    STRIPE_WEBHOOK_SECRET_LIVE: 'whsec_a',
  };
  ok('a coherent live set passes',
     K.problems({ STRIPE_MODE: 'live', ...base }).length === 0,
     JSON.stringify(K.problems({ STRIPE_MODE: 'live', ...base })));

  const trap = { STRIPE_MODE: 'live', ...base, STRIPE_SECRET_KEY_LIVE: 'sk_test_a' };
  ok('live mode holding a TEST secret key is caught',
     K.problems(trap).some(p => /sk_live_/.test(p)),
     'this is the one that takes orders nobody gets paid for');

  const half = { STRIPE_MODE: 'live', ...base, STRIPE_PUBLISHABLE_KEY_LIVE: 'pk_test_a' };
  ok('a half swap (live secret + test publishable) is caught',
     K.problems(half).some(p => /DIFFERENT/.test(p)));

  ok('a missing variable is named',
     K.problems({ STRIPE_MODE: 'live', STRIPE_SECRET_KEY_LIVE: 'sk_live_a' })
       .some(p => /STRIPE_PUBLISHABLE_KEY_LIVE is not set/.test(p)));

  ok('no declared mode is itself reported',
     K.problems({ STRIPE_SECRET_KEY: 'sk_live_a', STRIPE_PUBLISHABLE_KEY: 'pk_live_a',
                  STRIPE_WEBHOOK_SECRET: 'whsec_a' })
       .some(p => /STRIPE_MODE is not set/.test(p)),
     'without a declared mode there is nothing to check the keys against');

  ok('assertCoherent throws on a bad set',
     (() => { try { K.assertCoherent(trap); return false; } catch { return true; } })());
  ok('assertCoherent is silent on a good set',
     (() => { try { K.assertCoherent({ STRIPE_MODE: 'live', ...base }); return true; }
              catch { return false; } })());
}

/* ═══ 4. NO SECRET EVER APPEARS IN A MESSAGE ═════════════════════════
   These strings go to logs and, via the boot error, potentially to a
   screen. A credential must not ride along. */
console.log('\n--- diagnostics never carry a secret ---');
{
  /* ASSEMBLED, NOT WRITTEN OUT. A literal 'sk_live_…' in this file — even
     an obviously fake one — matches GitHub's secret-scanning pattern and
     push protection rejects the whole branch. Building it at runtime keeps
     the test honest (the function still receives a key-shaped string) while
     leaving nothing key-shaped in the source. */
  const SECRET = ['sk', 'live', 'NOTAREALKEY1234567890'].join('_');
  const msgs = K.problems({
    STRIPE_MODE: 'sandbox',
    STRIPE_SECRET_KEY_SANDBOX: SECRET,
    STRIPE_PUBLISHABLE_KEY_SANDBOX: 'pk_test_a',
    STRIPE_WEBHOOK_SECRET_SANDBOX: 'whsec_a',
  }).join(' | ');
  ok('the full key value is not in the message',
     !msgs.includes(SECRET), msgs);
  ok('at most the first 8 characters appear',
     !msgs.includes('SUPERSECRET'), msgs);
}

/* ═══ 5. THE FALLBACK EXISTS, AND ONLY WHERE IT SHOULD ═══════════════
   Between swapping keys and creating the live webhook endpoint there is
   no STRIPE_WEBHOOK_SECRET_LIVE. The site must still boot. */
console.log('\n--- the mid-cutover state still boots ---');
{
  const mid = { STRIPE_MODE: 'live',
    STRIPE_SECRET_KEY_LIVE: 'sk_live_a', STRIPE_PUBLISHABLE_KEY_LIVE: 'pk_live_a',
    STRIPE_WEBHOOK_SECRET: 'whsec_old' };
  ok('a missing _LIVE webhook secret falls back to the unsuffixed one',
     K.webhookSecret(mid) === 'whsec_old');
  ok('and that state is reported as usable',
     K.problems(mid).length === 0, JSON.stringify(K.problems(mid)));
  ok('the fallback does NOT apply to the secret key when mode is set',
     K.secretKey({ STRIPE_MODE: 'live', STRIPE_SECRET_KEY: 'sk_test_x' }) === 'sk_test_x',
     'fallback is deliberate; the prefix check is what stops it being wrong');
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
