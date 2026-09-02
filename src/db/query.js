/* ═══════════════════════════════════════════════════════════════════
   src/db/query.js — database helpers that never fail silently

   WHY THIS EXISTS
   ───────────────
   Six controllers had independently grown the same helper:

       function safeQuery(sql, params) {
         return bvoPool.query(sql, params).then(([r]) => r).catch(() => []);
       }

   That `.catch(() => [])` swallows EVERY database error with no log and no
   signal. The caller cannot distinguish "the query ran and matched nothing"
   from "the query blew up". Both look like an empty list.

   This is not theoretical. It has cost us twice in two days:

   1. BOL ATE34769194 — a shipment booked successfully at WWEX while the
      local INSERT failed on a missing column. The error vanished, execution
      continued, and the UI reported "Shipment Booked". Freight existed at
      the carrier with no record on our side: no BOL stored, nothing to void
      or track.

   2. Order BVO-20260004 — booking's `UPDATE orders SET status='shipped'`
      went through the same swallow. The order silently stayed on
      'confirmed' while carrying live freight, and the Ship button stayed
      lit next to it, one click from booking the same order twice.

   Both were found by accident, days later. That is the real cost: the
   failure is not just unreported, it is unreportABLE, because by the time
   anyone notices the symptom the error is long gone.

   WHAT CHANGED
   ────────────
   The read helpers still RESOLVE rather than throw — most callers are page
   loads that should degrade to an empty section rather than 500 the whole
   view. But nothing is silent any more: every failure logs the driver error
   code, the message, and a truncated copy of the SQL, tagged with the
   calling module so it is greppable.

   For anything that MUST NOT fail quietly — writes, deletes, status
   changes — use mustQuery(), which throws.

   USAGE
   ─────
     const { safeQuery, safeQueryOne, mustQuery } = require('../db/query')('orders');

   The tag is the log prefix: [orders] safeQuery FAILED: ER_BAD_FIELD_ERROR ...
   ═══════════════════════════════════════════════════════════════════ */

const { bvoPool } = require('../config/database');

/** Collapse whitespace and truncate — enough SQL to identify the query
 *  in a log without dumping a 40-line statement. */
function _sqlSnippet(sql) {
  return String(sql).replace(/\s+/g, ' ').trim().slice(0, 200);
}

function _log(tag, fn, err, sql) {
  console.error(`[${tag}] ${fn} FAILED:`, err.code || '', err.sqlMessage || err.message);
  console.error(`[${tag}]   sql:`, _sqlSnippet(sql));
}

module.exports = function makeQueryHelpers(tag = 'db') {
  /** Rows, or [] on failure. Logs loudly. Use for read paths that should
   *  degrade gracefully rather than break the page. */
  function safeQuery(sql, params = []) {
    return bvoPool.query(sql, params)
      .then(([rows]) => rows)
      .catch(err => { _log(tag, 'safeQuery', err, sql); return []; });
  }

  /** First row, or null on failure or no match. Logs loudly.
   *  NOTE: null is ambiguous by design — it means "nothing usable here".
   *  If the difference between "absent" and "broken" matters to the
   *  caller, use mustQuery instead. */
  function safeQueryOne(sql, params = []) {
    return bvoPool.query(sql, params)
      .then(([rows]) => rows[0] || null)
      .catch(err => { _log(tag, 'safeQueryOne', err, sql); return null; });
  }

  /** Throws on failure. Use for every write whose success is reported to
   *  the user. A flash message saying "Deleted." after a swallowed DELETE
   *  is worse than an error page — the operator believes the work is done. */
  function mustQuery(sql, params = []) {
    return bvoPool.query(sql, params).then(([rows]) => rows);
  }

  /** Write helper for the common "did that actually change anything?" case.
   *  Throws on error AND on a zero-row match, which is the failure mode a
   *  plain try/catch misses entirely: the query is valid, runs fine, and
   *  updates nothing because the id does not exist. */
  async function mustAffect(sql, params = [], what = 'record') {
    const res = await bvoPool.query(sql, params).then(([r]) => r);
    if (!res || res.affectedRows === 0) {
      const e = new Error(`No ${what} was updated — nothing matched.`);
      e.code = 'NO_ROWS_AFFECTED';
      console.error(`[${tag}] mustAffect matched 0 rows:`, _sqlSnippet(sql));
      throw e;
    }
    return res;
  }

  return { safeQuery, safeQueryOne, mustQuery, mustAffect };
};
