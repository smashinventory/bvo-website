#!/usr/bin/env node
'use strict';

/**
 * gate_wc_inventory.js — invariants for the WC Inventory Analysis section.
 *
 * RUNS WITHOUT A DATABASE, ON PURPOSE.
 * OPEN_ITEMS #407 is gate_orders_visibility.js dying when DB_PASS is absent,
 * which makes it useless in exactly the situation a gate is for. Everything
 * here is either pure logic or a static read of the source, so it runs on a
 * laptop, in CI, and on a server with no .env. The one require() that would
 * otherwise pull in the DB pool is given a dummy password and never connects.
 *
 * WHAT IT PROTECTS, and why each one is worth a gate:
 *
 *  1. THE 3.8–6.0x HAZARD. WC publishes one cabinet as many SKUs against one
 *     stock pool. If the dedupe key stops being base_sku, every figure on the
 *     dashboard silently inflates by 4–6x and still looks plausible. This is
 *     the single most expensive thing that can break here.
 *
 *  2. NO PRICING. Units only (Sam, 2026-11-24). A price column added later
 *     re-opens the entire class of problem that dominated the JMV build.
 *
 *  3. SCHEMA DRIFT. The feed changed format once, on 2024-07-09. A parser that
 *     silently stops recognising one era yields empty snapshots, not errors.
 *
 *  4. SNAPSHOT DIR RESOLUTION. Unzipping through a web file manager drops
 *     files into a wrapper folder. The fallback must never prefer a stale
 *     nested copy over a real top-level one.
 *
 *  5. CSP. The admin layout forbids inline handlers; one breaks the page.
 *
 * Exit 0 = all pass. Exit 1 = at least one failure, with the reason.
 */

process.env.DB_PASS = process.env.DB_PASS || 'gate-dummy-never-connects';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
const pass = m => console.log(`  PASS  ${m}`);
const fail = (m, detail) => { failures++; console.log(`  FAIL  ${m}${detail ? `\n          ${detail}` : ''}`); };
const section = t => console.log(`\n${t}`);

const JOB        = 'src/jobs/wcMovementRollup.js';
const CONTROLLER = 'src/controllers/wcReportsController.js';
const VIEW       = 'views/pages/admin/marketing/wc-inventory-analysis.ejs';
const MIGRATION  = 'database/migrations/030_wc_inventory_analysis.sql';
const ROUTES     = 'src/routes/admin.js';
const NAV        = 'views/layouts/admin.ejs';

/* ── 1. THE DEDUPE ────────────────────────────────────────────────── */
section('1. Option-config dedupe (the 3.8–6.0x hazard)');
{
  const ctrl = read(CONTROLLER);

  if (/GROUP BY\s+m\.movement_date,\s*d\.base_sku/i.test(ctrl)) {
    pass('DEDUPED_BASE groups by (movement_date, base_sku)');
  } else {
    fail('DEDUPED_BASE must GROUP BY (m.movement_date, d.base_sku)',
         'Without this the per-config rows are not collapsed and every figure inflates 4–6x.');
  }

  if (/MAX\(m\.demand_min\)/i.test(ctrl)) {
    pass('drawdown taken as MAX(m.demand_min)');
  } else {
    fail('DEDUPED_BASE must take MAX(m.demand_min), never SUM');
  }

  /* The specific catastrophe: SUM over the raw movement table. */
  if (/SUM\(\s*m\.demand_min\s*\)/i.test(ctrl)) {
    fail('found SUM(m.demand_min) — summing raw per-config rows',
         'Configs share one stock pool. Sum the deduped base rows, never the raw ones.');
  } else {
    pass('no SUM over raw per-config demand_min');
  }

  if (/m\.is_valid\s*=\s*1/.test(ctrl)) {
    pass('feed-gap exclusion present (is_valid = 1)');
  } else {
    fail('DEDUPED_BASE must filter is_valid = 1', 'Invalid days are missing, not zero demand.');
  }
}

/* ── 2. NO PRICING ────────────────────────────────────────────────── */
section('2. Units only — no pricing anywhere');
{
  /* Comments are allowed to say the word (they explain the rule). Code is not.
     Strip SQL/JS line comments and block comments before scanning. */
  const strip = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*(\/\/|--|\*).*$/gm, '');

  const PRICE = /\b(msrp|map_price|unit_price|revenue|wholesale_cost|compare_price)\b/i;

  for (const f of [JOB, CONTROLLER, MIGRATION]) {
    const body = strip(read(f));
    const hit  = body.match(PRICE);
    if (hit) fail(`${f} references "${hit[0]}" in code`,
                  'WC reports are units only. See WC_REPORTS_SPEC.md §1.');
    else     pass(`${f} — no price identifiers in code`);
  }

  if (/wc\/financials|wcCtrl\.getFinancials/.test(read(ROUTES))) {
    fail('a WC financials route exists', 'There is deliberately no financials route for WC.');
  } else {
    pass('no WC financials route');
  }
}

