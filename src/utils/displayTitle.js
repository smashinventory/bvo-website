'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
 * DISPLAY TITLE — the shortened heading shown on a product page.
 *
 * Pure functions. REQUIRES NOTHING — no database, no settings, no services.
 * Same reason as src/config/stockNotify.js: a rule a gate cannot load is a
 * rule the gate has to re-implement, and then the two drift apart.
 *
 * ── WHAT THIS IS, AND WHAT IT IS NOT ──────────────────────────────────────
 *
 * The product name in the database stays the source of truth and is NOT
 * modified. This computes a shorter string, at render time, for ONE place:
 * the visible <h1>. The page title, meta description, Product JSON-LD,
 * breadcrumb trail and every collection card keep the full name, so search
 * listings are unaffected.
 *
 * Computing rather than storing is deliberate. A `display_title` column
 * would mean 6,400 rows to write and 6,400 rows to fix if the rule turns
 * out wrong. This way a bad rule is one function to correct and every page
 * is right on the next request, with nothing to migrate or undo.
 *
 * ── THE TRANSFORM ─────────────────────────────────────────────────────────
 *
 *   Bristol 30" Single Vanity, Bright White w/ Single Hole 3 CM White Zeus
 *   Silestone Top & Backsplash
 *     becomes
 *   Bristol 30" Single Vanity — Bright White w/ White Zeus Silestone Top
 *
 * Dropped: "Single Hole", "3 CM", "& Backsplash". Each is a real attribute
 * and each already appears in the specifications table further down the
 * page. None of them is what a shopper scans a heading for.
 *
 * ⚠️ JAMES MARTIN VANITIES ONLY. Owner decision. Their naming follows a
 * consistent pattern; faucets, mirrors and accessories do not, and a rule
 * tuned on vanity names produces nonsense on a towel bar. Anything outside
 * that scope is returned untouched.
 *
 * ⚠️ EVERY RULE HERE IS A DELETION, NEVER A REWRITE. The function only ever
 * removes known noise tokens and swaps the first comma for a dash. It never
 * reorders words, never abbreviates, never invents. That is what makes a
 * wrong output merely clumsy instead of false — the worst case is a title
 * that reads awkwardly, not one that describes a different product.
 * ═══════════════════════════════════════════════════════════════════════════ */

/* The brand whose naming this rule was written against. Compared
   case-insensitively and trimmed, because feed data is not tidy. */
const SCOPED_BRAND = 'james martin vanities';

/* Product types the rule applies to. A James Martin MIRROR is still out of
   scope — the pattern is a vanity pattern. Empty/unknown type is excluded
   rather than guessed at. */
const SCOPED_TYPES = [
  'single sink vanity with top',
  'double sink vanity with top',
  'single sink cabinet only',
  'double sink cabinet only',
];

/* Noise removed from the heading, in order. Each is anchored so it cannot
   eat part of a word: "3 CM" must not match inside "3 CMX". */
/* ⚠️ THE BACKSPLASH AND HOLE PATTERNS ARE WIDER THAN THEY LOOK, AND HAVE TO
   BE. The first versions matched only "& Backsplash" and "Single Hole" /
   "Double Hole". Run against the real catalogue that left 32 titles
   carrying the noise, because the feed uses several spellings for the
   same attribute:

     ... Silestone Top & Backsplash
     ... Silestone Top & Matching Backsplash
     ... Silestone Top and Matching Backsplash
     ... w/ Hole 3 CM ...            ← no Single/Double at all

   Both are still pure deletions and both are anchored on \b, so widening
   them cannot reach into a neighbouring word. */
const STRIP = [
  { re: /\s*(?:&|and)\s*(?:Matching\s+)?Backsplash\b/gi,
                                        why: 'in the specs table' },
  { re: /\b(?:Single |Double |No )?Hole\s+/gi,
                                        why: 'faucet drilling, in the specs table' },
  { re: /\b\d+(?:\.\d+)?\s*CM\s+/gi,    why: 'countertop thickness, in the specs table' },
  { re: /\s+w\/\s+w\/\s+/gi,            why: 'a doubled w/ left by the removals above' },
];

function isScoped(brand, productType) {
  if (String(brand || '').trim().toLowerCase() !== SCOPED_BRAND) return false;
  return SCOPED_TYPES.indexOf(String(productType || '').trim().toLowerCase()) !== -1;
}

/**
 * @param {string} name         the full product name, straight from the DB
 * @param {object} [product]    { brand, product_type } — scope check
 * @returns {string}            the heading to display; the input unchanged
 *                              whenever the rule does not apply or the
 *                              result fails a safety check
 */
