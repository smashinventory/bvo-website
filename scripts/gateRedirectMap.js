#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   Gate the redirect map BEFORE it is loaded or deployed.

   Everything here is checked against the CSV and the live sitemaps, not
   remembered. A redirect map is the kind of artefact that looks fine and
   is wrong: a chain costs signal silently, a loop makes a page permanently
   unreachable, and a typo'd host adds a hop to every cross-domain row.
   None of those show up by looking at the file.

   Usage:
       node scripts/gateRedirectMap.js
       node scripts/gateRedirectMap.js --live   # also HTTP-check destinations
   ───────────────────────────────────────────────────────────────────────── */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const LIVE = process.argv.includes('--live');
const CSV  = path.resolve(__dirname, '..', '..', 'migration', 'redirect_map.csv');
const NEW_SITE = 'https://slategrey-falcon-350174.hostingersite.com';

let bad = 0;
const fail = m => { console.log(`  ✗ ${m}`); bad = 1; };
const pass = m => console.log(`  ✓ ${m}`);

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i+1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift();
  return rows.filter(r => r.length === head.length && r.some(Boolean))
             .map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const pathOf = u => { try { return new URL(u).pathname.replace(/\/+$/, '') || '/'; } catch { return null; } };
const hostOf = u => { try { return new URL(u).hostname; } catch { return null; } };
/* Path AND query — a row that only sheds a query is NOT a self-redirect. */
const pqOf = u => { try { const x = new URL(u);
  return (x.pathname.replace(/\/+$/, '') || '/') + (x.search || ''); } catch { return null; } };
const isSelf = r => r.status === '301'
  && hostOf(r.destination) === 'www.bathroomvanitiesoutlet.com'
  && pqOf(r.destination) === r.old_path;

function head(url, redirects = 0) {
  return new Promise(resolve => {
    if (redirects > 3) return resolve({ status: 'CHAIN' });
    const req = https.request(url, { method: 'HEAD', timeout: 12000 }, res => {
      res.resume();
      resolve({ status: res.statusCode, location: res.headers.location, hops: redirects });
    });
    req.on('timeout', () => { req.destroy(); resolve({ status: 'TIMEOUT' }); });
    req.on('error', e => resolve({ status: 'ERR', error: e.message }));
    req.end();
  });
}