/* ── 3. SCHEMA DRIFT ──────────────────────────────────────────────── */
section('3. Dual-schema parser (feed flipped format on 2024-07-09)');
{
  const m = require(path.join(ROOT, JOB));

  const legacyHeader = ['Original Sku','New Sku','Maximum of Stock','Maximum of Available Date'];
  const modernHeader = ['SKU','Available Qty','Available Date'];

  if (m.detectSchema(legacyHeader) === 'legacy') pass('legacy header detected');
  else fail('legacy header not detected', JSON.stringify(legacyHeader));

  if (m.detectSchema(modernHeader) === 'modern') pass('modern header detected');
  else fail('modern header not detected', JSON.stringify(modernHeader));

  if (m.detectSchema(['something','else']) === null) pass('unknown header returns null (not silently parsed)');
  else fail('unknown header must return null, so the day is marked invalid rather than read as empty');

  /* Legacy must key on New Sku (col 1), not Original Sku (col 0). Keying on
     col 0 splits every SKU's history in half at the 2024-07-09 flip. */
  if (m.SCHEMA_COLS.legacy.sku === 1) pass('legacy keys on New Sku (col 1), preserving SKU continuity');
  else fail('legacy must key on column 1 (New Sku)',
            `found col ${m.SCHEMA_COLS.legacy.sku}; col 0 is the retired Original Sku format.`);
}

/* ── 4. SKU DECODE ────────────────────────────────────────────────── */
section('4. SKU decode — suffix is a bill of materials');
{
  const m = require(path.join(ROOT, JOB));
  const cases = [
    ['PY30CW03GG-000000000', 'PY30CW03GG', '000', '000000'],
    ['PY30CW03GG-A24TL1203', 'PY30CW03GG', 'A24', 'TL1203'],
  ];
  let ok = true;
  for (const [sku, base, mir, fau] of cases) {
    const r = m.parseSku(sku);
    if (!r || r.base !== base || r.mirror !== mir || r.faucet !== fau) {
      ok = false;
      fail(`parseSku("${sku}")`, `got ${JSON.stringify(r)}`);
    }
  }
  if (ok) pass('suffix splits into base / mirror / faucet');

  /* The collapse must actually happen: six configurations, one model. */
  const configs = [
    'PY30CW03GG-000000000','PY30CW03GG-A24000000','PY30CW03GG-P24000000',
    'PY30CW03GG-000TL1203','PY30CW03GG-A24TL1203','PY30CW03GG-P24TL1203',
  ];
  const bases = new Set(configs.map(s => m.parseSku(s).base));
  if (bases.size === 1) pass(`6 configurations collapse to ${bases.size} model`);
  else fail('configurations did not collapse to one base', `got ${bases.size} bases`);

  /* Malformed suffix: keep the base, do not invent option codes. */
  const odd = m.parseSku('AB30BL03GG-00000');
  if (odd && odd.base === 'AB30BL03GG' && odd.mirror === '' && odd.faucet === '') {
    pass('non-standard suffix keeps base, leaves option codes blank');
  } else {
    fail('non-standard suffix mishandled', JSON.stringify(odd));
  }
}

/* ── 5. SNAPSHOT DIR RESOLUTION ───────────────────────────────────── */
section('5. Snapshot directory resolution (zip wrapper folders)');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wcgate-'));
  const snaps = path.join(tmp, 'snapshots');
  const inner = path.join(snaps, 'wc_snapshots_flat');
  fs.mkdirSync(inner, { recursive: true });
  fs.writeFileSync(path.join(inner, 'wc_2026-11-23.csv'), 'SKU,Available Qty,Available Date\n');

  const loadFresh = () => {
    for (const k of Object.keys(require.cache)) delete require.cache[k];
    process.env.WC_SNAPSHOTS_PATH = snaps;
    const mod = require(path.join(ROOT, JOB));
    mod._resetResolvedDir();
    return mod;
  };

  if (path.basename(loadFresh().resolveSnapshotsDir()) === 'wc_snapshots_flat') {
    pass('falls back one level into a zip wrapper folder');
  } else {
    fail('did not find snapshots nested one level down');
  }

  fs.writeFileSync(path.join(snaps, 'wc_2025-01-01.csv'), 'SKU,Available Qty,Available Date\n');
  if (path.basename(loadFresh().resolveSnapshotsDir()) === 'snapshots') {
    pass('a real top-level copy always wins over a nested one');
  } else {
    fail('nested copy was preferred over top-level',
         'The fallback must never shadow the configured directory.');
  }

  fs.rmSync(tmp, { recursive: true, force: true });
}

/* ── 6. CSP + LAYOUT ──────────────────────────────────────────────── */
section('6. Admin view safety');
{
  const viewRaw = read(VIEW);

  /* Check what RENDERS, not what the file says.
     The first version of this gate searched the whole file, and the view's own
     header comment contains the phrase "not BVO sales, not RFL sales" as
     documentation. So the gate was satisfied by a comment: the user-visible
     source note could be deleted entirely and this still passed. The mutation
     harness caught it. Strip the leading EJS code/comment block first so these
     assertions only see markup. */
  const view = viewRaw.replace(/<%[^%]*?\/\*[\s\S]*?\*\/[\s\S]*?%>/g, '');

  if (/\son(click|change|submit|input|load)\s*=/i.test(view)) {
    fail('inline event handler found in the view', 'The admin CSP blocks inline handlers.');
  } else {
    pass('no inline event handlers');
  }

  if (/contentFor/.test(viewRaw)) {
    fail('the express-ejs-layouts script-block helper is present',
         'It wipes every <script> on the page — PROJECT_BRIEF §9.');
  } else {
    pass('script-block helper absent');
  }

  if (/nonce="<%=\s*cspNonce\s*%>"/.test(view)) pass('script tags carry the CSP nonce');
  else fail('script tags must carry nonce="<%= cspNonce %>"');

  if (/not BVO sales/i.test(view) && /not RFL sales/i.test(view)) {
    pass('source note present — "not BVO sales, not RFL sales"');
  } else {
    fail('view must state this is NOT our sales data',
         'A reader mistaking WC national shipments for our own draws the opposite conclusion.');
  }

  if (/observed drawdown/i.test(view)) pass('metric labelled "observed drawdown", not "units sold"');
  else fail('view must label the metric as observed drawdown (minimum demand)');

  if (/coverage/i.test(view)) pass('coverage disclosure present');
  else fail('view must surface attribute coverage', 'Colour/top describe ~22% of the catalogue.');
}

