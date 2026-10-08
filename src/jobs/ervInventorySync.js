#!/usr/bin/env node
'use strict';

/* ervInventorySync.js — RFLPOS → BVO, quantity only, once a day.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS SEPARATELY FROM services/rflposSync.js
 *
 * Two jobs, deliberately split (Sam, 2026-10-08):
 *
 *   rflposSync.js   CATALOGUE IMPORT. Pulls name, brand, price, description
 *                   and image, and CREATES products pending admin approval.
 *                   Currently parked; the routes in routes/admin.js are
 *                   commented out. When ER Vanities or another brand needs a
 *                   full product load from RFLPOS, that is the tool.
 *
 *   this file       QUANTITY UPDATES, POST-IMPORT. The products already
 *                   exist. It writes inventory.qty_on_hand and nothing else.
 *
 * The split is not duplication. BVO owns ER Vanities product content —
 * descriptions, specs, images, SEO, and PRICE — and RFLPOS owns quantity.
 * That ownership line is from docs/briefs/BVO_RFLPOS_SYNC_BRIEF.md (2026-09-04)
 * and it is the reason this job cannot simply be the other one re-enabled:
 * rflposSync's upsert runs `UPDATE products SET name=?, brand=?, price=?,
 * short_desc=?`, which on the 78 hand-loaded ER Vanities rows would replace
 * written product names with POS SKU strings, rebrand them to 'Ethan Roth',
 * and move every price (RFLPOS sells PR1269 at 699.99; BVO lists 1049.99).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE KEY IS AN OPAQUE STRING. DO NOT PATTERN-MATCH IT.
 *
 * Matching is products.rflpos_item_id = the RFLPOS SKU. Two traps:
 *
 *   1. rflpos_item_id holds TWO DIFFERENT KINDS OF VALUE depending on which
 *      tool wrote the row. rflposSync writes RFLPOS products.id (an integer
 *      like 1269). The 2026-09-05 hand-written ER Vanities load wrote RFLPOS
 *      products.sku ('PR1269'). This job matches the SKU form, which is why
 *      it is scoped to brand = 'ER Vanities' and cannot stray onto rows the
 *      product sync created.
 *
 *   2. RFLPOS SKUs are NOT all PR-shaped. Of the 78 mapped products, 71 are
 *      'PR####' and 7 are descriptive strings — the Kensington DOAK-MB
 *      variants and the two Bridge Cabinets carry SKUs like
 *      'Kensington-41.5-DOAK-MB'. A /^PR\d+$/ validator would silently drop
 *      those seven. Verified against the RFLPOS export on 2026-10-08: all 78
 *      resolve, no duplicates either direction, no case collisions.
 *
 * And BVO's products.sku is NOT the same field: four products disagree by a
 * half-inch (BVO 'London-29.5-WH-BN' vs RFLPOS 'London-29-WH-BN'). Harmless
 * while the match runs on rflpos_item_id; four silent misses the moment
 * someone "simplifies" it to compare sku directly. The gate forbids that.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT IT REFUSES TO DO
 *
 * An unattended daily job that writes stock can empty a storefront quietly,
 * so three conditions abort the whole run rather than writing a partial or
 * plausible-looking result. See GUARDS below.
 */

const { upsertInventory } = require('../utils/inventory');

/* THE DATABASE IS REQUIRED LAZILY, ON PURPOSE. config/database refuses to load
   without DB_PASS, which is correct for the server but would make this whole
   module impossible to require from a gate or a unit test — and the row
   validation and the guard thresholds are exactly the parts worth testing
   without a database in front of them. Every DB touch goes through db(). */
function db() { return require('../config/database').bvoPool; }

const PROXY_BASE = process.env.BVO_SYNC_URL || 'https://rflpos.com/bvo_sync.php';
const BRAND      = 'ER Vanities';          // the BVO brand this job owns
const TIMEOUT_MS = 30000;

/* GUARDS ─────────────────────────────────────────────────────────────────────
   ZERO_FLOOR: if more than this share of matched SKUs would go to zero, abort.
   A genuine simultaneous sell-out of most of a cabinet range does not happen;
   a broken join, a renamed column or an empty location set looks exactly like
   it and would read as a successful run. 8 of 78 were at zero in the
   2026-09-04 export, so the real figure sits around 10%. */
const ZERO_FLOOR = 0.5;
const QTY_CEILING = 10000;                 // a cabinet range holds nothing like this

