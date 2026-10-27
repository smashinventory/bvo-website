#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_unsubscribe.js
 *
 * THE RULES, IN ORDER OF WHAT THEY COST WHEN BROKEN:
 *
 *  1. UNSUBSCRIBE MUST NOT KILL TRANSACTIONAL MAIL. It writes
 *     customers.accepts_marketing and nothing else. Brevo's blocklist
 *     stops EVERY message to an address — including the six-digit
 *     sign-in code, which on a passwordless site locks somebody out of
 *     their own account. That is #376, open for exactly this reason.
 *
 *  2. GET MUST NOT UNSUBSCRIBE. Mail clients and corporate gateways
 *     prefetch links to scan them. A GET that acted would silently
 *     revoke consent for everyone behind a scanner, and nobody would
 *     ever notice: the customer stops hearing from us and does not
 *     complain, because they do not know.
 *
 *  3. THE TOKEN MUST BE UNFORGEABLE and compared in constant time.
 *
 *  4. POST MUST BE CSRF-EXEMPT. RFC 8058 one-click posts from Gmail's
 *     infrastructure with no session and no token. If that button fails
 *     silently the customer believes they are unsubscribed, keeps
 *     receiving mail, and reports it as spam — the outcome this whole
 *     feature exists to avoid.
 *
 * ⚠️ THE TOKEN SECTION *RUNS* unsubscribeToken.js. A gate that
 * re-implements its subject agrees with the bug. Only the structural
 * rules are grepped, because a route registration cannot be executed
 * without booting the app.
 *
 * Run:  node gates/gate_unsubscribe.js
 * Exit: 0 = pass, 1 = fail
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

/* The util throws at call time without a secret. Set one for the gate so
   the behaviour under test is the signing itself, not the environment. */
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'gate-fixture-secret';
const token = require(path.join(ROOT, 'src/utils/unsubscribeToken'));

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};
const read  = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/<%#[\s\S]*?%>/g, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '')
                    .replace(/^\s*\/\/.*$/gm, '');

console.log('\ngate_unsubscribe — turns off marketing, never the sign-in code\n');

/* ═══ 1. THE TOKEN, EXECUTED ═════════════════════════════════════════ */
console.log('--- the token round-trips and resists forgery (running it) ---');
{
  const email = 'someone@example.com';
  const good  = token.sign(email);

  check(typeof good === 'string' && good.includes('.'), 'sign() produces a token');
  check(token.verify(good) === email, 'a valid token returns its email');

  check(token.verify(token.sign('SomeOne@Example.COM')) === email,
        'addresses are matched case-insensitively',
        'a token that fails because a client capitalised the address is ' +
        'an unsubscribe that does not work');

  /* Forgery: keep the payload, change the MAC. */
  check(token.verify(good.slice(0, -1) + (good.endsWith('A') ? 'B' : 'A')) === null,
        'a tampered signature is rejected');

  /* Forgery: keep the MAC, swap the address — the attack that would let
     one person unsubscribe another. */
  const mac    = good.split('.').pop();
  const forged = Buffer.from('victim@example.com').toString('base64url') + '.' + mac;
  check(token.verify(forged) === null,
        'a signature cannot be reused for a DIFFERENT address',
        'otherwise one valid link unsubscribes anybody');

  for (const junk of ['', null, undefined, 'nonsense', '.', 'a.b', 'notbase64.xxxx']) {
    check(token.verify(junk) === null, `junk token ${JSON.stringify(junk)} is rejected`);
  }

  /* A payload that decodes but is not an address. */
  check(token.verify(Buffer.from('no-at-sign').toString('base64url') + '.' + mac) === null,
        'a payload with no @ is rejected');

  check(/^https:\/\/[^ ]+\/unsubscribe\?t=/.test(token.url(email)),
        'url() builds an https /unsubscribe link');
}

