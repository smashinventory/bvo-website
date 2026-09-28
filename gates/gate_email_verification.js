'use strict';
/* Gates for the 2026-09-28 verification rework: the checkout gate
 * removed, the code TTL raised to 20, and email verification moved
 * AFTER the order as an optional, advisory thing.
 *
 * WHAT THESE ARE GUARDING AGAINST, in order of how much it would cost:
 *
 *   1. The blocking gate coming back. Brevo delivered a sign-in code
 *      eleven minutes late against a ten-minute expiry. Any middleware
 *      that makes checkout wait on email is that outage again.
 *   2. A typed email granting account access. Removing the gate is only
 *      safe because a typed address sets orderCustomerId, NOT
 *      customerId. Confuse the two and anyone who guesses a customer's
 *      address gets their order history and saved addresses.
 *   3. The confirm link creating a session. It lives seven days in a
 *      mailbox and order confirmations get forwarded.
 *   4. GET confirming on sight. Mail scanners follow links; Gmail's
 *      "Loaded by proxy" is in our own Brevo log. A scanner that
 *      auto-confirms deletes the only signal the flag carries.
 *   5. The TTL and the copy drifting apart, so the page promises ten
 *      minutes while the server enforces twenty.
 *
 * Several of these are RENDERED or EXECUTED rather than grepped —
 * grep cannot tell "present in the file" from "reached at runtime".
 */

const ejs  = require('ejs');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* Comments are not code. Four separate gates have been fooled this
   month by a phrase appearing in an explanatory comment, so every
   source assertion below runs through this first. */
const executable = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/* The EJS flavour of the same trap, and it caught this gate on its
   first run. The view carries a comment explaining that the copy
   deliberately does NOT say "high traffic" — and the gate asserting the
   copy avoids that phrase matched the comment saying so, and failed.
   Fifth time this class of bug has appeared this month. Strip EJS
   comment blocks before asserting on anything a BUYER actually reads.
   (And note: writing an EJS comment delimiter literally inside a JS
   block comment closes it early — which broke this very gate on the
   next run. Hence the prose.) */