function displayTitle(name, product) {
  const full = String(name || '').trim();
  if (!full) return full;

  const p = product || {};
  if (!isScoped(p.brand, p.product_type)) return full;

  let out = full;

  /* ⚠️ THE GROWTH BUDGET. Two of the changes below ADD a character rather
     than remove one: the comma-to-dash swap (", " → " — ") and restoring
     a missing space after "w/". Everything else only deletes.

     The safety net rejects any result longer than its input, because that
     means a replacement misfired. But these two are known, intended
     growth, so each one has to buy itself a character of headroom —
     otherwise the net discards perfectly good titles. A fixed tolerance
     was tried first and was the wrong shape: +1 covered the dash, then a
     title that got the dash AND a restored space grew by two and was
     thrown away. Counting what was actually applied is exact, and leaves
     no slack for a genuine misfire to hide in. */
  let budget = 0;

  /* The first comma becomes a dash: "Bristol 30" Single Vanity, Bright
     White" reads as one phrase rather than a list. Only the first — later
     commas usually separate genuinely listed attributes. */
  if (out.indexOf(',') !== -1) budget += 1;
  out = out.replace(',', ' —');

  for (const rule of STRIP) out = out.replace(rule.re, ' ');

  /* ⚠️ A SUBSTITUTION, NOT A STRIP, AND THE DIFFERENCE MATTERS. Some names
     carry a second comma before the connector — "Coastal Driftwood, w/ 3 CM
     ...". Once the first comma is a dash, that one reads as a stray. Written
     as a STRIP rule it removed the connector too, turning the Gracyn title
     into "Coastal Driftwood White Zeus Quartz Top" — two phrases run
     together with nothing joining them. Every STRIP rule replaces its match
     with a space; anything that must KEEP part of what it matched has to be
     a replace with a capture, here. */
  out = out.replace(/,\s+(w\/|with)\s+/gi, ' $1 ');

  /* Whitespace only, same class of change as collapsing doubled spaces
     below. The feed writes "w/Single Hole" with no space after the slash
     on some SKUs; removing "Single Hole " then closes the gap and leaves
     "w/White Zeus Silestone Top". No word is altered — a space is put
     back where the source never had one. */
  budget += (out.match(/\bw\/(?=[A-Za-z0-9])/g) || []).length;
  out = out.replace(/\bw\/(?=[A-Za-z0-9])/g, 'w/ ');

  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();
  /* A removal at the very end can leave a dangling connector. */
  out = out.replace(/\s+(w\/|with|&|and|—|-)$/i, '').trim();

  return isSafe(out, full, budget) ? out : full;
}

/* ── THE SAFETY NET ────────────────────────────────────────────────────────
 * A rule applied to 6,400 names will meet names it was not written for. Any
 * result that looks damaged is discarded in favour of the original: a long
 * title is a cosmetic problem, a mangled one is a credibility problem.
 */
/**
 * @param {string} out     the computed heading
 * @param {string} full    the original name
 * @param {number} [budget] characters the known ADDING substitutions were
 *                          entitled to add — see "THE GROWTH BUDGET"
 *                          above. Defaults to 0, so calling isSafe without
 *                          it keeps the strict original behaviour.
 */
function isSafe(out, full, budget) {
  if (!out) return false;
  /* ⚠️ THE ALLOWANCE IS EARNED, NOT ASSUMED. "Bright White, Glossy" becomes
     "Bright White — Glossy": ", " is two characters, " — " is three, so the
     comma swap alone comes out one character longer than it went in.

     At zero tolerance that tripped this check and ~350 titles — every JM
     vanity with no noise token to remove — silently fell back to the full
     name and kept their comma while longer titles got the dash. A flat +1
     fixed those and then broke a title that got the dash AND a restored
     "w/" space: two characters of growth, discarded. So the caller counts
     what it actually applied and pays for exactly that. Anything beyond
     the budget is still a misfire and still gets thrown away. */
  if (out.length > full.length + (budget || 0)) return false;
  /* Never so short that the product is no longer identifiable. Below this
     we are not shortening, we are deleting. */
  if (out.length < 12) return false;
  /* The model name is the first word or two and must survive. */
  const firstWord = full.split(/[\s,]+/)[0];
  if (firstWord && out.indexOf(firstWord) !== 0) return false;
  return true;
}

module.exports = { displayTitle, isScoped, SCOPED_BRAND, SCOPED_TYPES, STRIP, isSafe };
