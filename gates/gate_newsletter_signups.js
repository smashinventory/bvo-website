'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_newsletter_signups.js
 *
 * THE BUG THIS EXISTS FOR. `newsletter_signups` was never created. From
 * 7bf20e2 (2026-07-23) to 2026-10-19 every homepage signup hit
 * ER_NO_SUCH_TABLE and was discarded while the form showed its success
 * message. Three months. The only reason anyone found out is that b4076ef
 * replaced a silent catch with a logged one on 2026-09-02 — and even then
 * the line sat in production for seven weeks before it was read.
 *
 * WHAT IS ACTUALLY GUARDED, in order of what it would cost to get wrong:
 *
 *   1. THE TABLE IS CREATED, AND `email` IS UNIQUE. The handler uses
 *      INSERT IGNORE to make a repeat signup a no-op. Without the unique
 *      index there is nothing to collide with, so IGNORE silently stops
 *      deduplicating and a twice-subscriber gets mailed twice.
 *
 *   2. THE ROW IS WRITTEN BEFORE BREVO IS CALLED. Our table is the durable
 *      record; Brevo is the copy. Reversed, a DB failure loses an address
 *      the platform already has and we cannot say who.
 *
 *   3. THE LIST ID IS NEVER GUESSED. A Brevo contact created with no list
 *      exists and receives nothing. An unset BREVO_NEWSLETTER_LIST_ID must
 *      be a reported refusal, not a success.
 *
 *   4. THE FAILURE IS STILL LOUD. The logged catch is what surfaced this.
 *      Removing it puts the whole thing back in the dark.
 *
 *   5. RECOVERY DOES NOT INVENT DATA. The script's dry run is the default,
 *      it refuses when the table is missing, and it does not sync recovered
 *      rows to Brevo.
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

const CTRL  = read('src/controllers/accountController.js');
const BREVO = read('src/services/brevoService.js');
const MIG   = read('migrations/2026-10-19_newsletter_signups_RUNME.sql');
const REC   = read('scripts/recoverNewsletterSignups.js');

/* ⚠️ EVERY SOURCE IS COMMENT-STRIPPED, NOT JUST THE CONTROLLER.
   This change is heavily commented and almost every string checked below
   also appears in the prose explaining it. A grep that matches its own
   rationale proves nothing.

   The first draft stripped only accountController and left brevoService,
   the migration and the recovery script raw. The mutation harness caught
   four misses in one run, all the same shape:

     - deleting the `brevo_synced_at` COLUMN still left the name in the
       index and the comments
     - hardcoding the list id still left BREVO_NEWSLETTER_LIST_ID in the
       error message
     - swapping INSERT IGNORE for REPLACE still left "INSERT IGNORE" in the
       comment above it
     - deleting the future-date guard still left the word "future" nearby

   Four checks that would have passed over four real regressions. Blanked
   rather than deleted so line numbers still match the real file. */
const blankJs = s => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/^\s*\/\/.*$/gm,     m => m.replace(/[^\n]/g, ' '));

/* SQL comments are `--` to end of line. */
const blankSql = s => s.replace(/--[^\n]*/g, m => m.replace(/[^\n]/g, ' '));

const CODE     = blankJs(CTRL);
const BREVO_C  = blankJs(BREVO);
const REC_C    = blankJs(REC);
const MIG_C    = blankSql(MIG);

console.log('\ngate_newsletter_signups — the signups stop vanishing\n');

/* ── 1. the table ─────────────────────────────────────────────────────── */
console.log('--- the table that was never created ---');

check(/CREATE TABLE IF NOT EXISTS `newsletter_signups`/.test(MIG_C),
      'the migration creates newsletter_signups');

check(/UNIQUE KEY `uniq_email` \(`email`\)/.test(MIG_C),
      'email is UNIQUE',
      'INSERT IGNORE needs something to collide with. Without this index it ' +
      'silently stops deduplicating and a repeat subscriber is stored twice, ' +
      'which becomes two sends and then an unsubscribe.');

/* ⚠️ THE COLUMN DEFINITION, not a mention of the name. `brevo_synced_at`
   also appears in KEY idx_unsynced, so a bare name search stays true even
   when the column itself is deleted — which is exactly what the harness
   proved. The type that must follow is what makes this a definition. */
