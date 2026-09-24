#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   Load migration/redirect_map.csv into the url_redirects table.

   The CSV is the AUDIT RECORD — all 659 indexed old URLs, including the
   ones that need no redirect. The TABLE is the subset the middleware acts
   on. This script is what separates the two, and it refuses to load
   anything that would break at runtime:

     SELF-REDIRECTS are dropped. 158 old URLs are byte-identical on the new
     site. The middleware runs BEFORE the routes (it has to — controllers
     render 404 directly rather than calling next(), so a post-route
     middleware would never see a dead product URL). A pre-route middleware
     holding a self-redirect is an infinite loop. Dropping them is correct
     as well as safe: those URLs already resolve 200 unchanged.

     CHAINS are rejected. If A -> B and B -> C both exist, A would take two
     hops. Google follows them but discounts the signal, and they are
     invisible until someone checks. The loader resolves A -> C instead.

     LOOPS are rejected outright. A -> B -> A cannot be flattened, so the
     load fails and says which rows.

   Idempotent — re-run it any time the CSV is regenerated. Rows you have
   hand-edited in the DB are preserved unless --overwrite is passed, because
   re-pointing a destination by hand is an expected workflow (the Norcross
   location pages, for one) and a re-run should not silently undo it.

   Usage:
       node scripts/loadRedirectMap.js            # dry run, prints the plan
       node scripts/loadRedirectMap.js --sql      # write an .sql file
       node scripts/loadRedirectMap.js --apply    # write straight to the DB
       node scripts/loadRedirectMap.js --apply --overwrite

   --sql is the normal path here. There is no SSH on this host and the
   local .env carries no DB credentials, so a direct connection is not
   available from a workstation. --sql emits a file to import through
   phpMyAdmin, which is how every other schema change on this project has
   shipped. --apply exists for a machine that CAN reach the database.
   ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');

const argv      = process.argv.slice(2);
const APPLY     = argv.includes('--apply');
const SQL_OUT   = argv.includes('--sql');
const OVERWRITE = argv.includes('--overwrite');

const BVO = 'https://www.bathroomvanitiesoutlet.com';

const CSV = path.resolve(__dirname, '..', '..', 'migration', 'redirect_map.csv');

/* ── Minimal RFC-4180 CSV reader. No dependency for a five-column file. ── */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length && r.some(Boolean))
             .map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

function pathOf(url) {
  try { const u = new URL(url); return u.pathname.replace(/\/+$/, '') || '/'; }
  catch { return null; }
}
/* Path AND query, in old_path's shape.
   Comparing only the PATH here is wrong and was caught by the gate: 9 rows
   are indexed old URLs whose whole job is to shed a query —
       /collections/bathroom-vanities?page=8       -> /collections/bathroom-vanities
       /products/csp-s2418-wg?variant=45377268744374&country=US -> /products/csp-s2418-wg
   Those are real, useful redirects. Path-only matching calls them
   self-redirects and drops them, leaving Google's indexed ?variant= and
   ?page= URLs unhandled. */
function pathQueryOf(url) {
  try {
    const u = new URL(url);
    return (u.pathname.replace(/\/+$/, '') || '/') + (u.search || '');
  } catch { return null; }
}
function isBvo(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') === 'bathroomvanitiesoutlet.com'; }
  catch { return false; }
}

