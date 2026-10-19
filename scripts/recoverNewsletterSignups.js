#!/usr/bin/env node
'use strict';

/**
 * recoverNewsletterSignups.js — pull the lost subscribers back out of the log.
 *
 * WHY THIS EXISTS. `newsletter_signups` was never created. From 7bf20e2
 * (2026-07-23) until 2026-10-19 every homepage signup hit ER_NO_SUCH_TABLE
 * and was discarded, while the form showed its success message. The visitor
 * believed they had subscribed; nothing was stored.
 *
 * The addresses are not gone. b4076ef (2026-09-02) replaced the silent
 * `.catch(() => {})` with a logged catch, so from that date every discarded
 * address was printed:
 *
 *   OCT 19,18:47:37.732[account] newsletter: signup insert failed for
 *   h.melotto@melottogroup.com ER_NO_SUCH_TABLE Table '…' doesn't exist
 *
 * This reads those lines back and inserts them.
 *
 * ⚠️ SIGNUPS BETWEEN 07-23 AND 09-02 ARE UNRECOVERABLE. During that window
 * the catch was empty — no log line, no row, no trace. Nothing can get them
 * back, and this script will not pretend otherwise: it reports the window it
 * can see and says plainly that anything earlier is lost.
 *
 * USAGE
 *   node scripts/recoverNewsletterSignups.js <logfile> [more logfiles…]
 *   node scripts/recoverNewsletterSignups.js <logfile> --execute
 *
 * DRY RUN IS THE DEFAULT. Without --execute it parses, de-duplicates and
 * prints what it would insert, and touches nothing. Same contract as
 * cleanupTestOrders.js.
 *
 * ⚠️ IT DOES NOT PUSH TO BREVO. Recovered rows land with brevo_synced_at
 * NULL, deliberately: these people subscribed up to three months ago and
 * have heard nothing since. Mailing a stale list in one burst is how a
 * sending domain gets a spam reputation. Decide the re-engagement approach
 * first, then sync them.
 */

const fs   = require('fs');
const path = require('path');

/* The log line, as accountController writes it. Email pattern is
   deliberately loose — it has to match whatever the visitor typed, not
   whatever is strictly RFC-valid. */
const LINE = /newsletter:\s*signup insert failed for\s+(\S+@\S+?)\s+(\w+)/i;

/* The timestamp prefix: "OCT 19,18:47:37.732". No year, because the log
   format does not carry one. */
const STAMP = /^([A-Z]{3})\s+(\d{1,2}),(\d{2}):(\d{2}):(\d{2})/;

const MONTHS = { JAN:0, FEB:1, MAR:2, APR:3, MAY:4, JUN:5,
                 JUL:6, AUG:7, SEP:8, OCT:9, NOV:10, DEC:11 };

/* ⚠️ THE YEAR IS INFERRED, AND THAT IS A REAL LIMITATION.
   The log has no year. Assuming "this year" is right for a log that spans
   months, and wrong for one that crosses New Year — a January line would be
   dated twelve months late. The script says so rather than quietly guessing,
   and a future-dated result is refused outright. */
const ASSUMED_YEAR = new Date().getFullYear();

const pad = n => String(n).padStart(2, '0');

/* ⚠️ RETURNS A STRING, NOT A Date, AND THAT IS THE POINT.
   An earlier version built `new Date(y, mon, d, h, m, s)` — local time —
   and then printed it with toISOString(), which converts to UTC. A log line
   reading 18:47:37 displayed as 22:47:37 and would have been STORED four
   hours late. Every recovered subscriber's signup time, wrong, silently.

   The log has no timezone. It is written in the server's local time, and
   the only correct interpretation is "the same wall-clock time". A
   'YYYY-MM-DD HH:MM:SS' string passed straight to MySQL is stored verbatim,
   with no Date object in between to apply a conversion nobody asked for.

   `at` is kept alongside purely for ordering and the future check. */
function parseStamp(line) {
  const m = line.match(STAMP);
  if (!m) return null;
  const mon = MONTHS[m[1].toUpperCase()];
  if (mon === undefined) return null;

  const d = new Date(ASSUMED_YEAR, mon, Number(m[2]),
                     Number(m[3]), Number(m[4]), Number(m[5]));
  /* A timestamp in the future means the year inference was wrong. */
  if (d.getTime() > Date.now() + 60_000) return null;

  return {
    sql: `${ASSUMED_YEAR}-${pad(mon + 1)}-${pad(Number(m[2]))} ` +
         `${pad(Number(m[3]))}:${pad(Number(m[4]))}:${pad(Number(m[5]))}`,
    at:  d.getTime(),
  };
}

const files   = process.argv.slice(2).filter(a => !a.startsWith('--'));
const EXECUTE = process.argv.includes('--execute');

if (!files.length) {
  console.error('Usage: node scripts/recoverNewsletterSignups.js <logfile> [...] [--execute]');
  process.exit(64);
}

