'use strict';

/**
 * searchQuery.js — one definition of "what does this search box do".
 * ====================================================================
 *
 * Named searchQuery rather than productSearch because the orders list
 * uses it too, against a completely different table.
 *
 * WHAT IT REPLACES
 * ----------------
 * Three search bars, two different bugs, same root cause: the typed
 * string was never split into words.
 *
 *   admin products   `p.name LIKE '%Brittany white%'`
 *   admin orders     `CONCAT(first," ",last) LIKE '%Smith John%'`
 *
 * Both demand that the entire query appear as ONE contiguous run of
 * characters. 'Brittany white' does not match
 * 'Brittany 36" Single Vanity in Bright White' -- the words are 20
 * characters apart. 'Smith John' never matches a CONCAT that produces
 * 'John Smith'. Adding a word, or typing words out of order, returns
 * nothing.
 *
 *   storefront       `MATCH(name, short_desc, brand) AGAINST('x*' IN BOOLEAN MODE)`
 *
 * Different failure. In BOOLEAN MODE without a leading '+', every term
 * is OPTIONAL, so adding a word WIDENS the result set. And the `*` was
 * appended to the whole string, so only the last word got prefix
 * matching.
 *
 * WHY LIKE AND NOT FULLTEXT
 * -------------------------
 * InnoDB's innodb_ft_min_token_size defaults to 3: tokens shorter than
 * three characters are never written to the FULLTEXT index. Vanity
 * widths -- 24, 30, 36, 42, 48, 54, 60, 66, 72 -- are all two
 * characters, so NONE of them are in idx_fulltext_search. Searching
 * 'Brittany 36' returned every Brittany because the 36 did not exist to
 * match, not because the query was written badly.
 *
 * Fixing that needs innodb_ft_min_token_size=2 in my.cnf, a MySQL
 * restart and an index rebuild -- none of which are available on
 * managed hosting. LIKE has no minimum token length, so it sees the
 * sizes. That is the whole reason for this file.
 *
 * The cost is a table scan (a leading % cannot use an index) and no
 * typo tolerance. At the current catalogue size that scan is a few
 * milliseconds. Revisit around 100k products, or if typo tolerance
 * becomes a requirement -- that needs a real search engine and this
 * file will never provide it.
 *
 * ────────────────────────────────────────────────────────────────────
 * PARAMETER ORDER -- THE ONE WAY TO GET THIS WRONG
 * ────────────────────────────────────────────────────────────────────
 * `score` goes in the SELECT list and `sql` goes in the WHERE clause.
 * SELECT is parsed first, so its placeholders bind first:
 *
 *     `SELECT ..., ${s.score} AS relevance FROM t WHERE ${s.sql}`
 *     [ ...s.scoreParams, ...s.params ]        // score FIRST. always.
 *
 * Reverse them and nothing throws -- the counts still line up, the
 * query still runs, and it silently searches for the wrong strings.
 * The push script executes this ordering rather than grepping for it.
 *
 * A COUNT query has no SELECT list, so it takes `params` only.
 *
 * Reference `relevance` in ORDER BY (allowed -- aliases resolve there)
 * but never in WHERE (not allowed -- WHERE is evaluated before the
 * SELECT list exists).
 */

/** Words beyond this are ignored. A pasted paragraph would otherwise
 *  build one OR-group per word with no upper bound. */
const MAX_WORDS = 8;

/**
 * `%` and `_` are LIKE wildcards. Unescaped, a search for "50%" matches
 * everything containing "50", and a query of "%%%%%" forces the engine
 * through pathological backtracking. Backslash is escaped first so it
 * cannot double-escape the characters added after it.
 *
 * No ESCAPE clause is emitted: backslash is LIKE's default escape
 * character, and because these travel as bound parameters they are
 * never re-parsed as SQL string literals, so sql_mode
 * (NO_BACKSLASH_ESCAPES) cannot change their meaning.
 */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, ch => '\\' + ch);
}

function splitWords(query, maxWords) {
  return String(query || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords);
}

