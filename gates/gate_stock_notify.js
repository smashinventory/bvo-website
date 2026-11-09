'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * GATE — back-in-stock notifications.
 *
 * Runs with NO DATABASE. src/config/stockNotify.js requires nothing, which is
 * the whole reason it exists as a separate file: the first James Martin review
 * gate died with "FATAL: DB_PASS is not set in .env" before asserting anything,
 * because it reached themeSettings -> config/database. Rules a gate cannot
 * reach are rules nobody is checking.
 *
 * Three properties matter here. Everything else is detail:
 *   1. NOBODY IS EMAILED ABOUT A PRODUCT THAT IS STILL OUT OF STOCK.
 *   2. NOBODY IS EMAILED TWICE.
 *   3. THE MARKETING OPT-IN IS NOT PRE-TICKED.
 * ═══════════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const RED = '\u001b[31m', GRN = '\u001b[32m', OFF = '\u001b[0m';

let failures = 0;
function ok(label)        { console.log(`  ${GRN}ok${OFF}   ${label}`); }
function bad(label, got)  { console.error(`  ${RED}FAIL${OFF} ${label}${got !== undefined ? `  <- got ${got}` : ''}`); failures++; }
function check(label, cond, got) { cond ? ok(label) : bad(label, got); }
function section(t) { console.log(`\n--- ${t} ---`); }

const rules = require('../src/config/stockNotify');

/* ── 1. NOTHING SENDS WHILE STILL OUT OF STOCK ───────────────────────────── */
section('no notice goes out for stock that is not there');

const base = { email: 'a@b.com', created_at: new Date(), notified_at: null };

check('qty 0 is refused',
  !rules.shouldNotify({ ...base, qty_on_hand: 0 }).ok);
check('qty null is refused',
  !rules.shouldNotify({ ...base, qty_on_hand: null }).ok);
check('qty undefined is refused',
  !rules.shouldNotify({ ...base, qty_on_hand: undefined }).ok);
check('a negative qty is refused, not treated as truthy',
  !rules.shouldNotify({ ...base, qty_on_hand: -5 }).ok);
check('qty 1 is allowed',
  rules.shouldNotify({ ...base, qty_on_hand: 1 }).ok);
check('the refusal says why',
  /out of stock/i.test(rules.shouldNotify({ ...base, qty_on_hand: 0 }).reason));

/* ── 2. NOBODY IS EMAILED TWICE ──────────────────────────────────────────── */
section('one notice per person per product, ever');

check('an already-notified row is refused even when back in stock',
  !rules.shouldNotify({ ...base, qty_on_hand: 9, notified_at: new Date() }).ok);
check('and it says so',
  /already notified/i.test(rules.shouldNotify({ ...base, qty_on_hand: 9, notified_at: new Date() }).reason));

const mig = read('migrations/2026-11-09_stock_notifications_RUNME.sql');
check('the table enforces it too — UNIQUE on (product_id, email)',
  /UNIQUE KEY\s+uniq_request\s*\(\s*product_id\s*,\s*email\s*\)/i.test(mig));

const job = read('src/jobs/stockNotify.js');
/* ⚠️ SCOPED TO THE SEND LOOP ON PURPOSE. `SET notified_at = NOW()` also
   appears in expire(), which sits earlier in the file — a naive indexOf
   compares the send against the WRONG statement and reports a failure that
   is not there. Caught on first run of this gate, 2026-11-09. */
const sendLoop = job.slice(job.indexOf('for (const row of toSend)'));
check('notified_at is stamped AFTER the send resolves, not before',
  sendLoop.indexOf('await brevo.sendTemplate') < sendLoop.indexOf('SET notified_at = NOW()'));
check('the stamp re-checks notified_at IS NULL, so a double run cannot double-send',
  /WHERE id = \? AND notified_at IS NULL/.test(job));

/* ── 3. THE OPT-IN IS NOT PRE-TICKED ─────────────────────────────────────── */
section('marketing opt-in is opt-IN');

check('an absent value is not consent',        !rules.wantsMarketing(undefined));
check('an empty string is not consent',        !rules.wantsMarketing(''));
check('the literal "off" is not consent',      !rules.wantsMarketing('off'));
check('"false" is not consent',                !rules.wantsMarketing('false'));
check('0 is not consent',                      !rules.wantsMarketing(0));
check('an explicit "on" IS consent',            rules.wantsMarketing('on'));

