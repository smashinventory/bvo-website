#!/usr/bin/env node
'use strict';

/**
 * gate_customer_outreach.js
 *
 * Guards the 2026-10-19 outreach build: the orderEmails extraction, the
 * resend, the email correction with its customer merge, and the message log.
 *
 * ⚠️ THESE CHECKS EXECUTE. Where a claim can be tested by running the real
 * function, it is — brevoService is stubbed in the require cache so no mail
 * leaves and no network is touched. Only the claims that are genuinely about
 * source text (a duplicated template body, a route registration) are read as
 * text, and each of those says so.
 *
 * The five things that must not silently break:
 *
 *   1. THE EXTRACTION IS A NO-OP. buildVars must produce byte-identical HTML
 *      to the body that lived in checkoutController before the move. The
 *      pre-extraction body is transcribed into this file as the oracle.
 *
 *   2. resend() READS THE RESULT. brevo.sendTemplate does not throw — it
 *      resolves { ok:false } or { skipped:true }. An early draft returned
 *      { ok:true } unconditionally, reporting success on exactly the
 *      failures an operator is at the screen to diagnose.
 *
 *   3. send() STAYS FIRE-AND-FORGET. Checkout calls it after the card is
 *      authorised. If it ever becomes awaited, or throws, a Brevo hiccup
 *      turns into a failed order that is already holding funds.
 *
 *   4. THE MERGE RE-POINTS EVERY TABLE. The FKs on customers are mostly
 *      ON DELETE CASCADE, so a table missing from the merge is not an error
 *      — it is silent data loss. The list is checked against the schema.
 *
 *   5. NOTHING SENDS WITHOUT LOGGING. An outreach tool with no record is the
 *      problem this was built to solve.
 *
 * Run: node gates/gate_customer_outreach.js
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok    = m => { checks++; console.log('  ok   ' + m); };
const bad   = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const read  = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

/* ⚠️ COMMENTED-OUT CODE MUST NOT SATISFY A GREP.
   Mutation 19 of the harness commented out the setPhoneIfMissing call and
   this gate still passed, because the call was right there in the comment
   it had been turned into. Every "the code calls X" check below reads the
   comment-stripped text. Blanked rather than deleted so line numbers in
   any error message still line up with the real file. */
function stripJsComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
          .replace(/\/\/[^\n]*/g,       m => m.replace(/[^\n]/g, ' '));
}
const readCode = r => stripJsComments(read(r));

console.log('\ngate_customer_outreach — reaching a customer, and proving it\n');

/* ── the module under test needs a DB password to load ──────────────────
   config/database hard-exits without DB_PASS. The pool is created lazily
   and never connected to by anything below, so a placeholder suffices.
   Restored afterwards so this gate cannot leak a fake credential into
   whatever the push script runs next. Same approach as
   gate_session_identity.js:65. */
const SAVED_DB_PASS = process.env.DB_PASS;
if (!process.env.DB_PASS) process.env.DB_PASS = 'gate-placeholder-no-connection-is-made';
/* buildVars reads SITE_URL via utils/siteUrl. Pinned so the expected HTML
   below is deterministic on any machine. */
const SAVED_SITE_URL = process.env.SITE_URL;
process.env.SITE_URL = 'https://bathroomvanitiesoutlet.com';

