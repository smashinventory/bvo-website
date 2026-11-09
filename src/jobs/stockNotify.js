'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   stockNotify.js — back-in-stock notices.

   Run:  node src/jobs/stockNotify.js            (sends)
         node src/jobs/stockNotify.js --dry-run  (reports, sends nothing)

   ────────────────────────────────────────────────────────────────────────────
   ⚠️ THIS JOB DETECTS RESTOCKS. IT DOES NOT LISTEN FOR THEM.

   Three separate places write inventory.qty_on_hand:
       src/utils/inventory.js        (the ERV nightly sync)
       src/services/rflposSync.js    (the POS sync)
       src/controllers/adminController.js (manual edits)

   Hooking an event into each of those would mean three chances to forget the
   fourth one somebody adds next year, and a missed hook is invisible — the
   customer simply never hears from us and we never find out. So this job asks
   the database the question directly instead:

       "which pending requests are for products that now have stock?"

   That is idempotent, catches a restock no matter who caused it, and cannot
   silently miss a transition. Run it as often as you like; a request already
   notified has notified_at set and is skipped.

   ────────────────────────────────────────────────────────────────────────────
   ⚠️ SUPPRESSION IS DELIBERATELY NOT CHECKED. READ THIS BEFORE "FIXING" IT.

   cartRecovery.js refuses to email anyone who declined marketing, and that is
   correct there — an abandoned-cart offer is marketing nobody asked for.

   This is the opposite case. Somebody typed their address into a box labelled
   "email me when this is back" about ONE product. That is a fresh, specific,
   affirmative request, and it outranks an older global unsubscribe. It also
   matters that issue #376 means some of those unsubscribes were accidental —
   a one-click link on an auth email currently kills all mail to a customer.

   What the old unsubscribe still blocks is everything ELSE. The opt-in box on
   the form is UNTICKED by default (see src/config/stockNotify.js), so nobody
   is re-subscribed to general marketing without actively asking.

   Owner decision, 2026-11-09, after explicitly weighing the pre-ticked
   alternative and rejecting it.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ⚠️ LAZY. src/config/database.js calls process.exit when DB_PASS is unset,
   so a top-level require makes this module unloadable on a laptop without a
   live .env — and a module the gate cannot LOAD is one it has to
   re-implement, which is how the rules and the gate drift apart. */
function pool() { return require('../config/database').bvoPool; }

const rules      = require('../config/stockNotify');
const unsubToken = require('../utils/unsubscribeToken');

const TEMPLATE_KEY = 'back_in_stock';
const CANON = 'https://www.bathroomvanitiesoutlet.com';

/* ── FIND WHAT IS READY ──────────────────────────────────────────────────
   One query, joined to live inventory. Returns candidates; the DECISION of
   whether each one may be emailed belongs to rules.shouldNotify() so the
   gate can prove it without a database. */
async function findReady(limit = rules.RULES.MAX_PER_RUN) {
  const [rows] = await pool().query(
    `SELECT  n.id, n.product_id, n.sku, n.email, n.created_at, n.notified_at,
             n.marketing_opt_in, n.source_url,
             COALESCE(i.qty_on_hand, 0) AS qty_on_hand,
             p.name  AS product_name,
             p.slug  AS product_slug,
             p.price, p.compare_price, p.is_active
       FROM  stock_notifications n
       JOIN  products  p ON p.id = n.product_id
       LEFT JOIN inventory i ON i.product_id = n.product_id
      WHERE  n.notified_at IS NULL
        AND  p.is_active = 1
      ORDER BY n.created_at ASC
      LIMIT  ?`,
    [Number(limit) * 4]   // over-fetch: most candidates are still out of stock
  );
  return rows;
}

/* ── MARK EXPIRED ────────────────────────────────────────────────────────
   A request nobody could fulfil inside the window is closed, not emailed.
   Stamped rather than deleted so the demand signal survives for reporting —
   "41 people wanted Brittany 36 in Smokey Celadon and we never had it" is
   worth knowing when placing the next order. */