/* ── 7. WIRING ────────────────────────────────────────────────────── */
section('7. Route and nav wiring');
{
  const routes = read(ROUTES);
  const nav    = read(NAV);

  if (/router\.get\s*\(\s*'\/marketing\/wc'/.test(routes)) pass('dashboard route registered');
  else fail("GET '/marketing/wc' not registered");

  if (/router\.post\s*\(\s*'\/marketing\/wc\/run-rollup'/.test(routes)) pass('rollup route registered');
  else fail("POST '/marketing/wc/run-rollup' not registered");

  if (/\/admin\/marketing\/wc/.test(nav) && /WC Inventory Analysis/.test(nav)) {
    pass('nav entry present and linked');
  } else {
    fail('nav entry missing', 'An unreachable page is a page nobody uses.');
  }
}

/* ── 8. MIGRATION ─────────────────────────────────────────────────── */
section('8. Migration safety');
{
  const sql = read(MIGRATION);
  const tables = ['wc_snapshots','wc_snapshot_validity','wc_dimensions','wc_daily_movement'];

  for (const t of tables) {
    const re = new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\b`, 'i');
    if (re.test(sql)) pass(`${t} created with IF NOT EXISTS (re-runnable)`);
    else fail(`${t} missing or not guarded by IF NOT EXISTS`);
  }

  /* Count STATEMENTS, not mentions. The migration's own header warns
     "EVERY CREATE TABLE BELOW DECLARES COLLATE", and counting that comment
     as a fifth table made this gate report 4 of 5 on a correct file. A gate
     that cries wolf gets ignored, which is worse than not having it. */
  const sqlCode  = sql.replace(/^\s*--.*$/gm, '');
  const creates  = (sqlCode.match(/CREATE TABLE/gi) || []).length;
  const collates = (sqlCode.match(/COLLATE=utf8mb4_unicode_ci/gi) || []).length;
  if (creates > 0 && collates >= creates) {
    pass(`explicit COLLATE on all ${creates} tables`);
  } else {
    fail(`only ${collates} of ${creates} tables declare COLLATE`,
         'MariaDB 10.6 defaults to utf8mb4_uca1400_ai_ci and cross-table joins then fail.');
  }

  if (/\b(DROP TABLE|TRUNCATE|DELETE FROM)\b/i.test(sql.replace(/^\s*--.*$/gm, ''))) {
    fail('migration contains a destructive statement', 'This migration must be additive only.');
  } else {
    pass('migration is additive only — no DROP / TRUNCATE / DELETE');
  }
}

/* ── 9. PRODUCT SCOPE ─────────────────────────────────────────────── */
section('9. Product scope — the feed is not all vanities');
{
  const ctrl = require(path.join(ROOT, CONTROLLER));
  const job  = require(path.join(ROOT, JOB));

  if (ctrl.DEFAULT_SCOPE === 'vanity') {
    pass('default scope is vanities');
  } else {
    fail(`default scope is "${ctrl.DEFAULT_SCOPE}", expected "vanity"`,
         'A third of the feed is faucets and accessories; defaulting to all of it reports a number nobody asked for.');
  }

  /* Classifier: each family must be recognised, and an unknown shape must
     return null rather than be guessed into vanity. */
  const cases = [
    ['AB30CW03RS-000TL1203', 'vanity'],
    ['CH24CW03GK-000000000', 'vanity'],
    ['F1-0003-01-AL',        'faucet'],
    ['F5-0011-01',           'faucet'],        // kitchen faucet, no finish code
    ['CF511-AS-3022A',       'kitchen_sink'],
    ['SS-U-1520A',           'kitchen_sink'],
    ['SSSG-AD-3322B-16',     'kitchen_sink'],
    ['EB30A-0100',           'washstand'],
    ['BA-0006-02',           'accessory'],
    ['MADISON-LC-E',         'cabinet'],
    ['EMPIRE-M-1824-01',     'mirror'],
    ['CTAB2727BLGG',         'furniture'],
  ];
  let bad = 0;
  for (const [sku, want] of cases) {
    const got = job.classifyFamily(sku);
    if (got !== want) { bad++; fail(`classifyFamily("${sku}")`, `got "${got}", expected "${want}"`); }
  }
  if (!bad) pass(`all ${cases.length} family cases classify correctly`);

  if (job.classifyFamily('TOTALLY-NEW-SHAPE-9') === null) {
    pass('an unrecognised SKU returns null, never a guess');
  } else {
    fail('unrecognised SKU was guessed into a family',
         'A NULL is how a new WC product line announces itself. Guessing hides it.');
  }

  /* THE LEAK THAT MATTERS: a kitchen sink or faucet reaching the vanity scope
     would inflate the one number this page exists to report. */
  const leaks = ['CF511-AS-3022A','SS-U-1520A','SSSG-AD-3322C','F1-0003-01-AL','CTAB2727BLGG']
    .filter(s => job.classifyFamily(s) === 'vanity');
  if (!leaks.length) pass('no kitchen sink / faucet / furniture SKU classifies as vanity');
  else fail('non-vanity SKUs leaked into the vanity family', leaks.join(', '));

  /* The scope must actually reach the SQL. A scope computed but not applied
     is the quietest possible failure — the page looks scoped and is not. */
  const src = read(CONTROLLER);
  const scopedCalls   = (src.match(/DEDUPED_BASE\([^)]*SC\.sql\)/g) || []).length;
  const unscopedCalls = (src.match(/DEDUPED_BASE\(W\)|DEDUPED_BASE\(''\)/g) || []).length;
  if (scopedCalls > 0 && unscopedCalls === 0) {
    pass(`all ${scopedCalls} DEDUPED_BASE calls pass the scope fragment`);
  } else {
    fail(`${unscopedCalls} DEDUPED_BASE call(s) ignore the scope`,
         'An unscoped card silently reports faucets and kitchen sinks as vanity demand.');
  }

  if (/product_family IN/.test(src)) pass('scope filters on product_family');
  else fail('scopeClause does not filter on product_family');

  /* Tops are a dimension, not a family. Anyone adding a "tops" scope has
     misunderstood the catalogue and will find nothing. */
  if (!/SCOPES\s*=\s*\{[\s\S]*?\btop\b\s*:/.test(src)) {
    pass('no "top" scope — tops are a dimension of the vanity, not a family');
  } else {
    fail('a "top" scope exists', 'There is no separate vanity-top SKU; the top is part of the vanity.');
  }
}

/* ── 11. THE SKU CODEBOOK ─────────────────────────────────────────────
 *
 * The base SKU is a five-part structured code and decoding it is what took
 * attribute coverage from ~0% to 100% of observed drawdown. These checks
 * exercise the SHIPPED decoder, not a copy of its rules.
 *
 * Runs before section 10 because section 10 is async and owns process.exit.
 */
section('11. SKU codebook — decode, precedence, and honest gaps');
{
  const cb = require(path.join(ROOT, 'src/data/wcCodebook.js'));

  /* 11a. Known SKUs decode to the values their vendor/retailer listing states.
     Each expectation below was read off a primary source, so a failure here
     means the codebook drifted from reality — not that the test is stale. */
  const CASES = [
    // SKU            collection    colour            top                      sinks
    ['PA60QZ05PW', 'Palace',     'Pure White',     'Quartz',                2], // Lowe's
    ['SE30QZ00MW', 'Sequoia',    'Mango Wood',     'Quartz',                1], // vendor
    ['BD20CR06HW', 'Brandy',     'Honey Walnut',   'Ceramic',               1], // Home Depot
    ['WE30QZ01LW', 'Westin',     'Lustrous Walnut','Quartz',                1], // Home Depot
    ['OX30CW00CO', 'Oxford',     'Charcoal Oak',   'Carrara White Marble',  1], // Yala
    ['EU48EM00TO', 'Eureka',     'Truffle Oak',    'Engineered Marble',     1], // Kingston Brass
    ['MS72CW01GN', 'Madison',    'Glacial Green',  'Carrara White Marble',  2], // Home Depot
    ['CH24CW03GK', 'Chestnut',   'Grey Oak',       'Carrara White Marble',  1], // 2020 catalogue
  ];
  let bad = [];
  for (const [sku, coll, colour, top, sinks] of CASES) {
    const d = cb.decodeBaseSku(sku);
    if (!d) { bad.push(`${sku}: did not decode at all`); continue; }
    if (d.collection    !== coll)   bad.push(`${sku}: collection "${d.collection}" != "${coll}"`);
    if (d.cabinet_color !== colour) bad.push(`${sku}: colour "${d.cabinet_color}" != "${colour}"`);
    if (d.top_material  !== top)    bad.push(`${sku}: top "${d.top_material}" != "${top}"`);
    if (d.sinks         !== sinks)  bad.push(`${sku}: sinks ${d.sinks} != ${sinks}`);
  }
  if (!bad.length) pass(`all ${CASES.length} verified SKUs decode correctly`);
  else fail('a verified SKU decodes wrongly', bad.join('\n          '));

  /* 11a-ii. FINGERPRINT THE WHOLE CODEBOOK.
   *
   * The spot-checks above pin 8 of 30 collections and 8 of 19 colours. The
   * mutation harness proved that is not enough: remapping NJ from "Noir
   * Juglans" to "Monarch Blue" passed every check above, because no case
   * used an NJ SKU. A wrong label is the quietest bug available here — every
   * card still populates, just with the wrong names on it.
   *
   * So the codebook is fingerprinted as a whole. This is a TRIPWIRE, not an
   * independent verification: it cannot tell a correct entry from an
   * incorrect one, it only guarantees that nothing changes silently. When it
   * fires, the job is to re-check the changed entry against a PRIMARY SOURCE
   * (vendor copy or a retailer listing) and then update the constant below.
   * Updating the constant to make the gate pass, without doing that check,
   * defeats the entire point. */
  const EXPECTED_FINGERPRINT = '59a637afd370692e';
  const EXPECTED_COUNTS = { COLLECTION: 30, CABINET_COLOUR: 19, TOP_MATERIAL: 5,
                            HARDWARE_FINISH: 7, SINKS_BY_WIDTH: 8 };
  const keys = Object.keys(EXPECTED_COUNTS);
  const canon = JSON.stringify(keys.map(k =>
    [k, Object.entries(cb[k]).sort(([a], [b]) => (a < b ? -1 : 1))]));
  const fp = require('crypto').createHash('sha256').update(canon).digest('hex').slice(0, 16);
  const countMismatch = keys.filter(k => Object.keys(cb[k]).length !== EXPECTED_COUNTS[k]);

  if (fp === EXPECTED_FINGERPRINT && !countMismatch.length) {
    pass(`codebook matches its fingerprint (${keys.map(k => `${k}=${EXPECTED_COUNTS[k]}`).join(' ')})`);
  } else {
    fail(`codebook changed — fingerprint ${fp}, expected ${EXPECTED_FINGERPRINT}`,
         (countMismatch.length ? `counts changed: ${countMismatch.join(', ')}. ` : '') +
         'Re-verify the changed entry against a primary source (vendor copy or a ' +
         'retailer listing), THEN update EXPECTED_FINGERPRINT. Do not just paste ' +
         'the new hash in — that is how a wrong label ships.');
  }

  /* 11b. A SKU that does not use the grammar must return null outright —
     never a half-filled object. Washstands, accessories and named one-offs
     are 46 of 244 bases and must stay out of the vanity attribute cuts. */
  const NON = ['SEQUOIA-30MW', 'EB30A', 'BA-0001-01', 'CIRILLA', 'EMPIRE', 'F5-0011-01'];
  const leaked = NON.filter(s => cb.decodeBaseSku(s) !== null);
  if (!leaked.length) pass('non-grammar SKUs return null, never a partial guess');
  else fail(`${leaked.length} non-grammar SKU(s) decoded anyway`, leaked.join(', '));

  /* 11c. An unknown code must yield null for that field and be reported.
     This is the alarm that tells us WC shipped a new collection. If it ever
     returns a plausible-looking value instead, a new product line gets
     silently misfiled under an existing one. */
  const novel = cb.decodeBaseSku('ZZ30CW03ZZ');
  const novelUnknown = cb.unknownCodes('ZZ30CW03ZZ') || [];
  if (novel && novel.collection === null && novel.cabinet_color === null
      && novel.size_nominal === 30 && novelUnknown.length >= 2) {
    pass('unknown codes return null and are reported, while width still resolves');
  } else {
    fail('an unknown code was not handled honestly',
         `got ${JSON.stringify(novel)} / unknown=${JSON.stringify(novelUnknown)}`);
  }

  /* 11c-ii. NO PERMANENTLY-EMPTY DIMENSION CARDS.
     Top finish and Mounting type were removed on 2026-11-25 because neither
     can be populated from any source we have. They are easy to re-add by
     reflex ("there's a column for it"), and the result is a report with two
     dead blocks that makes the working parts look broken too.
     Re-adding either is only correct alongside a real data source. */
  const viewSrc = read(VIEW);
  const ctlSrc  = read(CONTROLLER);
  const revived = [];
  if (/\['byTopFinish'/.test(viewSrc) || /cards\.byTopFinish\s*=/.test(ctlSrc)) revived.push('Top finish');
  if (/\['byMounting'/.test(viewSrc)  || /cards\.byMounting\s*=/.test(ctlSrc))  revived.push('Mounting type');
  if (!revived.length) {
    pass('no top-finish or mounting card (removed — unsourceable, not forgotten)');
  } else {
    fail(`${revived.join(' and ')} card(s) are back`,
         'Neither can be sourced: top finish is not code-derivable (QZ is Whitebrook on ' +
         'Sequoia, Carrara on Palace), and the catalogue\'s "Installation Type" is a FAUCET ' +
         'attribute. Re-add only with a real product-data export.');
  }

  /* 11d. ⚠️ top_finish MUST NOT be derived from the code.
     Measured: SE30QZ00MW is "Whitebrook", PA60QZ05PW is "Carrara" — same QZ
     code, different stone. Deriving finish from the code would fill a card
     with confident nonsense. The decoder must not return it at all. */
  const anyFinish = CASES.some(([s]) => 'top_finish' in (cb.decodeBaseSku(s) || {}));
  if (!anyFinish) {
    pass('top_finish is NOT derived from the SKU code (QZ maps to >1 stone)');
  } else {
    fail('the decoder is deriving top_finish from the code',
         'QZ is Whitebrook on Sequoia and Carrara on Palace — this cannot be code-derived.');
  }

  /* 11e. Hardware finish must not be written into cabinet_finish. There is
     no hardware column; filling the cabinet's finish with the handle's would
     corrupt a different card rather than leave an honest blank. */
  const jobSrc = read(JOB);
  if (!/cabinet_finish\s*:\s*[^,\n]*hardware/i.test(jobSrc)
      && !/hardware_finish[^\n]*cabinet_finish/i.test(jobSrc)) {
    pass('hardware finish is not written into cabinet_finish');
  } else {
    fail('hardware finish is being written to cabinet_finish',
         'Those are different attributes; this would silently corrupt the cabinet cut.');
  }

  /* 11f. PRECEDENCE: the supplier catalogue outranks the decode. The merge
     must spread the decode FIRST and the catalogue second, so catalogue
     values win and the decode only fills gaps. */
  if (/\{\s*\.\.\.dec,[\s\S]{0,200}?\.\.\.Object\.fromEntries\(Object\.entries\(cat\)/.test(jobSrc)) {
    pass('catalogue outranks decode in the attribute merge (decode fills gaps only)');
  } else {
    fail('the attribute merge does not put the catalogue above the decode',
         'A rule applied to a code must never overwrite a per-SKU supplier statement.');
  }

  /* 11g. The codebook must be a committed module, never read from disk.
     Hostinger runs from hbuilds/versions/<uuid>/, so any relative data path
     breaks on every deploy (OPEN_ITEMS #24). */
  /* Strip comments FIRST. The codebook's own header explains why it must not
     use __dirname, and an earlier version of this check matched that prose
     and failed the gate on its own documentation. The gate already hit this
     exact trap once (a COLLATE count that included a comment) — test code,
     never commentary. */
  const cbSrc = read('src/data/wcCodebook.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  if (!/require\(\s*['"]fs['"]/.test(cbSrc) && !/readFile|existsSync|__dirname/.test(cbSrc)) {
    pass('codebook is a committed module with no disk or path dependency');
  } else {
    fail('the codebook reads from disk',
         'It must be a plain module — a relative data path cannot survive a Hostinger deploy.');
  }
}

/* ── 12. THE INTERACTIVE TREND CHART ──────────────────────────────────
 *
 * The chart lets any period be compared against any other at five
 * granularities. That makes one mistake very easy and very expensive:
 * plotting raw unit totals instead of a per-observed-day rate.
 *
 * WHY THAT WOULD BE WRONG, IN NUMBERS. The WC feed skips days — 157 of
 * 1,627 adjacent snapshot pairs are non-consecutive — so an observation can
 * cover several calendar days, which is what span_days records. 2026 has
 * 315 observed days against 2025's 363. Summing raw units would show 2026
 * down ~38% when the like-for-like rate is down 28.7%. The error is largest
 * precisely in the year-over-year read the chart exists to produce.
 */
section('12. Trend chart — observed-day normalisation and CSP');
{
  const v = read(VIEW);
  const c = read(CONTROLLER);

  /* 12a. The server must ship span_days with every point. Without it the
     client cannot normalise, no matter what the plotting code does. */
  /* Scope the check to the dailySeries query ITSELF. A bare search for
     "span_days" across the controller passes on DEDUPED_BASE's own
     MAX(m.span_days), which is a different query — the mutation harness
     proved it by replacing the span column with a literal 1 and sailing
     through. Test the block that has to be right. */
  const dsBlock = (c.match(/cards\.dailySeries[\s\S]{0,700}?ORDER BY/) || [''])[0];
  if (dsBlock && /g\.span_days/.test(dsBlock) && /AS span\b/.test(dsBlock)) {
    pass('daily series derives span from g.span_days (observed coverage) per row');
  } else {
    fail('the daily series does not carry real span_days',
         'Found: ' + (dsBlock ? dsBlock.replace(/\s+/g, ' ').slice(0, 150) : 'no dailySeries query') +
         '\n          A literal or missing span silently turns the rate into a per-observation ' +
         'average, which is not what the axis claims.');
  }

  /* 12b. The client must divide by it. Looks for the rate computation
     rather than its absence, so a refactor that drops it fails loudly. */
  if (/\.days\s*\+=\s*r\[2\]/.test(v) && /\.rate\s*=\s*e\.days\s*\?\s*e\.units\s*\/\s*e\.days/.test(v)) {
    pass('buckets accumulate span_days and plot units ÷ observed days');
  } else {
    fail('the chart is not normalising by observed days',
         'Plot units/observed-day. A raw total makes a sparsely-observed period ' +
         'look weak and corrupts every year-over-year comparison.');
  }

  /* 12c. The plotted dataset must be the rate, never the raw total. */
  if (/data:\s*[ab]\.map\(function \(e\) \{ return Math\.round\(e\.rate/.test(v)
      && !/data:\s*[ab]\.map\([^)]*e\.units/.test(v)) {
    pass('datasets plot e.rate, never e.units');
  } else {
    fail('a dataset is plotting raw units', 'Every series must plot the rate.');
  }

  /* 12c-ii. ⚠️ scopeClause() RETURNS AN OBJECT, NOT A STRING.
     Every DEDUPED_BASE call must be handed SC.sql. Passing the object
     stringifies to "[object Object]" inside the SQL, the query dies at parse
     time, card() swallows it, and the section renders its empty state —
     indistinguishable from "no data yet". That is exactly how the trend
     chart shipped broken: two cards were passing scopeClause(scopeKey).
     Cheap to write, invisible without a gate. */
  const badScope = [...c.matchAll(/DEDUPED_BASE\(\s*[^)]*?scopeClause\s*\(/g)];
  if (!badScope.length) {
    pass('every DEDUPED_BASE call passes SC.sql, never the scopeClause object');
  } else {
    fail(`${badScope.length} DEDUPED_BASE call(s) pass the scopeClause OBJECT`,
         'Use SC.sql and bind SC.params. The object stringifies to ' +
         '"[object Object]" and the query fails at parse time.');
  }

  /* 12c-iii. A scoped query must also BIND the scope params. SC.sql contains
     ? placeholders; forgetting the params is a different, quieter failure. */
  const dsCall = (c.match(/cards\.dailySeries[\s\S]{0,800}?\)\);/) || [''])[0];
  if (/SC\.sql/.test(dsCall) && /SC\.params/.test(dsCall)) {
    pass('daily series binds SC.params alongside SC.sql');
  } else {
    fail('the daily series does not bind SC.params',
         'SC.sql carries ? placeholders; they must be bound or the query errors.');
  }

  /* 12d. All five granularities the report was asked for. */
  const grans = ['D', 'W', 'M', 'Q', 'Y'].filter(g => v.includes(`data-g="${g}"`));
  if (grans.length === 5) pass('all five granularities present (day/week/month/quarter/year)');
  else fail(`only ${grans.length}/5 granularities present`, `found: ${grans.join(', ')}`);

  /* 12e. The compare selector, and position-based alignment. Comparing by
     DATE instead of position would put Jan 2026 beside Jan 2025 on a shared
     axis and run one series off the end. */
  if (/id="wc-p2"/.test(v) && /bucketise\(subset\(p2\.value\), SEL_G\)/.test(v)) {
    pass('compare-to selector wired, aligned by position in the period');
  } else {
    fail('the compare-to period is missing or not aligned by position');
  }

  /* 12f. CSP. The admin forbids inline handlers; this chart adds three
     listeners and a <select>, which is exactly where one slips in. */
  const body = v.replace(/<%[\s\S]*?%>/g, '');          // strip EJS first
  if (!/\son(click|change|input|submit)\s*=/i.test(body)) {
    pass('no inline event handlers (admin CSP)');
  } else {
    fail('an inline event handler is present',
         'The admin CSP blocks them — use addEventListener in the nonce\'d block.');
  }

  /* 12g. contentFor('script') anywhere in this view wipes every script on
     the page, chart included. PROJECT_BRIEF §9. */
  if (!/contentFor\(\s*['"]script/.test(v)) {
    pass("no contentFor('script') (it would wipe the chart)");
  } else {
    fail("contentFor('script') found in the view", 'It silently removes all page JS.');
  }
}

/* ── 10. THE VALIDITY GATE MUST NOT BE A ONE-WAY DOOR ─────────────────
 *
 * THE BUG THIS EXISTS TO PREVENT, because it shipped once and hid itself.
 * The trailing-median baseline was originally computed over days already
 * marked valid. WC stepped its catalogue down on 2025-10-09, 1,553 SKUs ->
 * 1,344. Every day from then on deviated >10% from a median frozen at 1,553,
 * so every day was invalid; being invalid, not one of them could move the
 * median. Replayed over the real row counts of all 1,628 snapshots: 400 days
 * discarded, the last valid day 2025-10-08. Thirteen months of the most
 * commercially relevant data, gone, and the only visible symptom was
 * "No movement in this window" on one card.
 *
 * These run recomputeValidity() against a STUBBED connection — no database,
 * no files — so the actual shipped function is exercised, not a paraphrase
 * of it. A test that reimplements the algorithm would have passed happily
 * while the real one was broken.
 */
section('10. VALIDITY GATE — recovery from a catalogue step change');
{
  process.env.DB_PASS = process.env.DB_PASS || 'gate-dummy-never-connects';
  const job = require(path.join(ROOT, JOB));

  /* Minimal fake connection: serves the SELECT from an in-memory series and
     applies the UPDATEs back onto it. Anything unexpected throws rather than
     returning empty, so a query the stub does not model fails loudly instead
     of silently passing the test. */
  function stub(series) {
    const rows = series.map(([d, n]) => ({ d, row_count: n, is_valid: 1, notes: null }));
    return {
      rows,
      async query(sql, params) {
        if (/FROM wc_snapshot_validity ORDER BY snapshot_date ASC/.test(sql)) {
          return [rows.map(r => ({ ...r }))];
        }
        if (/UPDATE wc_snapshot_validity SET is_valid/.test(sql)) {
          const [isValid, notes, d] = params;
          const r = rows.find(x => x.d === d);
          if (!r) throw new Error(`stub: UPDATE for unknown date ${d}`);
          r.is_valid = isValid; r.notes = notes;
          return [{ affectedRows: 1 }];
        }
        if (/UPDATE wc_daily_movement/.test(sql)) return [{ affectedRows: 0 }];
        throw new Error(`stub: unmodelled query: ${sql.slice(0, 60)}`);
      },
    };
  }

  /* getTrailingMedian is the OTHER half of the door, and it is a separate
     test because recomputeValidity carries its own window and never calls
     it. The mutation harness found exactly this hole: restoring
     "AND is_valid = 1" to getTrailingMedian left every check below green.
     Do not merge these two tests.

     The stub honestly plays MariaDB here — it reads the WHERE clause and
     applies the filter — so this asserts behaviour, not the presence of a
     string. A filtered baseline returns the pre-step median and the test
     fails; an unfiltered one tracks the counts. */
  function medianStub(rows) {
    return {
      async query(sql, params) {
        let r = rows;
        if (/snapshot_date < \?/.test(sql)) r = r.filter(x => x.d < params[0]);
        if (/is_valid\s*=\s*1/.test(sql)) r = r.filter(x => x.is_valid === 1);
        r = [...r].sort((a, b) => a.d < b.d ? 1 : -1).slice(0, 7);
        return [r.map(x => ({ row_count: x.row_count }))];
      },
    };
  }

  /* Ten flat days at 1,553, then ten at 1,344 which a stale gate has marked
     invalid — the live state of the table on 2026-11-25. */
  const mixed = [];
  for (let i = 1; i <= 10; i++) mixed.push({ d: `2025-10-${String(i).padStart(2,'0')}`, row_count: 1553, is_valid: 1 });
  for (let i = 11; i <= 20; i++) mixed.push({ d: `2025-10-${String(i).padStart(2,'0')}`, row_count: 1344, is_valid: 0 });

  /* The real shape of the event: flat, one-day step down, flat again. */
  const series = [];
  for (let i = 0; i < 40; i++) series.push([`2025-09-${String(i + 1).padStart(2,'0')}`, 1553]);
  for (let i = 0; i < 40; i++) series.push([`2025-11-${String(i + 1).padStart(2,'0')}`, 1344]);

  /* ONE async IIFE for the whole section, deliberately. A second one would
     race this: whichever finished first would call process.exit and the
     other's assertions would never run, which is a gate that reports green
     without having checked. */
  (async () => {
    /* FIRST: the incremental path. getTrailingMedian is what processSnapshot
       consults as each snapshot is ingested, and it is NOT reached by
       recomputeValidity below. */
    const m = await job.getTrailingMedian(medianStub(mixed), '2025-10-21');
    if (m === 1344) {
      pass('trailing median follows the actual row counts, not just valid days');
    } else {
      fail(`trailing median returned ${m}, expected 1344`,
           'getTrailingMedian is filtering its baseline on is_valid. That is the ' +
           'one-way door: once a catalogue step marks days invalid the median ' +
           'freezes at the old count and every later day is invalid for ever. ' +
           'Measured cost when this shipped: 400 of 1,628 days discarded.');
    }

    const c = stub(series);
    await job.recomputeValidity(c);
    const after = c.rows.slice(45);                 // well clear of the step
    const stillInvalid = after.filter(r => !r.is_valid);
    if (!stillInvalid.length) {
      pass('days after a sustained catalogue step return to valid (baseline self-heals)');
    } else {
      fail(`${stillInvalid.length} day(s) remain invalid long after a catalogue step`,
           'The trailing median is not following the row counts — this is the one-way door. ' +
           'Check that getTrailingMedian does NOT filter on is_valid.');
    }

    /* The other half: it must still reject a genuinely bad file. A gate that
       recovers from everything is not a gate. */
    const trunc = series.map(([d, n], i) => [d, i === 60 ? Math.round(n / 2) : n]);
    const c2 = stub(trunc);
    await job.recomputeValidity(c2);
    if (!c2.rows[60].is_valid) {
      pass('a truncated file is still marked invalid');
    } else {
      fail('a half-length snapshot was accepted as valid',
           'The validity gate no longer catches truncated feeds.');
    }

    /* And one bad day must not take its neighbours with it — a median over
       seven absorbs a single outlier. */
    const collateral = c2.rows.slice(61, 69).filter(r => !r.is_valid);
    if (!collateral.length) {
      pass('one bad day does not collaterally invalidate the days after it');
    } else {
      fail(`${collateral.length} day(s) after a single truncated file were also invalidated`,
           'One bad file is contaminating the baseline.');
    }

    /* The two code paths must agree. processSnapshot judges a day as it is
       ingested; recomputeValidity re-judges the whole series afterwards. If
       they use different minimum baselines they will reach opposite verdicts
       on the earliest days and flip them on alternate runs, for ever. */
    const src = read(JOB);
    const usesShared = (src.match(/VALIDITY_MIN_BASELINE/g) || []).length >= 3;
    const noMagic3 = !/window\.length\s*>=\s*3/.test(src);
    if (usesShared && noMagic3) {
      pass('both validity paths share VALIDITY_MIN_BASELINE (no divergent verdicts)');
    } else {
      fail('the two validity paths do not share one minimum-baseline constant',
           'They will disagree on the earliest days and flip them every run.');
    }

    /* Flipping is_valid back on is only half a fix: processSnapshot returns
       before computing any delta on an invalid day, so a rescued day is valid
       and EMPTY unless its movement rows are rebuilt. */
    if (typeof job.findUnbuiltValidDays === 'function'
        && /findUnbuiltValidDays\(/.test(src.split('async function runRollup')[1] || '')) {
      pass('rescued days have their deltas rebuilt (runRollup calls findUnbuiltValidDays)');
    } else {
      fail('nothing rebuilds movement rows for days that become valid',
           'processSnapshot returns before computing deltas when a day is invalid, so ' +
           'recomputeValidity alone yields days marked valid that contain nothing.');
    }

    /* ── RESULT ─────────────────────────────────────────────────────── */
    console.log('');
    if (failures) {
      console.error(`gate_wc_inventory: ${failures} failure(s)`);
      process.exit(1);
    }
    console.log('gate_wc_inventory: all checks passed');
    process.exit(0);
  })().catch(err => {
    console.error(`\ngate_wc_inventory: section 10 threw — ${err.message}`);
    process.exit(1);
  });
}

/* NOTE ON CONTROL FLOW. Sections 1-9 are synchronous; section 10 is async
   because it awaits recomputeValidity against a stubbed connection. The
   result block therefore lives INSIDE section 10's IIFE above, which owns
   process.exit, and its .catch exits non-zero if the section throws. There
   is deliberately no second result block here: two of them would let the
   file exit 0 before the async assertions had run, which is the classic way
   a gate quietly stops gating. If section 10 is ever removed, move the
   result block back out here. */