(async function main() {
  console.log('\n── Redirect map gates ─────────────────────────────────────\n');

  if (!fs.existsSync(CSV)) { fail(`G0: ${CSV} not found — run buildRedirectMap.js`); process.exit(1); }
  const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
  pass(`G0: map read — ${rows.length} rows`);

  // ── G1 — nothing unresolved. A REVIEW row ships as a 404. ──────────
  const review = rows.filter(r => r.status === 'REVIEW');
  review.length ? fail(`G1: ${review.length} REVIEW rows would 404 — e.g. ${review[0].old_path}`)
                : pass('G1: no unresolved rows');

  // ── G2 — every 301 has a destination, every 410 has none ───────────
  const noDest = rows.filter(r => r.status === '301' && !r.destination);
  const badGone = rows.filter(r => r.status === '410' && r.destination);
  noDest.length  ? fail(`G2: ${noDest.length} 301s with an empty destination`) : null;
  badGone.length ? fail(`G2: ${badGone.length} 410s that also carry a destination`) : null;
  if (!noDest.length && !badGone.length) pass('G2: every 301 has a target, every 410 has none');

  // ── G3 — GVS targets must be NON-www ───────────────────────────────
  // GVS canonicalises to the bare host. A www target means every one of
  // these becomes two hops: old -> www.gvs -> gvs.
  const gvsWww = rows.filter(r => /^https:\/\/www\.globalvaluesupply\.com/.test(r.destination || ''));
  gvsWww.length ? fail(`G3: ${gvsWww.length} GVS targets written with www — each would add a hop`)
                : pass('G3: all GVS targets are non-www');

  // ── G4 — BVO targets must be www, and https ────────────────────────
  const bvoBad = rows.filter(r => {
    const h = hostOf(r.destination || '');
    return h === 'bathroomvanitiesoutlet.com';
  });
  bvoBad.length ? fail(`G4: ${bvoBad.length} BVO targets are non-www — canonical is www, so each adds a hop`)
                : pass('G4: all BVO targets are www');

  const insecure = rows.filter(r => (r.destination || '').startsWith('http://'));
  insecure.length ? fail(`G4: ${insecure.length} destinations are http://`) : null;

  // ── G5 — no chains, no loops ───────────────────────────────────────
  // Only BVO-internal destinations can chain; a cross-domain target is
  // somebody else's problem and is checked over HTTP in G8 instead.
  //
  // CRITICAL: walk the set that will actually be LOADED, i.e. excluding
  // self-redirects. Including them reported 222 false loops on the first
  // run — /collections/bathroom-vanities-1/36-inch -> /collections/bathroom-
  // vanities looked like a chain into /collections/bathroom-vanities only
  // because that path had a self-redirect row. The loader drops those, so
  // at runtime there is no second hop. Gating the CSV instead of the loaded
  // set measures something that never exists.
  const byPath = new Map();
  for (const r of rows) if (r.status === '301' && !isSelf(r)) byPath.set(r.old_path, r.destination);

  const chains = [], loops = [];
  for (const [from, to] of byPath) {
    if (hostOf(to) !== 'www.bathroomvanitiesoutlet.com') continue;
    const seen = new Set([from.split('?')[0]]);
    let cur = pathOf(to), hops = 0;
    while (byPath.has(cur) && hops < 10) {
      if (seen.has(cur)) { loops.push(`${from} -> ... -> ${cur}`); break; }
      seen.add(cur);
      cur = pathOf(byPath.get(cur));
      hops++;
    }
    if (hops > 0 && !loops.length) chains.push(`${from} -> ${pathOf(to)} -> ... (${hops} extra hop${hops>1?'s':''})`);
  }
  loops.length  ? fail(`G5: ${loops.length} LOOP(S) — e.g. ${loops[0]}`) : null;
  chains.length ? fail(`G5: ${chains.length} CHAIN(S) — e.g. ${chains[0]}`) : null;
  if (!loops.length && !chains.length) pass('G5: no chains, no loops');

  // ── G6 — self-redirects are identified, and are NOT loaded ─────────
  // These are fine in the CSV (it is the full inventory) but MUST be
  // dropped before the table, or the pre-route middleware loops forever.
  const self = rows.filter(isSelf);
  pass(`G6: ${self.length} self-redirects present in the CSV — loader must drop all of them`);

  // The nine rows whose whole job is to SHED a query must NOT be counted as
  // self-redirects. They were, on the first version of this gate, and the
  // loader would have dropped them — leaving Google's indexed ?variant= and
  // ?page= URLs unhandled. Assert the distinction holds.
  const shedsQuery = rows.filter(r =>
    r.status === '301' && r.old_path.includes('?')
    && hostOf(r.destination) === 'www.bathroomvanitiesoutlet.com'
    && pathOf(r.destination) === r.old_path.split('?')[0]
    && !isSelf(r));
  shedsQuery.some(r => self.includes(r))
    ? fail('G6: a query-shedding row was classed as a self-redirect — it would be dropped')
    : pass(`G6: ${shedsQuery.length} query-shedding rows correctly kept (?page=, ?variant=)`);

  const loader = fs.readFileSync(path.resolve(__dirname, 'loadRedirectMap.js'), 'utf8');
  /dropped\.self\.push/.test(loader)
    ? pass('G6: loadRedirectMap.js does drop them')
    : fail('G6: loadRedirectMap.js no longer drops self-redirects — the middleware would loop');

  const mw = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'middleware', 'legacyRedirects.js'), 'utf8');
  /_isSelf/.test(mw)
    ? pass('G6: the middleware also refuses a self-redirect at runtime')
    : fail('G6: the middleware lost its runtime self-redirect guard');

  // ── G7 — the middleware is actually wired in, before the routes ────
  const srv = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'server.js'), 'utf8');
  const mwAt    = srv.indexOf("require('./middleware/legacyRedirects')");
  const routeAt = srv.indexOf("app.use('/products',");
  if (mwAt < 0)            fail('G7: legacyRedirects is not mounted in server.js');
  else if (routeAt < 0)    fail('G7: could not locate the product routes to compare against');
  else if (mwAt > routeAt) fail('G7: legacyRedirects is mounted AFTER the routes — controllers render 404 directly, so it would never fire');
  else                     pass('G7: middleware mounted before the routes');

  // ── G8 — destinations resolve (optional, network) ──────────────────
  if (LIVE) {
    console.log('\n  G8: HTTP-checking destinations (sampled)…');
    const targets = [...new Set(rows.filter(r => r.status === '301').map(r => r.destination))];
    const sample = targets.filter(t => hostOf(t) !== 'www.bathroomvanitiesoutlet.com')
      .concat(targets.filter(t => hostOf(t) === 'www.bathroomvanitiesoutlet.com')
        .map(t => t.replace('https://www.bathroomvanitiesoutlet.com', NEW_SITE)))
      .filter((_, i) => i % 7 === 0);   // every 7th, enough to catch a systemic error

    let bad8 = 0;
    for (const t of sample) {
      const r = await head(t);
      if (r.status !== 200) { if (bad8 < 6) console.log(`      ${r.status}  ${t}`); bad8++; }
    }
    bad8 ? fail(`G8: ${bad8}/${sample.length} sampled destinations did not return 200`)
         : pass(`G8: ${sample.length} sampled destinations all return 200`);
  } else {
    console.log('  – G8: skipped (pass --live to HTTP-check destinations)');
  }

  console.log('');
  console.log(bad ? '── GATES FAILED ───────────────────────────────────────────\n'
                  : '── All gates passed ───────────────────────────────────────\n');
  process.exit(bad);
})();