/**
 * @param {string} query  raw text from the search box
 * @param {object} opts
 *   columns  {string[]} SQL expressions to match against. Any valid
 *                       expression, not just column names -- the orders
 *                       list passes CONCAT(first," ",last).
 *   weights  {object}   points per column for a per-word hit, keyed by
 *                       the same expression string. Default 1.
 *   exact    {string[]} expressions worth 100 on an exact whole-query
 *                       match (SKU, order number).
 *   prefix   {string}   expression worth 50 when it STARTS WITH the
 *                       whole query.
 *   phrase   {string}   expression worth 20 when it CONTAINS the whole
 *                       query contiguously. Defaults to `prefix`, so a
 *                       phrase hit outranks scattered words.
 *   boosts   {Array<{expr:string, points:number}>}
 *                       tiebreakers, NOT filters -- an out-of-stock
 *                       product still appears, just lower. Caller owns
 *                       any JOIN these depend on.
 *   maxWords {number}
 *
 * @returns {{active:boolean, sql:string, params:Array,
 *            score:string, scoreParams:Array, words:string[]}}
 *   `active:false` means there is nothing to search for -- callers must
 *   skip the clause entirely rather than emitting an empty string into
 *   a WHERE.
 */
function buildSearch(query, opts = {}) {
  const columns  = Array.isArray(opts.columns) ? opts.columns : [];
  const weights  = opts.weights  || {};
  const exact    = Array.isArray(opts.exact)  ? opts.exact  : [];
  const boosts   = Array.isArray(opts.boosts) ? opts.boosts : [];
  const prefix   = opts.prefix || null;
  const phrase   = opts.phrase !== undefined ? opts.phrase : prefix;
  const maxWords = opts.maxWords || MAX_WORDS;

  const raw   = String(query || '').trim();
  const words = splitWords(raw, maxWords);

  const inactive = {
    active: false, sql: '', params: [],
    score: '0', scoreParams: [], words: [],
  };
  if (!raw || !words.length || !columns.length) return inactive;

  /* ── WHERE ────────────────────────────────────────────────────────
     Every word must appear in at least one column (AND across words,
     OR across columns). AND across words is what makes each extra word
     NARROW the results -- the opposite of the FULLTEXT behaviour it
     replaces. OR across columns is what lets 'Brittany 655' match a
     name and a SKU at the same time. */
  const sqlParts = [];
  const params   = [];
  for (const word of words) {
    sqlParts.push('(' + columns.map(c => `${c} LIKE ?`).join(' OR ') + ')');
    const like = `%${escapeLike(word)}%`;
    for (let i = 0; i < columns.length; i++) params.push(like);
  }

  /* ── SCORE ────────────────────────────────────────────────────────
     Summed CASE expressions. Deliberately readable arithmetic rather
     than an opaque engine score: when a result ranks oddly you can
     work out why from this file alone. */
  const scoreParts  = [];
  const scoreParams = [];

  for (const col of exact) {
    scoreParts.push(`(CASE WHEN ${col} = ? THEN 100 ELSE 0 END)`);
    scoreParams.push(raw);
  }
  if (prefix) {
    scoreParts.push(`(CASE WHEN ${prefix} LIKE ? THEN 50 ELSE 0 END)`);
    scoreParams.push(`${escapeLike(raw)}%`);
  }
  if (phrase) {
    scoreParts.push(`(CASE WHEN ${phrase} LIKE ? THEN 20 ELSE 0 END)`);
    scoreParams.push(`%${escapeLike(raw)}%`);
  }
  for (const word of words) {
    const like = `%${escapeLike(word)}%`;
    for (const col of columns) {
      const pts = Number(weights[col] != null ? weights[col] : 1);
      if (!pts) continue;
      scoreParts.push(`(CASE WHEN ${col} LIKE ? THEN ${pts} ELSE 0 END)`);
      scoreParams.push(like);
    }
  }
  for (const b of boosts) {
    if (!b || !b.expr) continue;
    scoreParts.push(`(CASE WHEN ${b.expr} THEN ${Number(b.points) || 0} ELSE 0 END)`);
  }

  return {
    active: true,
    sql:    sqlParts.join(' AND '),
    params,
    score:  '(' + (scoreParts.length ? scoreParts.join(' + ') : '0') + ')',
    scoreParams,
    words,
  };
}

module.exports = { buildSearch, escapeLike, splitWords, MAX_WORDS };
