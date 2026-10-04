#!/usr/bin/env node
/**
 * gate_customer_name.js
 *
 * Guards name capture, added 2026-10-04.
 *
 * THE FAILURE MODES THIS EXISTS TO CATCH:
 *
 *  1. ACCOUNT ENUMERATION. The name step must be decided AFTER the code is
 *     verified, never before. A page that could show a name field only for
 *     new accounts would be answering "does this email have an account?" —
 *     exactly what the passwordless design was built to refuse. See the
 *     comment on findOrCreateByEmail.
 *
 *  2. RENAMING SOMEONE ELSE. The customer id must come from the SESSION. A
 *     customer_id accepted from the body would let anyone rename anyone.
 *
 *  3. CLOBBERING A GOOD NAME. setNameIfMissing must guard inside the WHERE
 *     clause, not with an if() above it. A read-then-write races two tabs,
 *     and lets a stale form post a blank over a name captured minutes
 *     earlier at checkout.
 *
 *  4. "REQUIRED" ENFORCED ONLY IN THE BROWSER. Client validation is a
 *     courtesy to the typist, never a control.
 *
 *  5. ASKING PURCHASERS. Anyone who has checked out already typed their
 *     name; checkout copies it, so they are never prompted. If that copy
 *     disappears, every buyer gets asked for something they already gave.
 *
 * It cannot tell you whether anyone fills the field in.
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const ejs  = require('ejs');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0;
const ok    = m => console.log('  PASS  ' + m);
const bad   = m => { console.log('  FAIL  ' + m); fails++; };
const check = (c, m) => c ? ok(m) : bad(m);

/* Comments stripped: this gate's prose names requireAuth, session and
   first_name, and a raw scan would match the explanation not the code. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const acct   = strip(read('src/controllers/accountController.js'));
const model  = strip(read('src/models/Customer.js'));
const routes = strip(read('src/routes/account.js'));
const checkout = strip(read('src/controllers/checkoutController.js'));
const login  = read('views/pages/account/login.ejs');

console.log('\ngate_customer_name');
console.log('='.repeat(72));

/* ── 1. Asked after verification, never before ──────────────────────────── */
console.log('\n1. The prompt cannot leak whether an account exists');
const verify = acct.match(/exports\.verifyCode[\s\S]*?\n\};/);
check(!!verify, 'verifyCode found');
if (verify) {
  const v = verify[0];
  const posVerify = v.indexOf('verifyCode(email, code');
  const posNeeds  = v.indexOf('needsName');
  check(posVerify >= 0 && posNeeds > posVerify,
    'needsName is decided AFTER the code is checked, not before');
  check(/needsName\s*=\s*!String\(customer\.first_name/.test(v),
    'needsName is derived from the stored name, not from whether the account is new');
  /* Deliberately NOT keyed on customer.created: a pre-existing account with
     no name must also be asked, and a NEW account that somehow has one must
     not be. */
  check(!/needsName\s*[:=]\s*customer\.created/.test(v),
    'needsName is not just "is this a new account"');
}
check(!/\/account\/code[\s\S]{0,400}first_name/.test(acct),
  'the code-send endpoint never touches the name');

/* ── 2. The id comes from the session ───────────────────────────────────── */
console.log('\n2. Nobody can rename anyone else');
const save = acct.match(/exports\.saveName[\s\S]*?\n\};/);
check(!!save, 'saveName found');
if (save) {
  const s = save[0];
  check(/req\.session\.customerId/.test(s), 'the id comes from the session');
  check(!/req\.body\.(customer_?id|id)\b/i.test(s), 'no id is accepted from the body');
  check(/status\(400\)/.test(s) && /!first/.test(s),
    'first name is required ON THE SERVER, not only in the browser');
}
check(/router\.post\('\/name',\s*requireAuth/.test(routes.replace(/\s+/g, ' ')) ||
      /'\/name'[^\n]*requireAuth/.test(routes),
  'POST /account/name is behind requireAuth');

/* ── 3. An existing name is never overwritten ───────────────────────────── */
console.log('\n3. A name already on file cannot be clobbered');
const setter = model.match(/async setNameIfMissing[\s\S]*?\n  \},/);
check(!!setter, 'setNameIfMissing found');
if (setter) {
  const s = setter[0];
  check(/WHERE[\s\S]{0,120}first_name IS NULL OR first_name = ''/.test(s),
    'the guard is in the WHERE clause, not an if() above the write');
  check(/CASE WHEN/.test(s) && /last_name/.test(s),
    'a blank last name does not erase a surname already on file');
  check(!/SELECT[\s\S]{0,200}first_name[\s\S]{0,200}UPDATE/i.test(s),
    'no read-then-write (which would race two tabs)');
}

