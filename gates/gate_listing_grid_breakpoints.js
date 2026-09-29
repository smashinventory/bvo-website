'use strict';
/* Gate: the collection grid resolves to ONE column on phones — and stays
 * that way.  2026-09-29
 *
 * ── WHY THIS GATE EXISTS, AND WHY IT IS NOT A TEXT MATCH ──────────────
 *
 * This bug has now shipped twice.
 *
 *   16 Jul 2026, commit 7f292fb "Bug 3: fix listing-grid mobile
 *   breakpoint" — the whole diff was one line, adding
 *   `.listing-grid{grid-template-columns:1fr}` to the max-width:480px
 *   block. Correct at the time.
 *
 *   Later, a `@media (max-width:1024px){.listing-grid{repeat(2,1fr)}}`
 *   rule was added FURTHER DOWN THE SAME FILE. Both match at 375px, both
 *   have specificity (0,1,0), so the cascade falls back to file order and
 *   the later one wins. The July fix was silently undone. Nobody edited
 *   it; nobody had to.
 *
 * So a gate asserting "the 1fr rule is present" would have PASSED that
 * whole time, while every phone rendered two clipped columns. Presence of
 * a rule proves nothing when another rule can outrank it by position.
 *
 * This gate therefore does not look for text. It parses every rule that
 * sets .listing-grid's columns, with its media range, and asserts the
 * OUTCOME at each width — plus the structural property that makes the
 * outcome stable:
 *
 *   THE BANDS MUST NOT OVERLAP.
 *
 * Non-overlapping bands mean exactly one rule can ever match a given
 * width, which makes file order irrelevant. That is the invariant. A new
 * conflicting rule added anywhere, in any file, at any position, breaks
 * the overlap check immediately — which is the only thing that makes
 * "never again" true rather than hopeful.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

/* Only this file is <link>ed; site.css is the source it is built from.
   Both are checked, because fixing one and not the other is how the bug
   comes back on the next rebuild. */
const FILES = ['public/css/site.css', 'public/css/site-bundle.css'];

const MIN_W = 320, MAX_W = 1600;

/* ── parse: every .listing-grid column rule, with its width range ───── */
/* Every rule is recorded with its ABSOLUTE OFFSET in the file, and the
   list is sorted by it.
   The first version of this gate collected all media rules first and the
   unbounded base rule last, then treated array position as cascade order.
   That made the base rule win at every width and the gate reported three
   columns on a phone while the CSS was in fact correct — a false alarm
   that would have had me "fix" working stylesheets. Cascade order is
   FILE order; anything else is a different question being answered. */
function columnRules(src) {
  const out = [];

  const collect = (text, cond, base) => {
    const re = /([^{}]*\.listing-grid[^{}]*)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const decl = /grid-template-columns\s*:\s*([^;}]+)/.exec(m[2]);
      if (!decl) continue;
      /* Guard against matching a DESCENDANT selector such as
         ".listing-grid > *" or ".listing-grid .foo" — those are different
         elements and must not be read as the grid's own columns. */
      const sels = m[1].split(',').map(s => s.trim());
      if (!sels.some(s => s === '.listing-grid')) continue;
      out.push({ cond, value: decl[1].trim(), at: base + m.index, ...parseRange(cond) });
    }
  };

  /* media blocks, brace-matched so nested rules do not truncate the body */
  const mre = /@media([^{]*)\{/g;
  let m;
  while ((m = mre.exec(src)) !== null) {
    const bodyStart = m.index + m[0].length;
    let i = bodyStart, d = 1;
    while (i < src.length && d > 0) {
      if (src[i] === '{') d += 1;
      else if (src[i] === '}') d -= 1;
      i += 1;
    }
    collect(src.slice(bodyStart, i - 1), m[1].trim(), bodyStart);
  }

  /* Top level. Media blocks are blanked rather than deleted, so every
     surviving rule keeps its true offset — deleting them would shift
     everything after and scramble the ordering this whole gate rests on. */
  const flat = src.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g,
                           s => ' '.repeat(s.length));
  collect(flat, '(none)', 0);

  return out.sort((a, b) => a.at - b.at);
}

function parseRange(cond) {
  if (cond === '(none)') return { min: 0, max: Infinity };
  const min = /min-width\s*:\s*(\d+)px/.exec(cond);
  const max = /max-width\s*:\s*(\d+)px/.exec(cond);
  return { min: min ? +min[1] : 0, max: max ? +max[1] : Infinity };
}

