'use strict';
/* MUTATION HARNESS for gates/gate_stock_notify.js.
 *
 * Breaks each guarded property on purpose, one at a time, and asserts the gate
 * goes RED. A mutation the gate does not catch means that check is not testing
 * what its name claims, and this process exits non-zero.
 *
 * ⚠️ A MISSING ANCHOR IS A FAILURE, NOT A SKIP. If the code moves and a
 * search string stops matching, that is reported loudly. A harness that
 * silently skips mutations it can no longer apply reports "all caught" while
 * testing nothing — worse than no harness, because it is believed.
 *
 * Every file is restored byte-for-byte and the restore is VERIFIED by hash,
 * including on an unexpected throw.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'gate_stock_notify.js');

const CFG = 'src/config/stockNotify.js';
const JOB = 'src/jobs/stockNotify.js';
const PDP = 'views/pages/product.ejs';
const MIG = 'migrations/2026-11-09_stock_notifications_RUNME.sql';
const RTE = 'src/routes/notifyMe.js';

const abs = p => path.join(ROOT, p);
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(abs(p))).digest('hex');
const RED = '\u001b[31m', GRN = '\u001b[32m', OFF = '\u001b[0m';

const TOUCHED = [CFG, JOB, PDP, MIG, RTE];
const ORIGINAL = {};
for (const f of TOUCHED) ORIGINAL[f] = { text: fs.readFileSync(abs(f), 'utf8'), hash: sha(f) };

function restoreAll() {
  for (const f of TOUCHED) {
    fs.writeFileSync(abs(f), ORIGINAL[f].text);
    if (sha(f) !== ORIGINAL[f].hash) {
      console.error(`${RED}CATASTROPHE${OFF}  ${f} did not restore. Run: git checkout -- ${f}`);
      process.exitCode = 2;
    }
  }
}
process.on('exit', restoreAll);
process.on('SIGINT', () => { restoreAll(); process.exit(130); });

function gateIsGreen() {
  try {
    execFileSync(process.execPath, [GATE], { cwd: ROOT, stdio: 'pipe' });
    return true;
  } catch { return false; }
}

const MUTATIONS = [
  { name: 'the out-of-stock check is removed — everyone gets emailed',
    file: CFG,
    find: '  if (!Number.isFinite(qty) || qty < RULES.MIN_QTY) {',
    repl: '  if (false) {',
    guards: 'no notice goes out for stock that is not there' },

  { name: 'a qty of 0 is treated as available',
    file: CFG,
    find: '  MIN_QTY: 1,',
    repl: '  MIN_QTY: 0,',
    guards: 'qty 0 is refused' },

  { name: 'the already-notified check is dropped — people get emailed twice',
    file: CFG,
    find: '  if (row.notified_at)           return { ok: false, reason: \'already notified\' };',
    repl: '  if (false)                     return { ok: false, reason: \'already notified\' };',
    guards: 'one notice per person per product' },

  { name: 'the marketing checkbox is pre-ticked',
    file: PDP,
    find: '<input type="checkbox" name="marketing_opt_in">',
    repl: '<input type="checkbox" name="marketing_opt_in" checked>',
    guards: 'the checkbox carries NO checked attribute' },

  { name: 'the opt-in column defaults to 1',
    file: MIG,
    find: 'marketing_opt_in TINYINT(1) NOT NULL DEFAULT 0,',
    repl: 'marketing_opt_in TINYINT(1) NOT NULL DEFAULT 1,',
    guards: 'the column defaults to 0' },

  { name: 'a missing opt-in value starts counting as consent',
    file: CFG,
    find: "  return formValue === 'on' || formValue === '1' || formValue === 'true' || formValue === true;",
    repl: '  return formValue !== false;',
    guards: 'an absent value is not consent' },

  { name: 'the unique key is dropped, so duplicates can queue',
    file: MIG,
    find: '  UNIQUE KEY uniq_request (product_id, email),',
    repl: '  KEY uniq_request (product_id, email),',
    guards: 'the table enforces it too' },

  { name: 'notified_at is stamped BEFORE the send, so an outage looks delivered',
    file: JOB,
    find: '      await brevo.sendTemplate(TEMPLATE_KEY, row.email, {',
    repl: '      await pool().query(`UPDATE stock_notifications SET notified_at = NOW() WHERE id = ?`, [row.id]);\n      await brevo.sendTemplate(TEMPLATE_KEY, row.email, {',
    guards: 'notified_at is stamped AFTER the send resolves' },

  { name: 'the capture form loses its CSRF token',
    file: PDP,
    find: '          <input type="hidden" name="_csrf"      value="<%= csrfToken %>">\n          <input type="hidden" name="product_id"',
    repl: '          <input type="hidden" name="product_id"',
    guards: 'it carries a CSRF token' },

  { name: 'the endpoint starts reporting failure, turning it into an oracle',
    file: RTE,
    find: '  const ok = () => replyOk(req, res);',
    repl: '  const ok = () => replyOk(req, res);\n  const nope = () => res.status(422).json({ ok: false });',
    guards: 'every path answers success' },

  { name: 'raw error text is returned to the browser',
    file: RTE,
    find: "    console.error('[notify-me] save failed:', err.message);",
    repl: "    console.error('[notify-me] save failed:', err.message);\n    return res.json({ ok: false, error: err.message });",
    guards: 'raw error text is never sent' },

  { name: 'the expiry window is widened to three years',
    file: CFG,
    find: '  EXPIRY_DAYS: 90,',
    repl: '  EXPIRY_DAYS: 1095,',
    guards: 'the expiry window is still 90 days' },

  { name: 'the config grows a top-level require, so the gate cannot load it without a DB',
    file: CFG,
    find: "const RULES = {",
    repl: "const db = require('./database');\nconst RULES = {",
    guards: 'stockNotify.js requires nothing' },

  { name: 'the job quietly starts consulting the suppression list',
    file: JOB,
    find: "const unsubToken = require('../utils/unsubscribeToken');",
    repl: "const unsubToken = require('../utils/unsubscribeToken');\nconst contactLog = require('../utils/contactLog');",
    guards: 'the job does not quietly consult the suppression list' },
];

console.log('Baseline: the gate must be GREEN before any mutation.\n');
if (!gateIsGreen()) {
  console.error(`${RED}ABORT${OFF}  the gate is already failing. Fix that before trusting this harness.`);
  process.exit(1);
}
console.log(`${GRN}ok${OFF}  baseline green\n`);

let missed = 0, missing = 0;
for (const m of MUTATIONS) {
  const before = ORIGINAL[m.file].text;
  if (!before.includes(m.find)) {
    console.error(`${RED}ANCHOR MISSING${OFF}  ${m.name}`);
    console.error(`                 ${m.file} no longer contains: ${JSON.stringify(m.find.slice(0, 70))}`);
    console.error('                 The code moved. Re-anchor this mutation — do NOT delete it.');
    missing += 1;
    continue;
  }
  fs.writeFileSync(abs(m.file), before.replace(m.find, m.repl));
  const green = gateIsGreen();
  fs.writeFileSync(abs(m.file), before);

  if (green) {
    console.error(`${RED}NOT CAUGHT${OFF}  ${m.name}`);
    console.error(`              expected to trip: ${m.guards}`);
    missed += 1;
  } else {
    console.log(`${GRN}caught${OFF}      ${m.name}`);
  }
}

console.log();
if (missing) console.error(`${RED}${missing} mutation(s) could not be applied — anchors are stale.${OFF}`);
if (missed)  console.error(`${RED}${missed} mutation(s) went undetected — those checks do not work.${OFF}`);
if (!missing && !missed) console.log(`${GRN}All ${MUTATIONS.length} mutations caught.${OFF}`);

process.exit((missing || missed) ? 1 : 0);