function restoreEnv() {
  if (SAVED_DB_PASS === undefined) delete process.env.DB_PASS;
  else process.env.DB_PASS = SAVED_DB_PASS;
  if (SAVED_SITE_URL === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = SAVED_SITE_URL;
}

let orderEmails = null, brevo = null, outreach = null;
try {
  brevo       = require(path.join(ROOT, 'src/services/brevoService.js'));
  orderEmails = require(path.join(ROOT, 'src/services/orderEmails.js'));
  outreach    = require(path.join(ROOT, 'src/controllers/customerOutreachController.js'));
} catch (e) {
  bad('the outreach modules load', e.message);
}

if (!orderEmails || !outreach) {
  restoreEnv();
  console.log('\ngate_customer_outreach: FAILED — modules did not load, no behaviour could be tested\n');
  process.exit(1);
}

/* ═══════════════════════════════════════════════════════════════════════
   1. THE EXTRACTION IS A NO-OP
   ═══════════════════════════════════════════════════════════════════════
   The oracle below is checkoutController.sendConfirmation as it stood at
   commit cbafe9f, line 2168, with ONLY the brevo.sendTemplate call replaced
   by a return of the arguments it was about to pass. Nothing else is
   reworded, reindented or tidied — the point is to detect a difference, and
   a "harmless" cleanup in the transcription would hide one.

   If this check ever fails, the question is which side changed. A
   deliberate change to the receipt means updating the oracle IN THE SAME
   COMMIT, with the reason in the message. */
console.log('--- 1. the extraction is byte-identical ---');

const EMAIL_VERIFY_TTL = (() => {
  try { return require(path.join(ROOT, 'src/services/emailVerificationService.js')).TOKEN_TTL_DAYS; }
  catch { return null; }
})();

function oracle(order, items, confirmToken) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const money = n => `$${Number(n || 0).toLocaleString('en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rows = items.map(it => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e0d8">${esc(it.name)}${it.qty > 1 ? ` &times;${it.qty}` : ''}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e0d8;text-align:right;white-space:nowrap">${money(it.line_total)}</td>
    </tr>`).join('');

  const base = (require(path.join(ROOT, 'src/utils/siteUrl.js')).base())
    .replace(/\/+$/, '');
  const confirmHtml = confirmToken
    ? `<div style="border:1px solid #e5e0d8;border-radius:8px;padding:18px 20px;margin:0 0 24px;background:#faf8f5">
  <p style="margin:0 0 12px;font-size:15px"><strong>Want delivery updates and tracking?</strong><br>
  Confirm this is your email and we will keep you posted the whole way.</p>
  <p style="margin:0 0 10px">
    <a href="${base}/orders/confirm?t=${encodeURIComponent(confirmToken)}"
       style="display:inline-block;background:#182840;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:700;font-size:14px">Confirm my email</a>
  </p>
  <p style="margin:0;font-size:12px;color:#7a7264">Optional &mdash; your order is already placed either way. This link works for ${EMAIL_VERIFY_TTL} days.</p>
</div>`
    : '';

  return {
    vars: {
      confirm_button_html: confirmHtml,
      customer_first_name: order.ship_first_name || 'there',
      order_number:        order.order_number,
      order_date:          new Date().toLocaleDateString('en-US',
                             { year: 'numeric', month: 'long', day: 'numeric' }),
      order_items_html:    `<table style="width:100%;border-collapse:collapse">${rows}</table>`,
      order_total:         money(order.total),
    },
    toName: `${order.ship_first_name || ''} ${order.ship_last_name || ''}`.trim(),
  };
}

/* The awkward cases on purpose: HTML metacharacters in a product name
   (escaping), an apostrophe and an ampersand in a surname (NOT escaped —
   the name goes in a JSON header, not into HTML, and escaping it would be
   a visible change), qty 1 vs qty >1 (the &times; suffix), a zero line
   total, a missing first name (the 'there' fallback), and a token with
   characters that must be percent-encoded in a URL. */
const FIXTURES = [
  { name: 'typical order with a token',
    order: { order_number: 'BVO-1016', ship_first_name: 'Heather',
             ship_last_name: "O'Neil & Sons <b>", guest_email: 'h@example.com',
             total: '657.00' },
    items: [{ name: '60" Backsplash 3CM <Tajnar> & Eclos', qty: 3, line_total: '219.00' },
            { name: 'Single item',                          qty: 1, line_total: '0' }],
    token: 'tok+en/with=chars' },

  { name: 'no token — the confirm block must be EXACTLY empty',
    order: { order_number: 'BVO-1013', ship_first_name: '', ship_last_name: '',
             guest_email: 'x@example.com', total: 1803 },
    items: [{ name: 'De Soto 30"', qty: 1, line_total: 1803 }],
    token: null },

  { name: 'no items, null total',
    order: { order_number: 'BVO-0001', guest_email: 'y@example.com', total: null },
    items: [],
    token: undefined },
];

FIXTURES.forEach(f => {
  let got, want;
  try {
    got  = orderEmails.buildVars(f.order, f.items, f.token);
    want = oracle(f.order, f.items, f.token);
  } catch (e) {
    bad('no-op: ' + f.name, 'threw: ' + e.message);
    return;
  }
  check(JSON.stringify(got) === JSON.stringify(want),
        'no-op: ' + f.name,
        'buildVars differs from the pre-extraction body.\n' +
        '         got : ' + JSON.stringify(got).slice(0, 400) + '\n' +
        '         want: ' + JSON.stringify(want).slice(0, 400));
});

