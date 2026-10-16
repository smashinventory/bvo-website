#!/usr/bin/env node
'use strict';

/* gate_process_safety.js — one bad request must not take the site down.
 *
 * THE INCIDENT THIS EXISTS FOR. On 2026-10-15 a single promise rejection —
 * one query called with its params undefined, on one route — terminated the
 * whole Node process. LiteSpeed restarted it, the next request killed it
 * again, and that repeated roughly once a second for an hour. Storefront,
 * checkout and admin all went down together.
 *
 * The restart was never the problem: the app restarted perfectly, about
 * 3,600 times. It died again immediately each time because nothing caught
 * the rejection. Node has terminated on unhandled rejections BY DEFAULT
 * since v15 (this server runs 18), which is right for a script and wrong
 * for a web server.
 *
 * WHAT IS GATED, and why each half matters:
 *
 *   1. The handlers exist, and are registered BEFORE the app is required.
 *      A handler installed after the requires does not protect the requires.
 *   2. unhandledRejection does NOT exit. This is the whole point. A future
 *      "tidy-up" that adds process.exit() here restores the outage.
 *   3. uncaughtException DOES exit. The opposite rule, deliberately: after
 *      a true uncaught throw the process state may be unsound, and carrying
 *      on gives you a server that is alive but quietly wrong. Swallowing
 *      these is the documented anti-pattern.
 *   4. The query wrapper attaches err.sql. Without it the log says a query
 *      failed and not which one — which is exactly the position we were in,
 *      unable to find the call by reading the code because the offending
 *      params are only undefined at runtime.
 *
 * The behavioural checks EXECUTE the real handler block extracted from
 * server.js in a child process, rather than grepping for it. A handler that
 * is present but wrong looks identical to a correct one in source text.
 */

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok    = m => { checks++; console.log('  ok   ' + m); };
const bad   = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const read  = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

const SRV = read('src/server.js');
const DB  = read('src/config/database.js');

console.log('\ngate_process_safety — one bad request must not take the site down\n');

/* ── 1. the handlers exist, and early enough to matter ───────────── */
console.log('--- the net is installed, and installed first ---');

const iReject = SRV.indexOf("process.on('unhandledRejection'");
const iThrow  = SRV.indexOf("process.on('uncaughtException'");
const iExpress = SRV.indexOf("require('express')");

check(iReject > -1, 'server.js registers an unhandledRejection handler');
check(iThrow  > -1, 'server.js registers an uncaughtException handler');
check(iReject > -1 && iExpress > -1 && iReject < iExpress,
      'unhandledRejection is registered BEFORE express is required',
      'a handler installed after the requires does not protect the requires');
check(iThrow > -1 && iExpress > -1 && iThrow < iExpress,
      'uncaughtException is registered BEFORE express is required');

/* ── 2. behaviour, executed — not grepped ────────────────────────
   The handler block is sliced out of the real server.js and run in a child
   process, so these checks test the shipped code. A child is used because
   the assertions are about whether a PROCESS survives, which cannot be
   observed from inside itself. */
console.log('--- behaviour, by running the real handler block ---');

/* Sliced to the start of the `const express` DECLARATION, not to the
   require() call inside it — cutting at the require leaves a dangling
   `const express =` and the child dies on a syntax error instead of on the
   thing under test. Which is what the first run of this gate did. */
const iExpressDecl = SRV.indexOf('const express', iReject);
const block = (() => {
  if (iReject < 0 || iExpressDecl < 0) return '';
  return SRV.slice(iReject, iExpressDecl);
})();
check(block.length > 0, 'the handler block can be extracted from server.js',
      'the behavioural checks below are worthless without it');

const TMP = path.join(require('os').tmpdir(), 'gate_proc_safety_handlers.js');
fs.writeFileSync(TMP, block);

/* spawnSync, not execFileSync: the handlers log via console.error, and
   execFileSync returns only stdout on success. The first run of this gate
   reported "not logged" for output that was there all along, on stderr. */
function run(script) {
  const r = spawnSync(process.execPath, ['-e', script],
                      { encoding: 'utf8', timeout: 10000 });
  return { out: (r.stdout || '') + (r.stderr || ''),
           code: r.status == null ? -1 : r.status };
}

/* THE core property: a rejection must not be fatal. */
{
  const r = run(`
    require(${JSON.stringify(TMP)});
    const err = new Error('Named query contains placeholders, but parameters object is undefined');
    err.sql = 'SELECT * FROM orders WHERE id = ?';
    Promise.reject(err);
    setTimeout(() => { console.log('ALIVE'); process.exit(0); }, 60);
  `);
  check(/ALIVE/.test(r.out) && r.code === 0,
        'an unhandled rejection does NOT kill the process',
        'exit=' + r.code + '  out=' + JSON.stringify(r.out.slice(-200)));
  check(/\[UNHANDLED\]/.test(r.out),
        'the rejection is logged with a greppable [UNHANDLED] prefix');
  check(/SELECT \* FROM orders WHERE id = \?/.test(r.out),
        'err.sql is printed — the log names WHICH query failed',
        'without this the log says a query failed and nothing more');
}