/* email -> earliest sighting. Earliest, not latest: it is when they first
   asked to hear from you, and a repeat submission does not reset that. */
const found   = new Map();
let   lines   = 0, matched = 0, undated = 0;

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.error(`REFUSING: no such file — ${f}`);
    process.exit(66);
  }
  const text = fs.readFileSync(f, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    lines++;
    const m = raw.match(LINE);
    if (!m) continue;
    matched++;

    const email = m[1].trim().toLowerCase().replace(/[.,;]+$/, '');
    const when  = parseStamp(raw);
    if (!when) undated++;

    const prev = found.get(email);
    /* Earliest sighting wins — see above. Compared on `at` (a number),
       never on the SQL string, because '2026-09-03 09:12:01' sorts fine
       but only by accident of zero-padding. */
    if (!prev || (when && prev.when && when.at < prev.when.at) ||
        (when && !prev.when)) {
      found.set(email, { when, code: m[2] });
    }
  }
}

console.log('');
console.log(`  files scanned     ${files.length}`);
console.log(`  lines read        ${lines.toLocaleString('en-US')}`);
console.log(`  failure lines     ${matched}`);
console.log(`  unique addresses  ${found.size}`);
if (undated) {
  console.log(`  ⚠ undated lines   ${undated} — timestamp unparseable, they will`);
  console.log( '                    be inserted with the time of recovery instead');
}

if (!found.size) {
  console.log('');
  console.log('  Nothing to recover from these files.');
  console.log('  If you expected rows: the log line only exists from 2026-09-02');
  console.log('  (b4076ef). Before that the failure was swallowed silently and');
  console.log('  those signups cannot be recovered from anywhere.');
  console.log('');
  process.exit(0);
}

const rows = [...found.entries()]
  .map(([email, v]) => ({ email, when: v.when }))
  .sort((a, b) => (a.when && b.when) ? a.when.at - b.when.at : 0);

console.log('');
/* r.when.sql, NOT a Date — printing a Date here is what produced a
   four-hour skew between the log line and this output. What is shown is
   exactly what will be stored. */
rows.forEach(r => console.log(
  `  ${(r.when ? r.when.sql : '(no timestamp)').padEnd(21)} ${r.email}`));

const earliest = rows.find(r => r.when);
if (earliest) {
  console.log('');
  console.log(`  earliest recoverable signup: ${earliest.when.sql.slice(0, 10)}`);
  console.log('  ⚠ anything before 2026-09-02 was never logged and is gone for good.');
}

if (!EXECUTE) {
  console.log('');
  console.log('  DRY RUN — nothing was written. Re-run with --execute to insert.');
  console.log('');
  process.exit(0);
}

/* Local wall-clock, formatted the same way as a parsed log line, for the
   undated case. */
function nowSql() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/* ── the write ──────────────────────────────────────────────────────── */
(async () => {
  const { bvoPool } = require(path.join(__dirname, '..', 'src/config/database'));
  let inserted = 0, skipped = 0;

  try {
    /* Fail early and clearly if the migration has not been run, rather than
       throwing ER_NO_SUCH_TABLE per row — which is the exact failure this
       script exists to clean up after. */
    try {
      await bvoPool.query('SELECT 1 FROM newsletter_signups LIMIT 1');
    } catch (e) {
      if (e.code === 'ER_NO_SUCH_TABLE') {
        console.error('');
        console.error('  REFUSING: newsletter_signups does not exist.');
        console.error('  Run migrations/2026-10-19_newsletter_signups_RUNME.sql first.');
        console.error('');
        process.exit(69);
      }
      throw e;
    }

    for (const r of rows) {
      /* INSERT IGNORE: an address that has since subscribed again is
         already there with its own (later) date, and the existing row
         wins. Recovery must not overwrite live data.

         source='recovered' so these are distinguishable from organic
         signups forever — they came from a log, not a form submission we
         can prove, and anyone auditing the list deserves to know that. */
      const [res] = await bvoPool.query(
        `INSERT IGNORE INTO newsletter_signups (email, source, created_at)
         VALUES (?, 'recovered', ?)`,
        /* The SQL string verbatim, or NOW() shaped the same way when the
           line carried no parseable timestamp. No Date object crosses this
           boundary, so no timezone conversion can be applied to it. */
        [r.email, r.when ? r.when.sql : nowSql()]
      );
      if (res.affectedRows) inserted++; else skipped++;
    }

    console.log('');
    console.log(`  inserted ${inserted}, already present ${skipped}`);
    console.log('');
    console.log('  ⚠ These are NOT synced to Brevo (brevo_synced_at IS NULL),');
    console.log('    on purpose. Some subscribed up to three months ago and have');
    console.log('    heard nothing since. Decide how to re-engage before sending.');
    console.log('');
  } catch (err) {
    console.error('');
    console.error('  FAILED:', err.code || '', err.sqlMessage || err.message);
    console.error('');
    process.exitCode = 1;
  } finally {
    await bvoPool.end().catch(() => {});
  }
})();