['email', 'source', 'created_at', 'brevo_synced_at', 'brevo_error']
  .forEach(c => check(
    new RegExp('`' + c + '`\\s+(VARCHAR|DATETIME|INT|TINYINT|TEXT)', 'i').test(MIG_C),
    `the migration DEFINES ${c} with a type`,
    `A reference to ${c} elsewhere in the file is not a column.`));

/* Everything the handler and the script INSERT must exist in the schema.
   This is the generalisable check — the same shape that would have caught
   the order_deletions ghost column. */
const inserted = new Set();
[...CODE.matchAll(/INSERT IGNORE INTO newsletter_signups \(([^)]+)\)/g)]
  .forEach(m => m[1].split(',').forEach(c => inserted.add(c.trim())));
[...REC.matchAll(/INSERT IGNORE INTO newsletter_signups \(([^)]+)\)/g)]
  .forEach(m => m[1].split(',').forEach(c => inserted.add(c.trim())));
const ghosts = [...inserted].filter(c => !new RegExp('`' + c + '`').test(MIG));
check(inserted.size >= 3 && ghosts.length === 0,
      `every column written to newsletter_signups exists (${inserted.size} checked)`,
      ghosts.length ? 'NOT IN THE MIGRATION: ' + ghosts.join(', ') : '');

check(/INSERT IGNORE INTO `newsletter_signups`[\s\S]*h\.melotto@melottogroup\.com/.test(MIG_C),
      'the one address we know was lost is restored by the migration');

/* ── 2. order of operations ───────────────────────────────────────────── */
console.log('');
console.log('--- the row is written before Brevo is told ---');

const iInsert = CODE.indexOf('INSERT IGNORE INTO newsletter_signups');
const iBrevo  = CODE.indexOf('brevo.upsertContact');
const iSync   = CODE.indexOf('UPDATE newsletter_signups');

check(iInsert !== -1, 'the handler inserts the signup');
check(iBrevo  !== -1, 'the handler pushes to Brevo');
check(iInsert !== -1 && iBrevo !== -1 && iInsert < iBrevo,
      'the INSERT comes first',
      'Pushing to Brevo before storing locally means a DB failure loses an ' +
      'address the platform already holds, with no local record of who it was.');
check(iBrevo !== -1 && iSync !== -1 && iBrevo < iSync,
      'and the sync state is recorded after the push');

check(/if \(stored\)/.test(CODE),
      'Brevo is skipped when the row did not store',
      'Without a row there is nothing to mark synced, and the address would ' +
      'exist in Brevo and nowhere locally.');

/* ── 3. the list id is never guessed ──────────────────────────────────── */
console.log('');
console.log('--- the Brevo list id ---');

check(/exports\.upsertContact/.test(BREVO_C),
      'brevoService exposes upsertContact',
      'Before 2026-10-19 this service could only SEND mail — nothing could ' +
      'put a contact INTO Brevo, so the subscriber list never left our DB.');

check(/process\.env\.BREVO_NEWSLETTER_LIST_ID/.test(BREVO_C),
      'it reads BREVO_NEWSLETTER_LIST_ID from the environment');

check(/Number\.isInteger\(listId\)/.test(BREVO_C),
      'and refuses a missing or non-numeric list id',
      'A Brevo contact created with no list exists and receives nothing. ' +
      'Silently. An unset id has to be a refusal, not a success.');

check(/updateEnabled:\s*true/.test(BREVO_C),
      'updateEnabled is set, so a returning subscriber is an update',
      'Without it Brevo answers 400 duplicate_parameter and every repeat ' +
      'signup looks like a failure.');

/* upsertContact must never throw: the handler awaits it inline on a public
   endpoint. */