/* The opposite property, equally important. */
{
  const r = run(`
    require(${JSON.stringify(TMP)});
    setTimeout(() => { throw new Error('boom'); }, 10);
    setTimeout(() => { console.log('STILL-ALIVE-WRONGLY'); }, 400);
  `);
  check(r.code !== 0 && !/STILL-ALIVE-WRONGLY/.test(r.out),
        'an uncaught exception DOES exit, for a clean restart',
        'carrying on after a true uncaught throw leaves a server that is alive but unsound');
  check(/\[FATAL\]/.test(r.out),
        'the uncaught exception is logged with a greppable [FATAL] prefix');
  check(/boom/.test(r.out),
        'the exception message survives to the log');
  /* Source-level, because a bare process.exit() OFTEN still flushes - the
     behavioural check above passes by luck and then loses the log on a busy
     server. The mutation harness proved exactly that. */
  const thr = iThrow > -1 ? SRV.slice(iThrow, iExpressDecl) : '';
  check(/setTimeout\([\s\S]{0,80}process\.exit\(1\)/.test(thr),
        'the exit is deferred by a timer so stderr can flush first',
        'a bare process.exit(1) drops the [FATAL] lines on a loaded server');
}

try { fs.unlinkSync(TMP); } catch (_) {}

/* ── 3. the handlers must not be neutered in source ──────────────
   Belt and braces alongside the executed checks: these name the specific
   regression each one guards. */
console.log('--- the two rules are not quietly swapped ---');
{
  const rejBlock = iReject > -1 && iThrow > -1
    ? SRV.slice(iReject, iThrow) : '';
  check(rejBlock.length > 0, 'the unhandledRejection body can be isolated');
  check(!/process\.exit/.test(rejBlock),
        'the unhandledRejection handler contains NO process.exit',
        'adding one here restores the 2026-10-15 outage exactly');
  const thrBlock = iThrow > -1 ? SRV.slice(iThrow, iExpressDecl) : '';
  check(/process\.exit\(1\)/.test(thrBlock),
        'the uncaughtException handler DOES exit(1)');
}

/* ── 4. the query wrapper, which makes the log useful ────────────── */
console.log('--- query errors carry their SQL ---');
check(/err\.sql\s*=/.test(DB),
      'database.js attaches err.sql to failing queries');
{
  /* Scoped to the wrapper body: `throw err;` appears twice, so a mutation
     replacing ONE of them with `throw new Error(...)` left the whole-file
     check green. Assert the absence of construction instead. */
  const i = DB.indexOf('function attachSql');
  const j = DB.indexOf('attachSql(bvoPool', i);
  const W = i > -1 && j > i ? DB.slice(i, j) : '';
  check(W.length > 0, 'the wrapper body can be isolated');
  check(/catch\s*\(err\)/.test(W),
        'the wrapper catches query errors');
  check(!/throw new /.test(W),
        'the wrapper rethrows the SAME error object, never a new one',
        'constructing a new Error discards err.code, err.errno and the original stack');
  check((W.match(/throw err;/g) || []).length >= 2,
        'both the async and synchronous paths rethrow',
        'mysql2 can throw before it returns a promise - that is the case this exists for');
}
/* Must be a LIVE call, not a commented one. An indexOf for the identifier
   passes happily on "// attachSql(bvoPool...)", which is a silent no-op -
   the wrapper defined and never installed. Mutation-proven. */
check(/^\s*attachSql\(bvoPool/m.test(DB),
      'the wrapper is actually applied to bvoPool (live call, not commented)',
      'defining it and not calling it is a silent no-op');

/* Executed: the wrapper must survive a synchronous throw too, which is the
   shape the named-placeholders failure takes on some paths. */
{
  const r = run(`
    const mysql = require(${JSON.stringify(path.join(ROOT, 'node_modules/mysql2/promise'))});
    const pool = mysql.createPool({ host:'127.0.0.1', namedPlaceholders:true, connectTimeout:200 });
    const raw = pool.query.bind(pool);
    pool.query = function (sql, values) {
      try { return raw(sql, values).catch(e => { if (e && !e.sql) e.sql = sql; throw e; }); }
      catch (e) { if (e && !e.sql) e.sql = sql; throw e; }
    };
    pool.query('SELECT ?').catch(e => {
      console.log(e.sql ? 'SQL-ATTACHED:' + e.sql : 'NO-SQL');
      process.exit(0);
    });
  `);
  check(/SQL-ATTACHED:SELECT \?/.test(r.out),
        'the wrapper pattern attaches SQL on the async rejection path',
        r.out.slice(-200));
}

console.log('\n' + (fails
  ? 'gate_process_safety: FAILED ' + fails + ' of ' + checks
  : 'gate_process_safety: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