(async function main() {
  if (!fs.existsSync(CSV)) {
    console.error(`\n  ✗ ${CSV} not found. Run scripts/buildRedirectMap.js first.\n`);
    process.exit(1);
  }

  const all = parseCsv(fs.readFileSync(CSV, 'utf8'));
  console.log(`\n── Loading redirect map ───────────────────────────────────\n`);
  console.log(`  ${all.length} rows in the CSV`);

  const dropped = { review: [], self: [] };
  let candidates = [];

  for (const r of all) {
    const oldPath = (r.old_path || '').trim();
    const dest    = (r.destination || '').trim();
    const status  = r.status === '410' ? 410 : 301;

    if (r.status === 'REVIEW') { dropped.review.push(oldPath); continue; }

    // Self-redirect: same host, same path AND same query. Already works
    // untouched, so redirecting it would loop. Note the query must match
    // too — see pathQueryOf above for why path-only is wrong here.
    if (status === 301 && isBvo(dest) && pathQueryOf(dest) === oldPath) {
      dropped.self.push(oldPath);
      continue;
    }

    candidates.push({
      old_path: oldPath,
      destination: status === 410 ? null : dest,
      status_code: status,
      confidence: ['HIGH', 'MED', 'LOW'].includes(r.confidence) ? r.confidence : 'MED',
      note: (r.why || '').slice(0, 255),
    });
  }

  console.log(`  ${dropped.self.length} self-redirects dropped (already resolve unchanged)`);
  if (dropped.review.length) {
    console.log(`  ${dropped.review.length} REVIEW rows dropped — these would 404. Resolve them.`);
  }

  /* ── Flatten chains, reject loops ───────────────────────────────────── */
  const byPath = new Map(candidates.map(c => [c.old_path, c]));
  let flattened = 0;
  const loops = [];

  for (const c of candidates) {
    if (c.status_code !== 301) continue;
    const seen = new Set([c.old_path]);
    let dest = c.destination;
    for (let hop = 0; hop < 10; hop++) {
      if (!isBvo(dest)) break;
      const p = pathOf(dest);
      if (seen.has(p)) { loops.push(`${c.old_path} -> ${p}`); break; }
      const next = byPath.get(p);
      if (!next || next.status_code !== 301) break;
      seen.add(p);
      dest = next.destination;
      flattened++;
    }
    if (dest !== c.destination && !loops.length) c.destination = dest;
  }

  if (loops.length) {
    console.error(`\n  ✗ ${loops.length} redirect LOOP(S) — refusing to load:\n`);
    loops.slice(0, 10).forEach(l => console.error(`      ${l}`));
    console.error('');
    process.exit(1);
  }
  if (flattened) console.log(`  ${flattened} chain hop(s) flattened to a single redirect`);

  console.log(`\n  ${candidates.length} rows to load`);
  const by = k => candidates.reduce((a, c) => (a[c[k]] = (a[c[k]] || 0) + 1, a), {});
  console.log(`    by status:     ${JSON.stringify(by('status_code'))}`);
  console.log(`    by confidence: ${JSON.stringify(by('confidence'))}`);

  /* ── --sql: emit a file to import through phpMyAdmin ──────────────── */
  if (SQL_OUT) {
    // MySQL string literal. Escapes backslash and quote, and strips control
    // characters — a stray newline inside a value would split the statement
    // and phpMyAdmin would report a syntax error 400 rows in with no clue
    // which row caused it.
    const q = v => v === null || v === undefined
      ? 'NULL'
      : `'${String(v).replace(/[\\']/g, m => '\\' + m).replace(/[\r\n\t\0\x1a]/g, ' ')}'`;

    const ddl = fs.readFileSync(
      path.resolve(__dirname, '..', 'migrations', '2026-09-24_url_redirects.sql'), 'utf8');

    const out = [];
    out.push('-- ═══════════════════════════════════════════════════════════════');
    out.push('--  url_redirects — generated by scripts/loadRedirectMap.js');
    out.push(`--  ${new Date().toISOString()}`);
    out.push(`--  ${candidates.length} rows. Import through phpMyAdmin.`);
    out.push('--');
    out.push('--  Safe to re-run. ON DUPLICATE KEY refreshes the generated');
    out.push(`--  columns${OVERWRITE ? ' INCLUDING destination' : ' but PRESERVES any destination edited by hand'}.`);
    out.push('-- ═══════════════════════════════════════════════════════════════');
    out.push('');
    out.push(ddl.trim());
    out.push('');
    out.push('START TRANSACTION;');
    out.push('');

    for (let i = 0; i < candidates.length; i += 100) {
      const chunk = candidates.slice(i, i + 100);
      out.push('INSERT INTO url_redirects (old_path, destination, status_code, confidence, note) VALUES');
      out.push(chunk.map(c =>
        `  (${q(c.old_path)}, ${q(c.destination)}, ${c.status_code}, ${q(c.confidence)}, ${q(c.note)})`
      ).join(',\n'));
      out.push('ON DUPLICATE KEY UPDATE');
      if (OVERWRITE) out.push('  destination = VALUES(destination),');
      out.push('  status_code = VALUES(status_code),');
      out.push('  confidence  = VALUES(confidence),');
      out.push('  note        = VALUES(note),');
      out.push('  is_active   = 1;');
      out.push('');
    }

    out.push('COMMIT;');
    out.push('');
    out.push('-- Expected afterwards:');
    out.push(`--   SELECT COUNT(*) FROM url_redirects WHERE is_active = 1;  -- ${candidates.length}`);
    out.push('');

    const dest = path.resolve(__dirname, '..', '..', 'migration', 'url_redirects.sql');
    fs.writeFileSync(dest, out.join('\n'));
    const kb = (fs.statSync(dest).size / 1024).toFixed(0);

    console.log(`\n  ✓ wrote ${dest}  (${kb} KB, ${candidates.length} rows)`);
    console.log(`\n  Import it through phpMyAdmin:`);
    console.log(`    hPanel > Databases > phpMyAdmin > pick the BVO database > Import`);
    console.log(`\n  Then confirm:`);
    console.log(`    SELECT COUNT(*) FROM url_redirects WHERE is_active = 1;   -- expect ${candidates.length}`);
    console.log(`\n───────────────────────────────────────────────────────────\n`);
    return;
  }

  if (!APPLY) {
    console.log(`\n  DRY RUN — nothing written.`);
    console.log(`    --sql    write an .sql file to import via phpMyAdmin  (use this)`);
    console.log(`    --apply  connect and write directly (needs DB creds in .env)\n`);
    console.log(`───────────────────────────────────────────────────────────\n`);
    return;
  }

  const { bvoPool } = require('../src/config/database');
  const ddl = fs.readFileSync(
    path.resolve(__dirname, '..', 'migrations', '2026-09-24_url_redirects.sql'), 'utf8');
  await bvoPool.query(ddl.replace(/^--.*$/gm, '').trim());

  // ON DUPLICATE KEY: refresh the machine-generated columns. destination is
  // only overwritten with --overwrite, so a hand re-point survives a re-run.
  const sql = `
    INSERT INTO url_redirects (old_path, destination, status_code, confidence, note)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      ${OVERWRITE ? 'destination = VALUES(destination),' : ''}
      status_code = VALUES(status_code),
      confidence  = VALUES(confidence),
      note        = VALUES(note),
      is_active   = 1`;

  const vals = candidates.map(c =>
    [c.old_path, c.destination, c.status_code, c.confidence, c.note]);

  for (let i = 0; i < vals.length; i += 200) {
    await bvoPool.query(sql, [vals.slice(i, i + 200)]);
  }

  const [[{ n }]] = await bvoPool.query('SELECT COUNT(*) n FROM url_redirects WHERE is_active = 1');
  console.log(`\n  ✓ loaded — url_redirects now holds ${n} active rows`);
  if (!OVERWRITE) {
    console.log(`    (destinations of existing rows were PRESERVED; use --overwrite to replace)`);
  }
  console.log(`\n───────────────────────────────────────────────────────────\n`);
  await bvoPool.end();
})().catch(e => { console.error('\n  ✗ ' + e.message + '\n'); process.exit(1); });