check(/catch \(err\) \{[\s\S]{0,400}return \{ ok: false/.test(BREVO_C),
      'upsertContact returns a result object rather than throwing',
      'It is awaited inline in a public form handler. An exception there ' +
      'becomes a 500 on a newsletter signup.');

/* ── 4. the failure stays loud ────────────────────────────────────────── */
console.log('');
console.log('--- the logging that found this ---');

check(/ER_NO_SUCH_TABLE/.test(CODE),
      'the handler still names ER_NO_SUCH_TABLE explicitly',
      'This exact branch is the only reason the three-month outage was ever ' +
      'noticed. b4076ef added it; removing it puts the next one in the dark.');

check(/console\.error\('\[account\] newsletter: Brevo sync failed/.test(CODE),
      'a failed Brevo sync is logged, not swallowed');

/* ⚠️ SCOPED TO THE NEWSLETTER HANDLER, deliberately.
   The first version of this check scanned the whole controller and failed on
   `authCode.purgeExpired().catch(() => {})` — a different line, in a
   different handler, doing harmless housekeeping. That was a FAIR CATCH
   (it has since been given a log line, because a purge that silently stops
   working is the same shape of bug) but it is not what this gate is about.

   A gate that fails on unrelated code gets narrowed by the next person
   under time pressure, and narrowing it badly is how it stops guarding
   anything. So it is narrowed correctly, here, on purpose. */
const nlStart = CODE.indexOf('exports.newsletter');
const nlEnd   = CODE.indexOf('\n};', nlStart);
const NEWSLETTER = nlStart === -1 ? '' : CODE.slice(nlStart, nlEnd > nlStart ? nlEnd : undefined);

check(NEWSLETTER.length > 200, 'the newsletter handler was located for scanning');
check(!/\.catch\(\(\) => \{\}\)/.test(NEWSLETTER),
      'no empty catch in the newsletter handler',
      'The empty catch is what hid signups between 2026-07-23 and 2026-09-02. ' +
      'Those are unrecoverable — there is no log line to read them back from.');

/* And the lesson applied beyond this handler: the file as a whole should not
   reacquire a silent catch either. Checked as a WARNING-shaped assertion
   with the known-good exception named, rather than a blanket ban that would
   fail on the next legitimate fire-and-forget. */
const emptyCatches = (CODE.match(/\.catch\(\(\) => \{\}\)/g) || []).length;
check(emptyCatches === 0,
      `no empty catch anywhere in accountController (${emptyCatches} found)`,
      'b4076ef swept these out site-wide on 2026-09-02 and missed one. If a ' +
      'new fire-and-forget genuinely needs no handling, give it a one-line ' +
      'console.error anyway — a silence you cannot measure is not a decision.');

/* ── 5. the recovery script ───────────────────────────────────────────── */
console.log('');
console.log('--- recovery does not invent data ---');

check(/EXECUTE\s*=\s*process\.argv\.includes\('--execute'\)/.test(REC_C),
      'dry run is the default',
      'Same contract as cleanupTestOrders.js: --execute is the only way to write.');

check(/DRY RUN — nothing was written/.test(REC_C),
      'and it says so when it has not written');

check(/ER_NO_SUCH_TABLE[\s\S]{0,300}REFUSING/.test(REC_C),
      'it refuses when the table is missing, with one clear message',
      'Otherwise it throws the same ER_NO_SUCH_TABLE per row — the very ' +
      'failure it exists to clean up after.');

check(/source, created_at\)\s*\n\s*VALUES \(\?, 'recovered', \?\)/.test(REC_C),
      "recovered rows are marked source='recovered'",
      'They came from a log, not a provable form submission. Anyone auditing ' +
      'the list deserves to see the difference.');

check(/INSERT IGNORE INTO newsletter_signups/.test(REC_C),
      'and INSERT IGNORE, so a live row is never overwritten by recovery');

check(/NOT synced to Brevo/.test(REC_C),
      'recovered rows are NOT pushed to Brevo',
      'Some of these subscribed three months ago and have heard nothing. ' +
      'Mailing a stale list in one burst is how a sending domain gets burned.');

check(/2026-09-02/.test(REC_C) && /gone for good/i.test(REC_C),
      'it states plainly which signups cannot be recovered',
      'Before 2026-09-02 the catch was empty: no line, no row, no trace. A ' +
      'recovery tool that implies completeness is worse than none.');

/* The year-inference limitation has to be acknowledged in the code, because
   a log line carries no year and a January line would otherwise be silently
   dated twelve months late. */
check(/ASSUMED_YEAR/.test(REC_C) && /Date\.now\(\) \+ 60_000/.test(REC_C),
      'the missing-year problem is handled and a future date is refused');

console.log('');
if (fail) {
  console.log(`gate_newsletter_signups: FAILED ${fail} of ${pass + fail} checks\n`);
  process.exit(1);
}
console.log(`gate_newsletter_signups: all ${pass} checks pass\n`);