/* ── 4. Purchasers are never asked ──────────────────────────────────────── */
console.log('\n4. Anyone who checked out already gave us a name');
check(/Customer\.setNameIfMissing\(/.test(checkout),
  'checkout copies the shipping name onto the customer row');
check(/setNameIfMissing\([^)]*name\.first[^)]*name\.last/.test(checkout),
  'it copies the name the buyer actually typed');
check(/\.catch\(/.test((checkout.match(/Customer\.setNameIfMissing[\s\S]{0,200}/) || [''])[0]),
  'the copy is fire-and-forget — a name is never worth failing a sale');

/* ── 5. The step itself ─────────────────────────────────────────────────── */
console.log('\n5. The form asks for what was specified');
{
  const s = login.indexOf('<div id="auth-step-name"');
  const e = login.indexOf('<div id="auth-step-code"');
  check(s >= 0 && e > s, 'the name step exists in login.ejs');
  const frag = login.slice(s, e);
  const out  = ejs.render(frag, { csrfToken: 'tok' });
  check(/id="auth-step-name"[^>]*hidden/.test(out), 'hidden until the server asks for it');
  check(/name="first_name"[^>]*required/.test(out), 'first name required');
  check(!/name="last_name"[^>]*required/.test(out), 'last name NOT required');
  check(/\(optional\)/.test(out), 'last name is visibly labelled optional');
  check(/name="_csrf"/.test(out), 'csrf token present');
  /* Invented class names render as unstyled blocks and nothing errors. The
     first draft of this step used .auth-field and .auth-optional, neither of
     which exists in any stylesheet. */
  const css = read('public/css/site-bundle.css');
  const classes = [...out.matchAll(/class="([^"]+)"/g)]
    .flatMap(m => m[1].split(/\s+/)).filter(Boolean);
  const missing = [...new Set(classes)].filter(c => !css.includes('.' + c));
  check(missing.length === 0, `every class used exists in the stylesheet${missing.length ? ' — missing: ' + missing.join(', ') : ''}`);
}

/* ── 6. The dashboard no longer prints an empty name ────────────────────── */
console.log('\n6. A missing name is absent, not blank');
{
  const t = read('views/pages/account/dashboard.ejs');
  const s = t.indexOf('<div class="account-details">');
  const frag = t.slice(s, t.indexOf('</div>', s) + 6);
  const r = c => ejs.render(frag, { customer: c });
  check(!/<p><strong>/.test(r({ first_name: '', last_name: '', email: 'a@b.com', phone: null })),
    'no bold empty line when there is no name');
  check(/<strong>Jane Doe<\/strong>/.test(r({ first_name: 'Jane', last_name: 'Doe', email: 'a@b.com', phone: null })),
    'the name renders when present');
}

/* ── 7. The backfill only fills ─────────────────────────────────────────── */
console.log('\n7. The backfill fills blanks and nothing else');
const sql = read('migrations/2026-10-04_backfill_customer_names.sql').replace(/^\s*--.*$/gm, '');
check(/UPDATE customers/.test(sql), 'it updates customers');
check(/WHERE c\.first_name IS NULL OR c\.first_name = ''/.test(sql),
  'only rows with no first name are touched');
check(/status <> 'cancelled'/.test(sql), 'cancelled orders are not a name source');
check(!/\b(DROP|TRUNCATE|DELETE\s+FROM|ALTER\s+TABLE)\b/i.test(sql),
  'no destructive statement');

console.log('\n' + '='.repeat(72));
console.log(fails === 0 ? 'gate_customer_name: PASS\n'
                        : `gate_customer_name: ${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