async function expire(ids) {
  if (!ids.length) return 0;
  const [r] = await pool().query(
    `UPDATE stock_notifications
        SET notified_at = NOW()
      WHERE id IN (?) AND notified_at IS NULL`, [ids]);
  return r.affectedRows || 0;
}

function priceLine(row) {
  const price   = Number(row.price);
  const compare = Number(row.compare_price);
  if (!Number.isFinite(price) || price <= 0) return '';
  const now = `$${price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  if (Number.isFinite(compare) && compare > price) {
    const was = `$${compare.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    return `It is ${now}, down from ${was}. Free shipping, usually arrives in 5–10 business days.`;
  }
  return `It is ${now}. Free shipping, usually arrives in 5–10 business days.`;
}

/* ── RUN ─────────────────────────────────────────────────────────────────── */
async function run({ dryRun = false, limit = rules.RULES.MAX_PER_RUN } = {}) {
  const brevo = require('../services/brevoService');
  const started = new Date();

  let candidates;
  try {
    candidates = await findReady(limit);
  } catch (err) {
    console.error('[stock-notify] could not read pending requests:', err.message);
    return { ok: false, error: err.message, sent: 0, expired: 0, skipped: 0 };
  }

  const toSend = [], toExpire = [], skipped = [];

  for (const row of candidates) {
    const verdict = rules.shouldNotify(row, started);
    if (verdict.ok) {
      if (toSend.length < limit) toSend.push(row);
    } else if (verdict.expired) {
      toExpire.push(row.id);
    } else {
      skipped.push({ sku: row.sku, email: row.email, why: verdict.reason });
    }
  }

  if (dryRun) {
    console.log(`[stock-notify] DRY RUN — would send ${toSend.length}, expire ${toExpire.length}, skip ${skipped.length}`);
    for (const r of toSend) console.log(`   send   ${r.sku.padEnd(24)} ${r.email}`);
    for (const s of skipped.slice(0, 10)) console.log(`   skip   ${s.sku.padEnd(24)} ${s.why}`);
    return { ok: true, dryRun: true, sent: 0, wouldSend: toSend.length,
             expired: 0, wouldExpire: toExpire.length, skipped: skipped.length };
  }

  const expired = await expire(toExpire);

  let sent = 0, failed = 0;
  for (const row of toSend) {
    const url   = `${CANON}/products/${row.product_slug}`;
    const token = unsubToken.sign(row.email);

    try {
      await brevo.sendTemplate(TEMPLATE_KEY, row.email, {
        product_name:    row.product_name,
        product_url:     url,
        price_line:      priceLine(row),
        unsubscribe_url: unsubToken.url(row.email, CANON),
      });

      /* ⚠️ STAMPED ONLY AFTER THE SEND RESOLVES. Stamping first would make a
         Brevo outage look like a delivered email and the customer would never
         hear from us. Stamping after risks a double-send if the process dies
         between the two — which is the better failure: one duplicate beats
         one silent loss, and the unique key means it cannot cascade. */
      await pool().query(
        `UPDATE stock_notifications SET notified_at = NOW(), unsub_token = ?
          WHERE id = ? AND notified_at IS NULL`, [token, row.id]);
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`[stock-notify] send failed for ${row.sku} / ${row.email}:`, err.message);
      /* left unstamped on purpose — the next run retries it */
    }
  }

  console.log(`[stock-notify] sent ${sent}, failed ${failed}, expired ${expired}, skipped ${skipped.length} (${candidates.length} pending scanned)`);
  return { ok: failed === 0, sent, failed, expired, skipped: skipped.length, scanned: candidates.length };
}

module.exports = { run, findReady, expire, priceLine, TEMPLATE_KEY };

/* Run directly: node src/jobs/stockNotify.js [--dry-run] */
if (require.main === module) {
  /* See cartRecovery.js for why dotenv is loaded here and only here. */
  try { require('dotenv').config(); } catch { /* dotenv optional */ }

  run({ dryRun: process.argv.includes('--dry-run') })
    .then(r => process.exit(r.ok ? 0 : 1))
    .catch(err => { console.error('[stock-notify] fatal:', err); process.exit(1); });
}