const pdp = read('views/pages/product.ejs');
const optIn = (pdp.match(/<input type="checkbox" name="marketing_opt_in"[^>]*>/) || [''])[0];
check('the checkbox exists on the form', Boolean(optIn));
check('⚠️ the checkbox carries NO checked attribute',
  Boolean(optIn) && !/\bchecked\b/.test(optIn), optIn || '(not found)');
check('the column defaults to 0, so a missing field cannot opt somebody in',
  /marketing_opt_in\s+TINYINT\(1\)\s+NOT NULL DEFAULT 0/i.test(mig));

/* ── 4. EXPIRY ───────────────────────────────────────────────────────────── */
section('stale requests close quietly instead of surprising somebody');

const old = new Date(Date.now() - 200 * 86400000);
const v = rules.shouldNotify({ ...base, created_at: old, qty_on_hand: 5 });
check('a 200-day-old request is refused', !v.ok);
check('and is flagged as expired rather than merely skipped', v.expired === true);
check('a 10-day-old request is still live',
  rules.shouldNotify({ ...base, created_at: new Date(Date.now() - 10 * 86400000), qty_on_hand: 5 }).ok);
check('the expiry window is still 90 days', rules.RULES.EXPIRY_DAYS === 90, rules.RULES.EXPIRY_DAYS);
check('the per-run send cap is still 200',  rules.RULES.MAX_PER_RUN === 200, rules.RULES.MAX_PER_RUN);

/* ── 5. THE FORM ONLY EXISTS WHERE IT SHOULD ─────────────────────────────── */
section('the capture form is scoped to out-of-stock pages');

check('the block is wrapped in a !product.inStock test',
  /<% if \(!product\.inStock\) \{ %>[\s\S]{0,2000}class="bis"/.test(pdp) ||
  /class="bis"[\s\S]{0,2000}<% \} %>/.test(pdp) && /<% if \(!product\.inStock\) \{ %>/.test(pdp));
check('it posts to /notify-me', /action="\/notify-me"/.test(pdp));
check('it carries a CSRF token', /<form class="bis"[\s\S]{0,400}name="_csrf"/.test(pdp));
check('there is a honeypot field', /name="company"[^>]*class="bis-hp"/.test(pdp));

/* ── 6. THE ENDPOINT DOES NOT LEAK ───────────────────────────────────────── */
section('the public endpoint cannot be mined');

const route = read('src/routes/notifyMe.js');
check('every path answers success — no distinguishable failure reply',
  !/res\.status\((?!200)\d{3}\)/.test(route), 'a non-200 status is returned somewhere');
check('raw error text is never sent to the browser',
  !/res\.(json|send)\([^)]*err\.(message|stack)/.test(route));
check('the IP is hashed, never stored raw',
  /createHash\('sha256'\)/.test(route) && !/ip_hash.*req\.ip/.test(route));
check('the no-JS redirect is restricted to our own product URLs',
  /bathroomvanitiesoutlet\\\.com\\\/products/.test(route) || /bathroomvanitiesoutlet\.com/.test(route));

/* ── 7. THE SUPPRESSION DECISION IS DELIBERATE AND WRITTEN DOWN ──────────── */
section('suppression: not checked, and that is on purpose');

const cfg = read('src/config/stockNotify.js');
check('the job does not quietly consult the suppression list',
  !/contactLog|suppression/.test(job));
check('and the reason is recorded where the next person will find it',
  /SUPPRESSION IS DELIBERATELY NOT CHECKED/.test(job));
check('the config explains the same decision',
  /SUPPRESSION IS NOT CHECKED HERE/.test(cfg));

/* ── 8. GATE CAN RUN WITHOUT A DATABASE ──────────────────────────────────── */
section('the rules stay reachable without an environment');

check('stockNotify.js requires nothing',
  !/^\s*(const|let|var).*require\(/m.test(cfg), 'it has a top-level require');
check('the job defers its database require into a function',
  /function pool\(\)\s*\{\s*return require/.test(job));

/* ── RESULT ──────────────────────────────────────────────────────────────── */
console.log();
if (failures) {
  console.error(`${RED}${failures} check(s) failed.${OFF}`);
  process.exit(1);
}
console.log(`${GRN}ALL STOCK-NOTIFY GATES PASS${OFF}`);
