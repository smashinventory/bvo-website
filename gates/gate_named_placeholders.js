#!/usr/bin/env node
'use strict';

/* gate_named_placeholders.js — the flag stays scoped, and the scope stays wired.
 *
 * WHAT HAPPENED. namedPlaceholders was set on bvoPool on 2026-07-15 for one
 * caller: importJamesMartinFeed.upsertProduct, a 44-column INSERT where
 * :sku, :slug, ... is genuinely safer than 44 hand-counted positional marks.
 * Good reason, wrong scope. With the flag on the pool, mysql2 routed EVERY
 * query in the app through named-placeholders — a library that DOES NOT
 * UNDERSTAND SQL COMMENTS.
 *
 * On 2026-10-16 a question mark inside a block comment in a CREATE TABLE:
 *
 *     "Did this request carry OUR session cookie back to us?"
 *
 * was read as a positional placeholder on a query with no parameters. It
 * threw inside the driver, as an uncaughtException, on every boot. Two
 * outages, and it was invisible to every static search we ran because our
 * own scans stripped comments before looking.
 *
 * THE TWO FAILURES THIS GATE EXISTS TO PREVENT, which are opposites:
 *
 *   1. The flag creeps back onto the pool. The landmine returns for every
 *      query in the app, and nothing fails until someone writes a comment
 *      with a question mark in it — possibly months later.
 *
 *   2. The per-query option is dropped from upsertProduct while the :name
 *      placeholders remain. mysql2 then refuses the object outright and the
 *      NIGHTLY JM FEED IMPORT STOPS. That one is loud, but it is loud at
 *      04:30 UTC in a cron log nobody is watching.
 *
 * Both halves must move together or not at all, which is why they are gated
 * in one file rather than two.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok    = m => { checks++; console.log('  ok   ' + m); };
const bad   = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const read  = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

const DB  = read('src/config/database.js');
const IMP = read('src/jobs/importJamesMartinFeed.js');

console.log('\ngate_named_placeholders — scoped to one query, and still wired to it\n');

/* ── 1. the flag is NOT on the pool ──────────────────────────────── */
console.log('--- the flag is off the pool ---');
{
  /* Scoped to the createPool call: the word appears several times in the
     explanatory comments below it, and a whole-file grep would pass on
     prose while the flag was switched back on. */
  const i = DB.indexOf('mysql.createPool({');
  const j = DB.indexOf('});', i);
  const POOL = i > -1 && j > i ? DB.slice(i, j) : '';
  check(POOL.length > 0, 'the bvoPool createPool call can be isolated');
  check(!/namedPlaceholders\s*:\s*true/.test(POOL),
        'bvoPool does NOT set namedPlaceholders: true',
        'pool-wide, this makes every SQL comment containing ? a landmine');
}