const cols = v => {
  const r = /repeat\(\s*(\d+)/.exec(v);
  if (r) return +r[1];
  return v.trim().split(/\s+/).length;   // "1fr" -> 1
};

/* The width bands the site is meant to have. Change THIS, not the CSS,
   if the design changes — the gate is the specification. */
const EXPECTED = w => (w <= 600 ? 1 : w <= 1024 ? 2 : 3);

for (const file of FILES) {
  console.log(`\n--- ${file} ---`);
  const rules = columnRules(read(file));

  ok('the grid declares its columns at all', rules.length >= 2,
     'nothing sets .listing-grid columns — the parser or the file changed shape');

  /* ═══ THE INVARIANT ═══════════════════════════════════════════════
     Non-overlapping bands. With no overlap, exactly one rule matches a
     width and FILE ORDER CANNOT DECIDE ANYTHING. This is the check that
     would have caught the 2026-07 regression the day it landed. */
  const media = rules.filter(r => r.cond !== '(none)');
  let overlaps = [];
  for (let i = 0; i < media.length; i++) {
    for (let j = i + 1; j < media.length; j++) {
      const a = media[i], b = media[j];
      if (a.min <= b.max && b.min <= a.max) overlaps.push(`${a.cond}  ><  ${b.cond}`);
    }
  }
  ok('no two media bands overlap', overlaps.length === 0,
     'overlapping bands resolve by FILE ORDER, so the next rule added below wins: ' +
     overlaps.join(' | '));

  /* The unbounded base rule overlaps every band by definition, so it is
     the ONE rule whose position still matters: it only works as a base
     while it sits ABOVE the bands. Assert both facts. */
  const base = rules.filter(r => r.cond === '(none)');
  ok('exactly one unbounded base rule', base.length === 1,
     `found ${base.length}; two base rules are decided by file order`);
  ok('the base rule sits above every band',
     base.length === 1 && media.every(r => r.at > base[0].at),
     'an unbounded rule BELOW a band overrides it at every width — this is the exact ' +
     'shape of the 2026-07 regression');

  /* ═══ THE OUTCOME, width by width ═════════════════════════════════
     Simulates the cascade: among matching rules, last one wins. If the
     bands really do not overlap this is unambiguous — but it is computed
     the same way the browser would, so it stays honest even if they do. */
  const resolve = w => {
    const matching = rules.filter(r => w >= r.min && w <= r.max);
    if (!matching.length) return null;
    return cols(matching[matching.length - 1].value);
  };

  const wrong = [];
  for (let w = MIN_W; w <= MAX_W; w += 1) {
    const got = resolve(w), want = EXPECTED(w);
    if (got !== want) wrong.push(`${w}px: got ${got}, want ${want}`);
  }
  ok(`every width ${MIN_W}-${MAX_W}px resolves to the intended column count`,
     wrong.length === 0,
     wrong.slice(0, 5).join(' | ') + (wrong.length > 5 ? ` (+${wrong.length - 5} more)` : ''));

  /* Named phone widths, called out so a failure reads as a device. */
  for (const [name, w] of [['iPhone SE', 375], ['iPhone 15', 393],
                           ['Pixel 8 Pro', 412], ['iPhone Pro Max', 430],
                           ['phablet', 600]]) {
    ok(`  ${name} (${w}px) is ONE column`, resolve(w) === 1,
       `renders ${resolve(w)} columns — cards clip at this width`);
  }
  ok('  small tablet (768px) is two columns', resolve(768) === 2, 'band shifted');
  ok('  desktop (1280px) is three columns', resolve(1280) === 3, 'band shifted');
}

/* ═══ SOURCE AND BUNDLE MUST AGREE ═══════════════════════════════════
   Only site-bundle.css is <link>ed, but site.css is what a rebuild reads.
   Fixing one and not the other puts the bug back on the next rebuild —
   and it would come back silently, exactly like last time. */
console.log('\n--- source and bundle agree ---');
{
  const A = columnRules(read(FILES[0]));
  const B = columnRules(read(FILES[1]));
  const res = (rules, w) => {
    const m = rules.filter(r => w >= r.min && w <= r.max);
    return m.length ? cols(m[m.length - 1].value) : null;
  };
  const diff = [];
  for (let w = MIN_W; w <= MAX_W; w += 1) {
    if (res(A, w) !== res(B, w)) diff.push(w);
  }
  ok('site.css and site-bundle.css resolve identically at every width',
     diff.length === 0,
     `diverge at ${diff.length} widths starting ${diff[0]}px — a rebuild would change the layout`);
}

/* ═══ CACHE ══════════════════════════════════════════════════════════ */
console.log('\n--- the browser gets the new stylesheet ---');
{
  const layout = read('views/layouts/main.ejs');
  const m = /site-bundle\.css\?v=(\d+)/.exec(layout);
  ok('site-bundle.css is cache-busted past v=19', m && +m[1] >= 20,
     `at v=${m ? m[1] : '?'} — .htaccess sets long cache headers, so returning visitors keep two columns`);
}

/* ═══ ADVISORY — not a failure ═══════════════════════════════════════
   Other grids have the same overlapping-band shape. They happen to
   resolve correctly today purely because of file order, which is the
   same loaded gun. Reported so the blast radius is visible; NOT failed,
   because fixing them was explicitly left out of this pass. */
console.log('\n--- advisory: other grids with order-dependent bands ---');
{
  const src = read(FILES[1]);
  for (const cls of ['product-grid', 'category-grid', 'footer-grid']) {
    const ranges = [];
    const mre = /@media([^{]*)\{/g;
    let m;
    while ((m = mre.exec(src)) !== null) {
      let i = m.index + m[0].length, d = 1;
      while (i < src.length && d > 0) {
        if (src[i] === '{') d += 1; else if (src[i] === '}') d -= 1;
        i += 1;
      }
      const body = src.slice(m.index + m[0].length, i - 1);
      if (new RegExp(`\\.${cls}[^{}]*\\{[^}]*grid-template-columns`).test(body)) {
        ranges.push({ cond: m[1].trim(), ...parseRange(m[1].trim()) });
      }
    }
    let overlap = 0;
    for (let i = 0; i < ranges.length; i++)
      for (let j = i + 1; j < ranges.length; j++)
        if (ranges[i].min <= ranges[j].max && ranges[j].min <= ranges[i].max) overlap += 1;
    console.log(`  note   .${cls}: ${ranges.length} media rules, ${overlap} overlapping pair(s)` +
                (overlap ? '  <- resolves by file order, same failure mode' : ''));
  }
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