/* ═══ 2. SCOPE — MARKETING ONLY ══════════════════════════════════════ */
console.log('\n--- it turns off marketing and NOTHING else ---');
{
  const ctrl = strip(read('src/controllers/unsubscribeController.js'));

  check(/accepts_marketing\s*=\s*0/.test(ctrl),
        'it clears accepts_marketing');

  /* The blocklist is the thing that must not be touched. */
  check(!/blocklist|email_blocked|blockContact|createBlocked/i.test(ctrl),
        'it does NOT touch the Brevo blocklist or email_blocked',
        'that blocks every message including the sign-in code — #376');

  check(/marketing_consent_at\s*=\s*NOW\(\)/.test(ctrl),
        'it stamps marketing_consent_at',
        'flag-without-timestamp reads later as "never asked", and the ' +
        'person could be asked again');
  check(/unsubscribe_link/.test(ctrl),
        'it records the source of the preference');

  /* An unsubscribe that fails quietly is the worst available outcome. */
  check(!/catch\s*\([^)]*\)\s*\{\s*\}/.test(ctrl) && /console\.error/.test(ctrl),
        'a failure is logged, not swallowed',
        'silently failing means we keep mailing somebody who was told ' +
        'they were removed — the next step is a spam report');
}

/* ═══ 3. GET SHOWS, POST ACTS ════════════════════════════════════════ */
console.log('\n--- a prefetched link cannot unsubscribe anybody ---');
{
  const ctrl = strip(read('src/controllers/unsubscribeController.js'));
  const get  = ctrl.slice(ctrl.indexOf('exports.page'), ctrl.indexOf('exports.submit'));
  const post = ctrl.slice(ctrl.indexOf('exports.submit'));

  check(get.length > 50 && post.length > 50, 'both handlers exist');
  check(!/UPDATE\s+customers/i.test(get),
        'the GET handler writes NOTHING',
        'mail scanners prefetch links; a writing GET revokes consent ' +
        'silently for everyone behind one');
  check(/UPDATE\s+customers/i.test(post),
        'the POST handler is the one that writes');

  const srv = strip(read('src/server.js'));
  check(/app\.get\('\/unsubscribe'/.test(srv) && /app\.post\('\/unsubscribe'/.test(srv),
        'both routes are registered');

  const view = read('views/pages/unsubscribe.ejs');
  check(/method="POST"/i.test(view) && /action="\/unsubscribe"/.test(view),
        'the confirm page posts back');
}

/* ═══ 4. CSRF EXEMPTION, SCOPED ══════════════════════════════════════ */
console.log('\n--- one-click unsubscribe is not blocked by CSRF ---');
{
  const csrf = strip(read('src/middleware/csrf.js'));
  check(/req\.path\s*===\s*'\/unsubscribe'/.test(csrf),
        'POST /unsubscribe is exempt from the CSRF guard',
        'RFC 8058 one-click posts from the mail provider with no session');
  /* An exemption that is a prefix would widen to anything mounted below
     it later; === cannot. */
  check(!/startsWith\(\s*'\/unsubscribe'/.test(csrf),
        'the exemption is an exact path, not a prefix',
        'a prefix exemption would silently cover future sub-routes');
}

/* ═══ 5. NO SECRET, NO SILENT TOKENS ═════════════════════════════════ */
console.log('\n--- a missing secret fails loudly ---');
{
  const util = strip(read('src/utils/unsubscribeToken.js'));
  check(/throw new Error\([^)]*SESSION_SECRET/.test(util),
        'signing throws when SESSION_SECRET is unset',
        'an unsigned token would verify nothing while looking like it worked');
  check(/timingSafeEqual/.test(util),
        'signatures are compared in constant time',
        '=== short-circuits and leaks how much of a guess was right');
  check(/PURPOSE/.test(util) && /createHmac\([^)]*base\)/.test(util),
        'the signing key is DERIVED from SESSION_SECRET, not used raw',
        'one secret serving two purposes couples a weakness in either');
}

console.log(fail ? `\n*** ${fail} of ${pass + fail} CHECKS FAILED ***`
                 : `\nALL ${pass} CHECKS PASS`);
process.exit(fail ? 1 : 0);