const visible = src => src
  .replace(/<%\/\*[\s\S]*?\*\/%>/g, '')
  .replace(/<%#[\s\S]*?%>/g, '');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

/* ═══ 1. THE GATE IS GONE AND MUST STAY GONE ═══════════════════════ */
console.log('--- the blocking identity gate ---');

ok('requireIdentity.js no longer exists',
   !fs.existsSync(path.join(ROOT, 'src/middleware/requireIdentity.js')),
   'the middleware is back on disk');

const checkoutRoutes = executable(read('src/routes/checkout.js'));
ok('checkout routes do not use requireIdentity',
   !/requireIdentity/.test(checkoutRoutes), 'the gate was re-registered');
ok('checkout routes register no router-level guard at all',
   !/router\.use\(/.test(checkoutRoutes),
   'a router.use() guard blocks every route declared after it');

/* The reasoning must survive, or the next reader re-adds the gate in
   good faith. This is the one place a comment IS the artefact. */
const routesRaw = read('src/routes/checkout.js');
ok('the file records WHY the gate was removed',
   /eleven minutes|11 minutes/i.test(routesRaw) && /defer/i.test(routesRaw),
   'the next reader will re-add it');

/* ═══ 2. A TYPED EMAIL MUST NOT GRANT ACCOUNT ACCESS ═══════════════ */
console.log('\n--- typed email vs proven identity ---');

const checkoutCtl = executable(read('src/controllers/checkoutController.js'));

ok('saveInfo writes orderCustomerId',
   /req\.session\.orderCustomerId\s*=/.test(checkoutCtl), 'not set');
/* THE ONE THAT MATTERS. customerId means PROVEN. If saveInfo ever
   assigns it, a typed address becomes a login. */
ok('saveInfo NEVER assigns req.session.customerId',
   !/req\.session\.customerId\s*=/.test(checkoutCtl),
   'a typed email would become an authenticated session');
ok('saved-address prefill is gated on customerId, not orderCustomerId',
   /req\.session\.customerId\s*&&\s*!draft/.test(checkoutCtl),
   'an unverified address could read a stranger\'s saved address');
ok('the order still carries a customer id',
   /orderCustomerId,/.test(checkoutCtl), 'customer_id would be null on every order');

/* ═══ 3. THE CONFIRM LINK GRANTS NOTHING ═══════════════════════════ */
console.log('\n--- the confirm link is not a credential ---');

const confirmCtl = executable(read('src/controllers/orderConfirmController.js'));
ok('never writes req.session.customerId',
   !/req\.session\.customerId\s*=/.test(confirmCtl),
   'a forwarded order email would sign someone in');
ok('never calls establishSession',
   !/establishSession/.test(confirmCtl), 'session created from a 7-day link');
ok('never regenerates a session',
   !/session\.regenerate/.test(confirmCtl), 'session handling on the link path');

const confirmRoutes = executable(read('src/routes/orderConfirm.js'));
ok('GET and POST are separate handlers',
   /router\.get\s*\(\s*'\/confirm'/.test(confirmRoutes)
   && /router\.post\s*\(\s*'\/confirm'/.test(confirmRoutes),
   'a one-click GET lets mail scanners confirm');
ok('GET renders, POST commits',
   /router\.get\s*\(\s*'\/confirm',\s*ctrl\.page/.test(confirmRoutes)
   && /router\.post\s*\(\s*'\/confirm',\s*ctrl\.submit/.test(confirmRoutes),
   'handlers are crossed');
/* The service-level half of the same rule. */
const verifySvc = executable(read('src/services/emailVerificationService.js'));
ok('only confirm() writes the customer row, peek() does not',
   /function peek/.test(verifySvc)
   && !/function peek[\s\S]*?UPDATE customers[\s\S]*?function confirm/.test(verifySvc),
   'peek() has a write in it — GET would confirm');

/* ═══ 4. THE PAGE ACTUALLY RENDERS A BUTTON ════════════════════════ */
console.log('\n--- order-confirm page, rendered ---');

const pageSrc = read('views/pages/order-confirm.ejs');
const render = locals => ejs.render(pageSrc, Object.assign({
  state: 'ask', message: '', token: 'a'.repeat(64),
  orderNumber: 'BVO-2026-09-28-00111', email: 'buyer@example.com',
  csrfToken: 'csrf123',
}, locals), { filename: path.join(ROOT, 'views/pages/order-confirm.ejs') });

const askHtml = render({});
ok('ask state renders a POST form',
   /<form[^>]+method="POST"[^>]+action="\/orders\/confirm"/i.test(askHtml),
   'no form — nothing to press');
ok('ask state carries the token in a hidden field',
   /name="token"[^>]*value="a{64}"/.test(askHtml), 'token lost between GET and POST');
ok('ask state carries CSRF', /name="_csrf"[^>]*value="csrf123"/.test(askHtml), 'no csrf');
ok('ask state says the order is unaffected',
   /already placed and is not affected/i.test(askHtml),
   'a paid buyer will think something is wrong');

const doneHtml = render({ state: 'done', token: '' });
ok('done state has NO form', !/<form/i.test(doneHtml), 'confirmable twice');
ok('done state offers sign-in as a LINK, not a session',
   /href="\/account\/login"/.test(doneHtml), 'no route back to the account');

const badHtml = render({ state: 'invalid', message: 'This confirmation link has expired.', token: '' });
ok('invalid state has no form', !/<form/i.test(badHtml), 'submittable with no token');
ok('invalid state does not leak WHY',
   !/expired and|already been used and/i.test(badHtml)
   && /expired or has already been used|didn't work/i.test(badHtml),
   'distinguishes expired from spent from never-real');

/* ═══ 5. TTL AND COPY AGREE ════════════════════════════════════════ */
console.log('\n--- code TTL vs what the buyer is told ---');

const limits = require(path.join(ROOT, 'src/services/authCodeService'))._limits;
ok('TTL is 20 minutes', limits.CODE_TTL_MINUTES === 20,
   'got ' + limits.CODE_TTL_MINUTES);
/* The burst window was pinned separately on purpose: while it shared
   the TTL constant, raising the TTL silently tightened the resend
   policy from 4-per-10-minutes to 4-per-20. */
ok('the burst window is SEPARATE from the TTL',
   limits.BURST_WINDOW_MINUTES === 10
   && limits.BURST_WINDOW_MINUTES !== limits.CODE_TTL_MINUTES,
   'raising the TTL would tighten resends');

const acctRaw = read('src/controllers/accountController.js');
ok('the fallback code email interpolates the TTL',
   /works for \$\{CODE_TTL_MINUTES\} minutes/.test(acctRaw),
   'hard-typed number will go stale');
ok('no hard-typed "ten minutes" survives in auth copy',
   !/works for ten minutes/i.test(acctRaw), 'stale copy');

for (const [label, view] of [
  ['account/login',    'views/pages/account/login.ejs'],
  ['checkout-identify','views/pages/checkout-identify.ejs'],
]) {
  const v = read(view);
  ok(`${label} interpolates codeTtlMinutes`,
     /It works for <%= codeTtlMinutes %> minutes/.test(v), 'hard-typed');
  ok(`${label} has the delivery-expectation hint`,
     /Codes can take a few minutes to arrive/.test(v), 'missing');
  ok(`${label} warns to use the most recent code`,
     /use the most recent/i.test(v), 'the stale-code trap is unguarded');
  ok(`${label} escalates after 2 minutes`,
     /startHintEscalation/.test(v) && /120000/.test(v), 'no escalation');
  /* visible(), not the raw file — the comment above explains why. */
  ok(`${label} does NOT blame "high traffic"`,
     !/high traffic/i.test(visible(v)), 'excuse copy — and it is not true');
}

/* Both controllers must actually PASS the local, or the views throw. */
ok('loginPage passes codeTtlMinutes',
   /codeTtlMinutes:\s*CODE_TTL_MINUTES/.test(executable(acctRaw)), 'not passed');
ok('identifyPage passes codeTtlMinutes',
   /codeTtlMinutes:/.test(checkoutCtl), 'not passed');

/* ═══ 6. CODE SIGN-IN IS VERIFICATION ══════════════════════════════ */
console.log('\n--- a code sign-in verifies the address ---');
ok('verifyCode marks the address verified',
   /emailVerify\.markVerifiedByCode\(email\)/.test(executable(acctRaw)), 'not wired');
ok('it cannot fail the sign-in',
   /markVerifiedByCode\(email\)[\s\S]{0,120}\.catch\(/.test(executable(acctRaw)),
   'an unwritable flag would break logging in');
ok('the method is recorded as code',
   /email_verified_method\s*=\s*'code'/.test(verifySvc), 'method not set');
/* First proof wins on the TIMESTAMP — otherwise a later click would
   move the date and break the verified-vs-ordered comparison. */
ok('an existing verification timestamp is preserved',
   /email_verified_at\s*=\s*COALESCE\(email_verified_at, NOW\(\)\)/.test(verifySvc),
   'a later confirm would overwrite an earlier one');

/* ═══ 7. ADVISORY ONLY — IT MUST NEVER GATE MONEY ══════════════════ */
console.log('\n--- verification never blocks an order or a capture ---');

const detail = read('views/pages/admin/orders/detail.ejs');
const capBlock = (detail.match(/Capture[\s\S]{0,400}?<\/form>/g) || []).join('\n');
ok('no capture control reads the verification flag',
   !/email_verified/.test(capBlock), 'an advisory flag started blocking money');
ok('the order detail always shows a verification answer',
   /email unconfirmed/.test(detail) && /confirmed/.test(detail),
   'silence is indistinguishable from "not checked"');
ok('unconfirmed is NOT styled red',
   /email-vflag--no/.test(detail) && !/email-vflag--no[^>]*red/i.test(detail),
   'red on every new order is wallpaper');

const listView = read('views/pages/admin/orders/index.ejs');
ok('the orders list shows the badge', /email-vflag/.test(listView), 'no badge');

const css = read('public/css/site4.css');
ok('the badge CSS exists in the ADMIN stylesheet',
   /\.email-vflag--yes/.test(css) && /\.email-vflag--no/.test(css), 'unstyled badge');
ok('unconfirmed is grey, confirmed is green',
   /\.email-vflag--no\{background:#f1efec/.test(css)
   && /\.email-vflag--yes\{background:#e8f2e8/.test(css), 'wrong colours');

/* The list query has to SELECT it or every badge silently reads
   "unconfirmed" — the exact failure that makes a flag worthless. */
const ordersCtl = executable(read('src/controllers/ordersController.js'));
ok('the list query selects email_verified_at',
   /c\.email_verified_at AS email_verified_at/.test(ordersCtl), 'every row would read unconfirmed');
ok('the detail query selects the method too',
   /c\.email_verified_at,\s*c\.email_verified_method/.test(ordersCtl), 'method never shown');

/* ═══ 8. THE CHECKOUT FORM ACCEPTS AN EMAIL AGAIN ══════════════════ */
console.log('\n--- checkout page 1 ---');
const infoView = read('views/pages/checkout-info.ejs');
ok('email is an editable input',
   /<input[^>]+type="email"[^>]+name="email"/.test(infoView), 'still read-only');
ok('validateInfo has an email rule',
   /errors\.email\s*=/.test(checkoutCtl), 'every submission would pass with no address');
ok('guest_email comes from the typed address',
   /guest_email:\s*buyerEmail/.test(checkoutCtl), 'reading a session field that is no longer set');
/* No enumeration check on this form, ever. */
ok('page 1 does NOT look up whether the address exists',
   !/findByEmail\(/.test(checkoutCtl), 'enumeration leak on a public form');

/* ═══ 9. THE EMAIL TEMPLATE CAN RENDER THE BUTTON ══════════════════ */
console.log('\n--- confirmation email ---');
ok('the controller supplies whole HTML, not a bare URL',
   /confirm_button_html:\s*confirmHtml/.test(checkoutCtl), 'template would show a raw link');
ok('a missing token renders NOTHING',
   /confirmToken\s*\?[\s\S]{0,1400}:\s*''/.test(checkoutCtl), 'dead button when the token fails');
ok('the link is a GET to /orders/confirm',
   /\/orders\/confirm\?t=/.test(checkoutCtl), 'wrong URL');
ok('the token is URL-encoded',
   /encodeURIComponent\(confirmToken\)/.test(checkoutCtl), 'unencoded token');

const migration = read('migrations/2026-09-28_order_email_verification_RUNME.sql');
ok('the migration inserts the placeholder into the template',
   /\{\{confirm_button_html\}\}/.test(migration),
   'substituteVars only fills tokens already in the template row');
ok('the template edit is re-run safe',
   /NOT LIKE '%confirm_button_html%'/.test(migration), 'would double-insert');
ok('the migration backfills existing code sign-ins',
   /UPDATE customers[\s\S]*?consumed_at IS NOT NULL/.test(migration),
   'every existing account would show unconfirmed on day one');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