/* ── fetch the feed ───────────────────────────────────────────────────────── */
/* fetch + AbortController, matching services/ga4.js and geocodeService.js.
   Deliberately not a copy of rflposSync's https helper: that file is proven
   and parked, and Path B keeps it byte-identical. */
async function fetchInventory(brandIds) {
  const token  = process.env.BVO_SYNC_TOKEN || '';
  if (!token) throw new Error('BVO_SYNC_TOKEN is not set');

  const params = { token, action: 'inventory' };
  if (brandIds && brandIds.length) params.brands = brandIds.join(',');

  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${PROXY_BASE}?${new URLSearchParams(params)}`, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }

  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error(`Proxy returned non-JSON (HTTP ${res.status}): ${raw.slice(0, 200)}`); }

  if (!data.ok)              throw new Error(data.error || 'Proxy returned ok:false');
  if (!Array.isArray(data.items)) throw new Error('Proxy response has no items array');
  return data.items;
}

/* ── normalise one feed row ───────────────────────────────────────────────── */
/* Returns { sku, qtyLocal, qtyAll, rawLocal, adjusted } or null with a reason
   pushed to `bad`. The key is trimmed but otherwise untouched — no case
   folding, no pattern check (see the header).

   `adjusted` is null when the feed figure passed through untouched, and
   otherwise names why it did not: 'floored' or 'negative'. run() turns it into
   a named log line. Every adjustment is reported, because a quantity that was
   quietly altered on the way in is indistinguishable in the database from one
   RFLPOS actually sent. */
function readRow(row, bad) {
  const sku = row && row.sku != null ? String(row.sku).trim() : '';
  if (!sku) { bad.push('row with empty sku'); return null; }

  const rawLocal = Number(row.qty_local);
  const qtyAll   = Number(row.qty_all);

  if (!Number.isFinite(rawLocal)) { bad.push(`${sku}: qty_local not a number (${row.qty_local})`); return null; }
  if (rawLocal > QTY_CEILING)     { bad.push(`${sku}: qty_local above ceiling (${rawLocal})`); return null; }

  /* NEGATIVE STOCK IS CLAMPED TO ZERO, NOT REJECTED. UltimatePOS goes negative
     when a sale is keyed against stock that was never received, so a negative
     figure means oversold — nothing is on the shelf, and 0 is the truthful
     sellable quantity. The earlier behaviour rejected the row, which left
     whatever BVO already held standing: a stale positive quantity on a cabinet
     with none in the building is the one error that can sell air, so 0 is also
     the safe direction to be wrong in.

     The cost is that a keying error at the POS now zeroes a cabinet instead of
     being held back for a human, which is why the clamp is reported under its
     own heading rather than folded into the zero list. GUARD 3 is the backstop:
     a feed that has gone negative across the brand trips the zero-share ceiling
     and aborts the whole run.

     Fractional quantities are real here too (qty_available is decimal) but a
     cabinet is a whole unit. Floor rather than round, so 0.5 of a cabinet is
     not advertised as one. */
  const qtyLocal = Math.floor(Math.max(0, rawLocal));

  let adjusted = null;
  if (rawLocal < 0)                      adjusted = 'negative';
  else if (!Number.isInteger(rawLocal))  adjusted = 'floored';

  return {
    sku,
    qtyLocal,
    /* qty_all only feeds the sellable-vs-all-locations report, but it is
       clamped the same way so the two figures stay comparable. */
    qtyAll:   Number.isFinite(qtyAll) ? Math.floor(Math.max(0, qtyAll)) : null,
    rawLocal,
    adjusted,
  };
}

/* ── sync log ─────────────────────────────────────────────────────────────── */
/* sync_type 'inventory' was already a valid value in the original schema
   (001_initial_schema.sql: ENUM('product','inventory','order')), so there is
   no migration here. rflposSync writes 'product' and this writes 'inventory',
   which is what keeps the two runs distinguishable in one table. */
async function startLog() {
  const [r] = await db().query(
    `INSERT INTO rflpos_sync_log (sync_type, direction, records_ok, records_err, started_at)
     VALUES ('inventory', 'pull', 0, 0, NOW())`
  );
  return r.insertId;
}

async function finishLog(logId, ok, err, detail) {
  if (!logId) return;
  await db().query(
    `UPDATE rflpos_sync_log
     SET records_ok=?, records_err=?, error_detail=?, finished_at=NOW()
     WHERE id=?`,
    [ok, err, detail ? String(detail).slice(0, 60000) : null, logId]
  );
}

/* ── resolve the RFLPOS brand id ──────────────────────────────────────────── */
/* The BVO brand is 'ER Vanities'; RFLPOS still calls it 'Ethan Roth'. Resolved
   by name through the proxy's existing brands action and cached in
   sync_settings.json, so there is no magic number in this file and a rename on
   the RFLPOS side surfaces as a clear error rather than a silent empty feed. */
const RFLPOS_BRAND_NAMES = ['ethan roth', 'er vanities'];

async function resolveBrandIds() {
  const syncSettings = require('../services/syncSettings');
  const cached = syncSettings.get().ervBrandIds;
  if (Array.isArray(cached) && cached.length) return cached;

  const token = process.env.BVO_SYNC_TOKEN || '';
  const ctrl  = new AbortController();
  const t     = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let data;
  try {
    const res = await fetch(
      `${PROXY_BASE}?${new URLSearchParams({ token, action: 'brands' })}`,
      { signal: ctrl.signal }
    );
    data = await res.json();
  } finally {
    clearTimeout(t);
  }
  if (!data || !data.ok || !Array.isArray(data.brands)) {
    throw new Error('Could not read brands from the proxy');
  }

  const ids = data.brands
    .filter(b => RFLPOS_BRAND_NAMES.includes(String(b.name || '').trim().toLowerCase()))
    .map(b => Number(b.id))
    .filter(Boolean);

  if (!ids.length) {
    throw new Error(
      'No RFLPOS brand matched ' + JSON.stringify(RFLPOS_BRAND_NAMES) +
      '. Brands seen: ' + data.brands.map(b => b.name).join(', ')
    );
  }
  syncSettings.save({ ervBrandIds: ids });
  return ids;
}

/* ── the run ──────────────────────────────────────────────────────────────── */
async function run({ dryRun = false } = {}) {
  const summary = {
    feedRows: 0, matched: 0, written: 0,
    notInBvo: [], notInFeed: [], rejected: [], duplicateSku: [],
    localVsAll: [], zeroed: 0, zeroSkus: [],
    flooredQty: [], negativeQty: [], dryRun,
  };
  let logId = null;

  try {
    logId = await startLog();

    const brandIds = await resolveBrandIds();
    const items    = await fetchInventory(brandIds);
    summary.feedRows = items.length;

    /* GUARD 1 — an empty feed is never a legitimate instruction to zero the
       catalogue. A dropped brand filter, a renamed column or a truncated
       response all arrive looking like this. */
    if (!items.length) {
      throw new Error('GUARD: the feed returned zero rows — refusing to write anything');
    }

    /* Collapse to one entry per sku. A product with two variations arrives as
       two rows; that is the multi-variation case the brief warned about, so it
       is FLAGGED and skipped rather than summed or arbitrarily picked. */
    const bad    = [];
    const bySku  = new Map();
    const dupes  = new Set();
    for (const row of items) {
      const r = readRow(row, bad);
      if (!r) continue;
      if (bySku.has(r.sku)) { dupes.add(r.sku); continue; }
      bySku.set(r.sku, r);
    }
    for (const sku of dupes) { bySku.delete(sku); summary.duplicateSku.push(sku); }
    summary.rejected = bad;

    /* What BVO holds for this brand. */
    const [bvoRows] = await db().query(
      `SELECT p.id, p.sku, p.rflpos_item_id
         FROM products p
        WHERE p.brand = ?
          AND p.rflpos_item_id IS NOT NULL
          AND p.rflpos_item_id <> ''`,
      [BRAND]
    );
    const byKey = new Map(bvoRows.map(r => [String(r.rflpos_item_id).trim(), r]));

    /* Pair them up. */
    const writes = [];
    for (const [sku, r] of bySku) {
      const product = byKey.get(sku);

      /* Report the adjustment BEFORE the no-BVO-product branch. An adjusted row
         that matches nothing in BVO is still the data oddity worth seeing — SKU
         100376 arrived at -0.6 and is not one of the 78, and dropping it from
         the log just because it has no product here would hide the only
         evidence that the POS side is producing negatives at all. */
      if (r.adjusted) {
        const line = `${sku}  (${product ? product.sku : 'no BVO product'})  ` +
                     `feed ${r.rawLocal} → ${r.qtyLocal}`;
        (r.adjusted === 'negative' ? summary.negativeQty : summary.flooredQty).push(line);
      }

      if (!product) { summary.notInBvo.push(sku); continue; }
      writes.push({ product, ...r });
      if (r.qtyAll != null && r.qtyAll !== r.qtyLocal) {
        summary.localVsAll.push(`${sku}: sellable ${r.qtyLocal}, all locations ${r.qtyAll}`);
      }
    }
    for (const [key] of byKey) { if (!bySku.has(key)) summary.notInFeed.push(key); }

    summary.matched  = writes.length;
    /* Named, not just counted. A zero-stock SKU keeps its product page but
       drops out of the bundle builder (bundleController requires qty > 0), so
       "9 went to zero" is not actionable without knowing which 9. The BVO sku
       is carried alongside the key because the key is opaque — 'PR1004' says
       nothing; 'London-59.5S-DOAK-MB' is a cabinet you can picture. */
    const zeros      = writes.filter(w => w.qtyLocal === 0);
    summary.zeroed   = zeros.length;
    summary.zeroSkus = zeros.map(w => `${w.sku}  (${w.product.sku})`);

    /* GUARD 2 — nothing matched, so the key convention has drifted. Writing
       nothing is correct; reporting success is not. */
    if (!writes.length) {
      throw new Error(
        `GUARD: ${bySku.size} feed rows and ${byKey.size} BVO products, but zero matched — ` +
        'the rflpos_item_id convention has drifted; refusing to write'
      );
    }

    /* GUARD 3 — a mass zeroing is far more likely to be a broken query than a
       real sell-out. Abort with the figure so it can be read and judged. */
    const zeroShare = summary.zeroed / writes.length;
    if (zeroShare > ZERO_FLOOR) {
      throw new Error(
        `GUARD: ${summary.zeroed} of ${writes.length} matched SKUs would go to zero ` +
        `(${(zeroShare * 100).toFixed(0)}%, ceiling ${(ZERO_FLOOR * 100).toFixed(0)}%) — ` +
        'refusing to write. Check the is_local flags and the feed query.'
      );
    }

    /* Write. Quantity only, through the shared upsert, which creates the row
       when it is missing — the 2026-09-05 ER Vanities load created no
       inventory rows at all, so a plain UPDATE would have silently affected
       zero rows for all 78. */
    if (!dryRun) {
      for (const w of writes) {
        await upsertInventory(db(), w.product.id, w.qtyLocal);
        summary.written++;
      }
    }

    await finishLog(logId, summary.written, bad.length, formatSummary(summary));
    return summary;
  } catch (err) {
    await finishLog(logId, 0, 1, err.message + '\n\n' + formatSummary(summary));
    throw err;
  }
}

function formatSummary(s) {
  const lines = [
    `feed rows                 ${s.feedRows}`,
    `matched to a BVO product  ${s.matched}`,
    `quantities written        ${s.written}${s.dryRun ? ' (dry run — nothing written)' : ''}`,
    `at zero sellable stock    ${s.zeroed}`,
  ];
  const list = (label, arr) => {
    if (!arr.length) return;
    lines.push(`${label} (${arr.length}):`);
    arr.slice(0, 40).forEach(x => lines.push(`   ${x}`));
    if (arr.length > 40) lines.push(`   ...and ${arr.length - 40} more`);
  };
  list('AT ZERO SELLABLE STOCK',    s.zeroSkus);
  /* Both of these are quantities BVO now holds that RFLPOS never actually sent.
     Named individually, with the figure the feed displayed, because "3 rows
     were adjusted" tells nobody which cabinet to go and count. */
  list('NEGATIVE AT SOURCE, written as 0', s.negativeQty);
  list('fractional at source, floored',    s.flooredQty);
  list('in RFLPOS, no BVO product', s.notInBvo);
  list('in BVO, absent from feed',  s.notInFeed);
  list('rejected rows',             s.rejected);
  list('MULTI-VARIATION, skipped',  s.duplicateSku);
  list('sellable < all locations',  s.localVsAll);
  return lines.join('\n');
}

/* readRow and the two thresholds are exported so the gate can execute them
   rather than grep for them. run() needs a database and the proxy, so the
   guards are gated through their inputs: readRow for per-row rejection, and
   the constants for the two whole-run aborts. */
module.exports = { run, __test: { readRow, ZERO_FLOOR, QTY_CEILING, formatSummary } };

/* CLI: node src/jobs/ervInventorySync.js [--dry] */
if (require.main === module) {
  run({ dryRun: process.argv.includes('--dry') })
    .then(s => { console.log(formatSummary(s)); process.exit(0); })
    .catch(e => { console.error('ervInventorySync FAILED: ' + e.message); process.exit(1); });
}