/* ── 2. ...but the capability is still wired to its one consumer ── */
console.log('--- the importer still gets it, per query ---');
{
  const i = IMP.indexOf('async function upsertProduct');
  const j = IMP.indexOf('`, [data.sku]', i);
  const FN = i > -1 ? IMP.slice(i, j > i ? j : i + 6000) : '';
  check(FN.length > 0, 'upsertProduct can be isolated');
  check(/namedPlaceholders:\s*true/.test(FN),
        'upsertProduct requests namedPlaceholders per query',
        'without it mysql2 rejects the object and the nightly JM import STOPS');
  check(/:sku\b/.test(FN) && /:slug\b/.test(FN),
        'upsertProduct still uses :name placeholders');
  check(/conn\.query\(\s*\{/.test(FN),
        'it is passed as the OPTIONS OBJECT form of conn.query',
        'the option has no effect as a third argument');
}

/* The pairing, stated as one rule: :name placeholders and the per-query
   option must both be present, or both absent. */
console.log('--- the two halves cannot drift apart ---');
{
  const usesNamed = /VALUES\s*\(\s*:sku/.test(IMP);
  const asksOpt   = /namedPlaceholders:\s*true/.test(IMP);
  check(usesNamed === asksOpt,
        ':name placeholders and the per-query option are both present, or both absent',
        'named=' + usesNamed + ' option=' + asksOpt +
        ' — one without the other breaks the nightly JM feed import');
}

/* ── 3. it RESOLVES — executed against mysql2's own code ─────────
   The checks above are text. This one runs the driver's real resolver on
   the real SQL, because "the option is present" and "the query works" are
   different claims and only the second one matters at 04:30 UTC. */
console.log('--- the importer INSERT actually resolves, via mysql2 ---');
{
  let resolve = null;
  try {
    resolve = require(path.join(ROOT, 'node_modules/mysql2/lib/base/connection.js'))
                .prototype._resolveNamedPlaceholders;
  } catch (e) { bad('mysql2 _resolveNamedPlaceholders can be loaded', e.message); }

  if (resolve) {
    const i = IMP.indexOf('INSERT INTO products (');
    const j = IMP.indexOf('` }, data);', i);
    const SQL = i > -1 && j > i ? IMP.slice(i, j) : '';
    check(SQL.length > 0, 'the INSERT statement can be extracted');

    const names = (SQL.match(/:[a-zA-Z_]\w*/g) || []).map(t => t.slice(1));
    const data = {};
    names.forEach(n => { data[n] = 'v'; });

    /* Exactly the live configuration: pool flag OFF, per-query option ON. */
    const options = { sql: SQL, values: Object.assign({}, data), namedPlaceholders: true };
    try {
      resolve.call({ config: { namedPlaceholders: false } }, options);
      const marks = (options.sql.match(/\?/g) || []).length;
      check(marks === names.length && marks > 20,
            'every :name resolves to a positional mark (' + marks + ' of ' + names.length + ')');
      check(Array.isArray(options.values) && options.values.length === marks,
            'the values array matches the placeholder count',
            'a mismatch writes the wrong value into the wrong column, silently');
      check(!/:[a-zA-Z_]\w*/.test(options.sql),
            'no :name token survives into the SQL sent to MySQL');
    } catch (e) {
      bad('the importer INSERT resolves with the per-query option', e.message);
    }

    /* And the failure mode is loud, not silent — worth proving, because the
       whole argument for this change rests on it. */
    try {
      const o2 = { sql: SQL, values: Object.assign({}, data) };
      resolve.call({ config: { namedPlaceholders: false } }, o2);
      check(/:[a-zA-Z_]\w*/.test(o2.sql),
            'WITHOUT the option the SQL is left unresolved — mysql2 then rejects it loudly',
            'this is the failure mode we are accepting: a broken import, not bad data');
    } catch (e) { ok('without the option mysql2 refuses outright: ' + e.message.slice(0, 50)); }
  }
}

/* ── 4. no SQL comment carries a placeholder character ───────────
   The actual 2026-10-16 bug. Belt and braces: with the flag scoped this can
   no longer crash the app, but the importer's own SQL still goes through
   named-placeholders, so a question mark in ITS comments would break the
   nightly import. */
console.log('--- no SQL comment contains ? or :token ---');
{
  let np = null;
  try { np = require(path.join(ROOT, 'node_modules/named-placeholders'))(); }
  catch (e) { bad('named-placeholders can be loaded', e.message); }

  if (np) {
    /* Proof the detector detects: the real comment that caused the outage. */
    let caught = false;
    try { np('CREATE TABLE t (a INT) /* carry it back to us? */', undefined); }
    catch (e) { caught = true; }
    check(caught,
          'the detector itself trips on the real 2026-10-16 comment',
          'if this passes, the scan below proves nothing');

    /* The SQL STRING only — from the INSERT keyword, not from the function
       declaration. The JS comment above the call explains the option and
       necessarily contains ":name", which is not SQL and must not be scanned.
       The first run of this gate failed on its own documentation. */
    /* From the OPENING BACKTICK of the template literal, not from the INSERT
       keyword. A comment placed above INSERT is still inside the SQL and
       still reaches named-placeholders; scanning from INSERT missed exactly
       that, and the mutation harness proved it. Starting at the backtick
       also excludes the JS comment above the call, which legitimately
       contains ":name". */
    const bt = IMP.indexOf('namedPlaceholders: true, sql: `');
    const i  = bt > -1 ? IMP.indexOf('`', bt) + 1 : -1;
    const j  = IMP.indexOf('` }, data);', i);
    const SQL = i > 0 && j > i ? IMP.slice(i, j) : '';
    check(SQL.length > 0 && !/async function/.test(SQL),
          'the scan covers the whole SQL literal, and no surrounding JS');
    check(/INSERT INTO products/.test(SQL),
          'the extracted literal is the upsert statement');
    const comments = SQL.match(/\/\*[\s\S]*?\*\/|--[^\n]*/g) || [];
    const offenders = comments.filter(c => /\?|:[a-zA-Z_]/.test(c));
    check(offenders.length === 0,
          'the importer INSERT has no ? or :token inside a SQL comment',
          offenders.join(' | ').slice(0, 160));
  }
}

console.log('\n' + (fails
  ? 'gate_named_placeholders: FAILED ' + fails + ' of ' + checks
  : 'gate_named_placeholders: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