check(EMAIL_VERIFY_TTL !== null && String(EMAIL_VERIFY_TTL) !== 'undefined',
      'the TTL in the confirm copy resolves to a real number',
      'TOKEN_TTL_DAYS came back undefined — the email would read "works for undefined days". ' +
      'This is what a wrong require path looks like: ../utils/emailVerify does not exist, ' +
      'it is ../services/emailVerificationService.');

/* ── and the body must live in ONE place ──────────────────────────────
   Read as TEXT, deliberately: the failure being guarded against is a
   second copy of the markup reappearing in the controller, which no
   behavioural test can see because both copies would agree at first. */
const CHK     = readCode('src/controllers/checkoutController.js');
/* The duplicate-body check is the ONE that reads the raw text, because a
   second copy of the markup pasted into a comment is still a second copy
   that will be uncommented by someone one day. */
const CHK_RAW = read('src/controllers/checkoutController.js');
check(!/Want delivery updates and tracking/.test(CHK_RAW),
      'checkoutController no longer carries its own copy of the receipt HTML',
      'The confirm block is back in the controller. Two copies drift; the ' +
      'one the webhook uses is the one nobody edits.');
check(/orderEmails\.send\(/.test(CHK),
      'checkoutController calls orderEmails.send');

/* ═══════════════════════════════════════════════════════════════════════
   2 & 3. THE TWO CONTRACTS — read the result, and never throw at checkout
   ═══════════════════════════════════════════════════════════════════════ */
console.log('\n--- 2. resend() reports the truth ---');

/* Stub the module in place. orderEmails holds a reference to this same
   exports object, so replacing the functions on it is seen by the code
   under test without any dependency injection. Restored after. */
const REAL_SEND_TEMPLATE = brevo.sendTemplate;
const REAL_IS_BLOCKED    = brevo.isBlocked;

const ORDER = { order_number: 'BVO-1016', guest_email: 'h@example.com',
                ship_first_name: 'Heather', ship_last_name: 'W', total: 657 };
const ITEMS = [{ name: 'Backsplash', qty: 3, line_total: 219 }];

async function resendWith(stub, blocked, to) {
  brevo.sendTemplate = async () => stub;
  brevo.isBlocked    = async () => !!blocked;
  try { return await orderEmails.resend(ORDER, ITEMS, 'tok', to); }
  finally {
    brevo.sendTemplate = REAL_SEND_TEMPLATE;
    brevo.isBlocked    = REAL_IS_BLOCKED;
  }
}

(async () => {
  const sent    = await resendWith({ ok: true, messageId: 'm1' }, false);
  const refused = await resendWith({ ok: false, error: 'Brevo said no' }, false);
  const skipped = await resendWith({ skipped: true }, false);
  const blocked = await resendWith({ ok: true }, true);
  const override= await resendWith({ ok: true }, false, 'fixed@example.com');
  const noAddr  = await orderEmails.resend({ ...ORDER, guest_email: null }, ITEMS, 'tok', null);

  check(sent.ok === true && sent.to === 'h@example.com',
        'a successful send reports ok');

  check(refused.ok === false && /Brevo said no/.test(refused.error || ''),
        'a REFUSED send reports NOT ok, with Brevo\'s reason',
        'sendTemplate resolves { ok:false } rather than throwing. Returning ' +
        'ok:true here tells the operator it went when it did not — the exact ' +
        'silent failure this feature exists to end.');

  check(skipped.ok === false && /BREVO_API_KEY|template/i.test(skipped.error || ''),
        'a SKIPPED send (no API key / missing template) reports NOT ok',
        '{ skipped:true } has neither ok nor error. Treating it as success ' +
        'means a server with no API key silently reports every receipt sent.');

  check(blocked.ok === false && /blocklist/i.test(blocked.error || ''),
        'a blocklisted address is refused BEFORE sending',
        'Brevo drops mail to a blocked address and still returns 201. Without ' +
        'this check the operator is told it went and the customer gets nothing.');

  check(override.ok === true && override.to === 'fixed@example.com',
        'an override address is used instead of the order\'s');

  check(noAddr.ok === false && /no email/i.test(noAddr.error || ''),
        'an order with no address is refused, not sent into the void');

  /* ── 3. send() must stay fire-and-forget ──────────────────────────── */
  console.log('\n--- 3. checkout\'s send() cannot fail an order ---');

  brevo.sendTemplate = async () => { throw new Error('Brevo exploded'); };
  let threw = false, returned;
  try { returned = orderEmails.send(ORDER, ITEMS, 'tok'); }
  catch (e) { threw = true; }
  /* Let the rejected promise settle so an unhandled rejection cannot be
     blamed on a later check. */
  await new Promise(r => setTimeout(r, 10));
  brevo.sendTemplate = REAL_SEND_TEMPLATE;

  check(!threw,
        'send() does not throw when Brevo fails',
        'checkout calls this AFTER the card is authorised. An exception here ' +
        'turns a mail problem into a failed order that is already holding funds.');
  check(returned === undefined,
        'send() returns nothing — it is not awaitable by accident',
        'Returning the promise invites a future caller to await it, which is ' +
        'how the fire-and-forget contract gets lost without anyone deciding to.');

  /* ═════════════════════════════════════════════════════════════════════
     4. THE MERGE RE-POINTS EVERY TABLE THAT REFERENCES A CUSTOMER
     ═════════════════════════════════════════════════════════════════════
     Checked against the schema dump rather than a hand-kept list, because
     a hand-kept list is exactly what goes stale. The FKs are mostly
     ON DELETE CASCADE, so a table missing from the merge is silent data
     loss, not an error. */
  console.log('\n--- 4. the merge cannot silently destroy rows ---');

  const OUT = readCode('src/controllers/customerOutreachController.js');

  /* Tables the merge re-points, as written in the code. */
  const repointed = new Set(
    [...OUT.matchAll(/UPDATE\s+(\w+)\s+SET customer_id = \? WHERE customer_id = \?/g)]
      .map(m => m[1]));

  /* Tables the SCHEMA says have a customer_id. The newest dump is the
     authority; migrations are not, per BVO_AUDIT_BRIEF.md:338. */
  const dumps = fs.readdirSync(path.join(ROOT, '..'))
    .filter(f => /^u\d+_BVO_website.*\.sql$/.test(f))
    .sort()
    .reverse();

  if (!dumps.length) {
    bad('a BVO schema dump is available to check the merge against',
        'No u*_BVO_website*.sql found beside the project. Without it this ' +
        'check degrades to trusting the list in the code, which is the thing ' +
        'being checked. Fetch a dump or verify the merge by hand.');
  } else {
    /* ⚠️ TWO SOURCES, because the dump alone has a BLIND SPOT: it is a
       snapshot, so every table created after it — including
       customer_messages, created by this very change — is invisible to it.
       Harness mutation 10 deleted the customer_messages re-point and this
       gate passed, which is exactly the silent-cascade failure it claims
       to prevent, one table newer.

       So the migrations directory is read TOO. The audit brief is right
       that migrations are not authoritative for what the live schema IS
       (BVO_AUDIT_BRIEF.md:338) — but a table a migration creates with a
       customer_id is unambiguously a table the merge has to handle, and
       that is all this is used for. Dump ∪ migrations, never migrations
       alone. */
    const sources = [fs.readFileSync(path.join(ROOT, '..', dumps[0]), 'utf8')];
    const migDir = path.join(ROOT, 'migrations');
    fs.readdirSync(migDir).filter(f => f.endsWith('.sql')).forEach(f => {
      sources.push(fs.readFileSync(path.join(migDir, f), 'utf8'));
    });
    const SCHEMA = sources.join('\n');

    const withCustomerId = new Set();
    [...SCHEMA.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?`(\w+)` \(([\s\S]*?)\n\) ENGINE/g)]
      .forEach(m => {
        if (/^\s+`customer_id`/m.test(m[2])) withCustomerId.add(m[1]);
      });

    /* The check is worthless if the scan found nothing to check. */
    check(withCustomerId.size >= 4,
          `the schema scan found ${withCustomerId.size} tables with a customer_id`,
          'Fewer than expected — the CREATE TABLE regex has stopped matching, ' +
          'which would make the merge check below pass vacuously.');

    /* Deliberate exceptions, each with its reason stated in the code:
         customers            — the row being deleted
         customer_devices     — remembered browsers, allowed to cascade
         customer_auth_codes  — keyed by email, has no customer_id at all */
    const EXEMPT = new Set(['customers', 'customer_devices', 'customer_auth_codes']);

    const missed = [...withCustomerId].filter(t => !repointed.has(t) && !EXEMPT.has(t));
    check(missed.length === 0,
          `the merge handles every table with a customer_id (${dumps[0]})`,
          missed.length
            ? 'NOT re-pointed and NOT exempt: ' + missed.join(', ') +
              '. The FKs cascade, so DELETE FROM customers will destroy these ' +
              'rows rather than error. Add them to the merge or exempt them ' +
              'with a stated reason.'
            : '');

    /* And the exemptions must be real, not a way to silence this check. */
    check(!/`customer_id`/.test(
            (SCHEMA.match(/CREATE TABLE `customer_auth_codes` \(([\s\S]*?)\n\) ENGINE/) || [,''])[1]),
          'customer_auth_codes genuinely has no customer_id column',
          'It does have one now, so the merge must re-point it instead of ' +
          'relying on the email key.');
  }

  check(/INSERT INTO customer_merges/.test(OUT),
        'a merge is recorded in customer_merges',
        'A destructive operation with no audit trail. order_deletions ' +
        '(2026-10-12) exists for the same reason.');
  check(/FOR UPDATE/.test(OUT),
        'the order row is locked for the duration of the correction',
        'Without it two operators correcting the same order race each other.');
  check(/beginTransaction/.test(OUT) && /rollback/.test(OUT),
        'the correction is one transaction with a rollback',
        'A half-applied correction — order fixed, customer not — is worse ' +
        'than none, because it looks done.');

  /* The resend must be OUTSIDE the transaction: an email cannot be rolled
     back, so sending before the commit can put a receipt in an inbox for a
     correction that never happened. */
  const commitAt = OUT.indexOf('await conn.commit()');
  const resendAt = OUT.lastIndexOf('orderEmails.resend(');
  check(commitAt > 0 && resendAt > commitAt,
        'the correction COMMITS before it sends',
        'orderEmails.resend is called before conn.commit(). An email cannot ' +
        'be un-sent; a transaction can be rolled back.');

  /* ═════════════════════════════════════════════════════════════════════
     5. NOTHING SENDS WITHOUT LOGGING
     ═════════════════════════════════════════════════════════════════════ */
  console.log('\n--- 5. every send is recorded ---');

  /* ⚠️ COUNTING IS NOT ENOUGH, and that was this gate's own blind spot.
     The first version compared "how many sends" to "how many logMessage
     calls" — so harness mutation 13, which left the call in place and
     prefixed it with `if (false)`, passed. The count was unchanged and the
     log was dead.

     Two checks instead, both about whether the log actually RUNS:
       a) no logMessage call sits behind a condition;
       b) each send is followed by a log before the handler ends. */
  const sendIdx = [...OUT.matchAll(/brevo\.sendRaw\(|orderEmails\.resend\(/g)].map(m => m.index);
  const logIdx  = [...OUT.matchAll(/logMessage\(\{/g)].map(m => m.index);

  /* (a) A guarded log is a log that does not happen. Looks at the text
     immediately before the call — `if (…) await logMessage`, `x && logMessage`,
     a ternary — any of which makes it conditional. */
  const guarded = logIdx.filter(i => {
    const before = OUT.slice(Math.max(0, i - 60), i);
    return /\b(if|while)\s*\([^)]*\)\s*(await\s+)?$/.test(before) ||
           /(&&|\|\||\?)\s*(await\s+)?$/.test(before);
  });
  check(guarded.length === 0,
        `no logMessage call is behind a condition (${logIdx.length} calls)`,
        'A conditional log is a log that silently does not happen. The ' +
        'record must be written on every path, including the failures — ' +
        'especially the failures.');

  /* (b) Every send has a log after it, inside the same handler. Handler
     boundaries are the `exports.` declarations. */
  const bounds = [...OUT.matchAll(/^exports\.\w+\s*=/gm)].map(m => m.index).concat(OUT.length);
  const unlogged = sendIdx.filter(s => {
    const end = bounds.find(b => b > s) || OUT.length;
    return !logIdx.some(l => l > s && l < end);
  });
  check(unlogged.length === 0,
        `every send is followed by a log in the same handler (${sendIdx.length} sends)`,
        unlogged.length
          ? 'A send with no logMessage after it, at character ' + unlogged.join(', ') +
            '. The log is the only answer to "did anyone ever get back to her?", ' +
            'which is the question that started this work.'
          : '');

  check(/sentOk:\s*false/.test(OUT) || /sentOk:\s*sentOk/.test(OUT),
        'failures are logged too, not only successes',
        'A log of successes hides the rows worth reading, and the next ' +
        'operator re-sends into the same blocklist.');

  check(typeof outreach._logMessage === 'function',
        'logMessage is exported so this gate can reach it');

  /* ── the checkbox trap ─────────────────────────────────────────────
     An unchecked checkbox sends NO field. Testing for '0' would make
     unticking "resend the receipt" do nothing at all. */
  check(/String\(req\.body\.resend\)\s*!==\s*'1'/.test(OUT),
        'the resend opt-out tests for === \'1\', not !== \'0\'',
        'An unchecked checkbox is ABSENT from the body, not \'0\'. Testing ' +
        'for \'0\' means unticking the box still sends the mail.');

  /* ═════════════════════════════════════════════════════════════════════
     6. WIRING — routes, handlers, CSRF, and the phone copy
     ═════════════════════════════════════════════════════════════════════ */
  console.log('\n--- 6. wiring ---');

  const ROUTES = read('src/routes/admin.js');
  [['POST', 'resend-receipt',  'resendReceipt'],
   ['POST', 'correct-email',   'correctEmail'],
   ['POST', 'message',         'sendMessage'],
   ['GET',  'merge-preview',   'mergePreview'],
   ['GET',  'outreach/template', 'loadTemplate']].forEach(([m, p, fn]) => {
    const re = new RegExp(`router\\.${m.toLowerCase()}\\s*\\([^)]*${p.replace('/', '\\/')}[^)]*outreachCtrl\\.${fn}`);
    check(re.test(ROUTES), `${m} …${p} → outreachCtrl.${fn}`,
          'Route not registered — the control is dead and says nothing.');
    check(typeof outreach[fn] === 'function', `outreachCtrl.${fn} exists`);
  });

  /* CSRF is global middleware, not per-route. Checked because that is WHY
     there is nothing per-route to add — and if that middleware is ever
     removed, every POST above becomes forgeable at once. */
  const SRV = read('src/server.js');
  check(/_CSRF_SAFE/.test(SRV) && /token !== expected/.test(SRV),
        'the global CSRF middleware still guards every non-GET',
        'Without it the outreach POSTs are forgeable. There is no per-route ' +
        'CSRF in this app by design — this is the whole of it.');

  /* Rule 15: a data-act with no handler is a dead control. */
  const VIEWS = ['views/pages/admin/marketing/customer-detail.ejs',
                 'views/pages/admin/orders/detail.ejs'];
  const BUILTIN = ['noop', 'submitForm', 'go', 'hideOnError', 'togglePanel'];
  VIEWS.forEach(v => {
    const raw = read(v);
    const blank = (x, re) => x.replace(re, s => s.replace(/[^\n]/g, ' '));
    let mk = blank(blank(blank(raw, /<%#[\s\S]*?%>/g), /<%\/\*[\s\S]*?\*\/%>/g), /<!--[\s\S]*?-->/g);
    mk = blank(mk, /<script[\s\S]*?<\/script>/gi);
    const used = [...new Set([...mk.matchAll(/data-act="([a-zA-Z]+)"/g)].map(m => m[1]))];
    const reg  = [...raw.matchAll(/Object\.assign\(window\.BVO_ACTIONS,\s*\{([\s\S]*?)\n\}\s*\)/g)]
                   .map(m => m[1]).join(',');
    const keys = new Set([...reg.matchAll(/(\w+)\s*:/g)].map(m => m[1]).concat(BUILTIN));
    const miss = used.filter(u => !keys.has(u));
    check(miss.length === 0, `${path.basename(v)}: every data-act resolves`,
          miss.length ? 'unregistered: ' + miss.join(', ') : '');
  });

  /* ⚠️ data-confirm on a FORM, never on the submit button inside it. The
     submit event's target is the form, so the dispatcher walking up from it
     never sees an attribute on the button — the confirm silently never
     appears and the POST goes unguarded. */
  const DET = read('views/pages/admin/orders/detail.ejs');
  const badConfirm = [...DET.matchAll(/<button[^>]*data-on="submit"[^>]*>/g)];
  check(badConfirm.length === 0,
        'no data-on="submit" sits on a <button>',
        'A submit handler on a button never fires: the event targets the ' +
        'FORM. Move data-act/data-on/data-confirm onto the <form>.');

  /* The phone copy — the gap that started this. */
  const CUST = read('src/models/Customer.js');
  check(/setPhoneIfMissing/.test(CUST),
        'Customer.setPhoneIfMissing exists');
  check(/\(phone IS NULL OR phone = ''\)/.test(CUST),
        'setPhoneIfMissing guards in the WHERE clause, not an if()',
        'A read-then-write races two tabs and lets a stale form post a ' +
        'blank over a number captured at checkout.');
  check(/Customer\.setPhoneIfMissing\(/.test(CHK),
        'checkoutController copies the phone to the customer record',
        'This is the original bug: the name was copied, the phone never was, ' +
        'so customer 11 read "no phone number" while his order held it.');
  /* And it must sit OUTSIDE the resolve branch, or a signed-in buyer — who
     skips that branch entirely — still gets no phone copied. */
  const phoneAt   = CHK.indexOf('Customer.setPhoneIfMissing(');
  const sessionAt = CHK.indexOf('req.session.orderCustomerId = orderCustomerId');
  check(phoneAt > sessionAt && sessionAt > 0,
        'the phone copy runs for a signed-in buyer too',
        'It is inside the if(!orderCustomerId) resolve branch, which a ' +
        'signed-in customer skips — the same gap, one case narrower.');

  /* The migration must define what the controller inserts. */
  const MIG = read('migrations/2026-10-19_customer_outreach_RUNME.sql');
  check(/CREATE TABLE IF NOT EXISTS `customer_messages`/.test(MIG) &&
        /CREATE TABLE IF NOT EXISTS `customer_merges`/.test(MIG),
        'the migration creates both tables');
  const inserted = (OUT.match(/\(customer_id, order_id, to_email, to_name, kind, template_key,\s*\n\s*subject, body_html, sent_ok, error, actor\)/) || [])[0];
  check(!!inserted, 'the INSERT column list is in the expected shape');
  if (inserted) {
    const cols = inserted.replace(/[()\n]/g, ' ').split(',').map(s => s.trim()).filter(Boolean);
    const missing = cols.filter(c => !new RegExp('`' + c + '`').test(MIG));
    check(missing.length === 0,
          'every column customer_messages is written with exists in the migration',
          missing.length ? 'in the INSERT but not the schema: ' + missing.join(', ') : '');
  }
  /* ⚠️ BOTH FKs, NAMED. A bare /ON DELETE SET NULL/ passed while the ORDER
     FK had been switched to CASCADE, because the CUSTOMER FK still said SET
     NULL and one match satisfied the regex (harness mutation 21). Each
     constraint is now asserted on its own. */
  [['fk_cmsg_order',    '`orders`'],
   ['fk_cmsg_customer', '`customers`']].forEach(([name, tbl]) => {
    const re = new RegExp('CONSTRAINT `' + name + '`[\\s\\S]{0,160}?REFERENCES ' +
                          tbl.replace(/[`]/g, '`') + ' \\(`id`\\) ON DELETE SET NULL');
    check(re.test(MIG),
          `${name} is ON DELETE SET NULL, not CASCADE`,
          'CASCADE here erases the proof we contacted someone at exactly the ' +
          'moment that proof matters — when the order or the customer record ' +
          'is being removed. See order_deletions (2026-10-12) for the same rule.');
  });
  check(/UPDATE `customers` c/.test(MIG) && /ship_phone/.test(MIG),
        'the migration backfills customers.phone from orders.ship_phone');
  check(!/ship_phone_ext/.test(MIG.replace(/--[^\n]*/g, '')),
        'the backfill does NOT write an extension into customers.phone',
        'customers has one phone column, VARCHAR(30), and no extension ' +
        'column. Gluing "x204" in corrupts the only value that has to stay ' +
        'dialable.');

  /* ── done ──────────────────────────────────────────────────────────── */
  restoreEnv();
  console.log();
  if (fails) {
    console.log(`gate_customer_outreach: FAILED ${fails} of ${checks} checks\n`);
    process.exit(1);
  }
  console.log(`gate_customer_outreach: all ${checks} checks pass\n`);
})().catch(e => {
  restoreEnv();
  console.error('\ngate_customer_outreach: THREW —', e && e.stack);
  process.exit(1);
});
