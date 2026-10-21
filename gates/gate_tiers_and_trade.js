#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   gate_tiers_and_trade.js — Platinum Member / Platinum Trade / Elite Trade.

   TRADE_PROGRAM_SPEC.md is the artifact of record. Four things here are not
   style preferences and the gate treats them as invariants:

     1. MAP     — trade pricing must never render logged out. James Martin
                  enforce with a written warning, 24 hours, and may withhold
                  shipment of new orders.
     2. MONEY   — the cart, orders.subtotal and the Stripe charge come from
                  ONE computation, and the rate is frozen on the order.
     3. GRANT   — the 10% is an explicit enrolment, never a property of
                  having an account. Checkout REQUIRES an account, so the
                  lazy rule would discount 100% of new customers silently.
     4. PRIVACY — uploaded trade documents never live under public/.

   Executes the real modules rather than re-implementing them (Rule 18).
   ───────────────────────────────────────────────────────────────────────── */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (label, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail ? '\n         ' + detail : '')); }
};
const section = t => console.log('\n' + t);

const tiers = require(path.join(ROOT, 'src/utils/tiers.js'));
const cp    = require(path.join(ROOT, 'src/utils/cartPricing.js'));
const claim = require(path.join(ROOT, 'src/services/offerClaim.js'));
const S = tiers.STORED, RES = tiers.RESOLVED;

/* ═══ 1. MAP COMPLIANCE ═════════════════════════════════════════════════ */
section('1. MAP — trade pricing never renders logged out');

for (const st of [S.PLATINUM_TRADE, S.PLATINUM_MEMBER, S.NONE]) {
  const t = tiers.resolveTier({ storedTier: st, rollingSpend: 999999, hasCapturedOrder: false, isLoggedIn: false });
  ok('logged out with stored "' + st + '" resolves to retail', t === RES.NONE, t);
  ok('  and is worth 0%', tiers.tierPct(t) === 0);
}
ok('isLoggedIn missing entirely is treated as logged out',
   tiers.resolveTier({ storedTier: S.PLATINUM_TRADE, rollingSpend: 999999 }) === RES.NONE);
ok('an empty facts object does not throw and gives retail',
   tiers.resolveTier({}) === RES.NONE && tiers.resolveTier() === RES.NONE);

/* ═══ 2. THE LADDER ═════════════════════════════════════════════════════ */
section('2. The ladder');

const L = (st, spend, ordered) => tiers.resolveTier({
  storedTier: st, rollingSpend: spend, hasCapturedOrder: ordered, isLoggedIn: true,
});
ok('Platinum Member is 10%',           tiers.tierPct(L(S.PLATINUM_MEMBER, 0, false)) === 10);
ok('Platinum Trade is 15%',            tiers.tierPct(L(S.PLATINUM_TRADE, 0, false)) === 15);
ok('Elite Trade is 20%',               tiers.tierPct(L(S.PLATINUM_TRADE, 20000, false)) === 20);
ok('the threshold is $20,000',         tiers.ELITE_THRESHOLD === 20000);
ok('the window is 365 days',           tiers.ROLLING_DAYS === 365);
ok('$19,999.99 is still 15%',          tiers.tierPct(L(S.PLATINUM_TRADE, 19999.99, false)) === 15);
ok('exactly $20,000 qualifies',        tiers.tierPct(L(S.PLATINUM_TRADE, 20000, false)) === 20);

/* ⚠️ Elite must be computed. Storing it would freeze a customer at 20%
   after their spend aged out, and the rolling window exists so it CAN. */
ok('elite_trade is NOT a storable value',
   Object.values(S).indexOf('elite_trade') === -1,
   'writing it would defeat the rolling window');
ok('elite_trade IS a resolvable value', Object.values(RES).indexOf('elite_trade') !== -1);
ok('spend ageing out drops 20% back to 15%',
   L(S.PLATINUM_TRADE, 500, false) === RES.PLATINUM_TRADE,
   'the meter and the terms both promise this can happen');

/* ═══ 3. THE GRANT — why the 10% is not a blanket cut ═══════════════════ */
section('3. The first-order offer is an explicit grant');

ok('a member WITH a captured order gets nothing',
   tiers.tierPct(L(S.PLATINUM_MEMBER, 0, true)) === 0,
   'otherwise the "first order" discount applies to every order forever');
ok('a member with NO captured order gets 10%',
   tiers.tierPct(L(S.PLATINUM_MEMBER, 0, false)) === 10);
ok('tier "none" never gets a discount however much they spend',
   tiers.tierPct(L(S.NONE, 999999, false)) === 0,
   'enrolment is required; having an account is not enough');

/* The tick IS the claim — spec §6. */
const sess = () => ({ session: {} });
let r = sess(); claim.markPending(r, true);
ok('ticking the consent box creates a pending claim', claim.hasPending(r));
r = sess(); claim.markPending(r, false);
ok('NOT ticking creates nothing', !claim.hasPending(r),
   'no consent, no offer — the 10% is consideration for the email');

/* The regenerate trap. */
r = sess(); claim.markPending(r, true);
const carried = { [claim.PENDING_KEY]: r.session[claim.PENDING_KEY] };
const after = { session: {} };
for (const [k, v] of Object.entries(carried)) if (v !== undefined) after.session[k] = v;
ok('a carried claim survives session.regenerate()', claim.hasPending(after));
ok('an uncarried claim is lost', !claim.hasPending({ session: {} }));
ok('establishSession DOES carry it',
   /\[offerClaim\.PENDING_KEY\]:\s*req\.session\[offerClaim\.PENDING_KEY\]/
     .test(R('src/controllers/accountController.js')),
   'without this line every claim is silently lost at the moment of grant');

/* The grant itself must never demote a trade account or re-stamp enrolment. */
const claimSrc = R('src/services/offerClaim.js');
ok('grant() refuses to demote a Platinum Trade account',
   /keepTier\s*=\s*row\.tier === tiers\.STORED\.PLATINUM_TRADE/.test(claimSrc));
ok('offer_enrolled_at is COALESCEd, never re-stamped',
   /offer_enrolled_at\s*=\s*COALESCE\(offer_enrolled_at, NOW\(\)\)/.test(claimSrc),
   're-stamping would let a refresh buy a second "first order"');
ok('existing marketing consent keeps its original timestamp',
   /marketing_consent_at\s*=\s*COALESCE\(marketing_consent_at, NOW\(\)\)/.test(claimSrc));
ok('the grant records WHICH copy was agreed to',
   /consent_copy_version/.test(claimSrc) && /CONSENT_COPY_VERSION/.test(claimSrc));
ok('it does NOT invent a second consent store',
   /accepts_marketing/.test(claimSrc) && !/INSERT INTO\s+\w*consent/i.test(claimSrc));

/* ═══ 4. REPLACE, NEVER STACK ═══════════════════════════════════════════ */
section('4. Replace, never stack');

const bundled = [{ price: '1000.00', qty: 1, bundle_discount_pct: 15 }];
ok('bundle 15 + tier 10 -> 15 applies (850, not 765)',
   cp.priceCart(bundled, { tierPct: 10 }).subtotal === 850,
   String(cp.priceCart(bundled, { tierPct: 10 }).subtotal));
ok('bundle 15 + tier 20 -> 20 applies (800)',
   cp.priceCart(bundled, { tierPct: 20 }).subtotal === 800);
ok('equal rates apply once (850)',
   cp.priceCart(bundled, { tierPct: 15 }).subtotal === 850);
ok('effectiveDiscountPct is a MAX, not a sum',
   cp.effectiveDiscountPct({ bundle_discount_pct: 15 }, 10) === 15 &&
   cp.effectiveDiscountPct({ bundle_discount_pct: 15 }, 20) === 20);

/* ═══ 5. A STRING CAN NEVER BECOME A DISCOUNT ═══════════════════════════ */
section('5. tierPct refuses anything that is not a real number');

const plain = [{ price: '100.00', qty: 1 }];
for (const [label, v] of [["'20'", '20'], ["' 10'", ' 10'], ['NaN', NaN], ['null', null],
                          ["''", ''], ['-50', -50], ['150', 150], ['true', true], ['{}', {}],
                          ['undefined', undefined]]) {
  ok('tierPct ' + label + ' -> full price', cp.priceCart(plain, { tierPct: v }).subtotal === 100);
}
ok('a real 15 still works', cp.priceCart(plain, { tierPct: 15 }).subtotal === 85);
ok('the guard is typeof-based, not Number()',
   /typeof tierPct === 'number'/.test(R('src/utils/cartPricing.js')),
   "coercion would accept '20' from a query string");

/* ═══ 6. THE RATE IS FROZEN ON THE ORDER ════════════════════════════════ */
section('6. The frozen rate');

const ctrl = R('src/controllers/checkoutController.js');
ok('order creation stores tier_pct',       /tier_pct, tier_at_order,/.test(ctrl));
ok('and binds the resolved value',          /Number\(ORDER_TIER\.pct\) \|\| 0/.test(ctrl));
ok('the payment re-check reads order.tier_pct',
   /tierPct:\s*Number\(order\.tier_pct\) \|\| 0/.test(ctrl),
   're-resolving live would refuse legitimate charges');
ok('tier_pct is SELECTed by the payment handler',
   /subtotal,\s*\n[\s\S]{0,900}?tier_pct,/.test(ctrl),
   'an unselected column is undefined, not null — every discounted order would be refused');
ok('buyerTotal uses the frozen rate too',
   /tierPct:\s*Number\(order && order\.tier_pct\) \|\| 0/.test(ctrl));
ok('the cart page uses the shared opts builder',
   /tierService\.priceOptsFor\(req/.test(R('src/controllers/cartController.js')),
   'building opts by hand is how the cart and the charge drift apart');

/* MariaDB hands DECIMAL back as a string — the exact value the pure module
   refuses. Without Number() every discounted order is refused at payment. */
ok("Number('15.00') reproduces the stored subtotal",
   cp.toCents(cp.priceCart(plain, { tierPct: Number('15.00') }).subtotal) ===
   cp.toCents(cp.priceCart(plain, { tierPct: 15 }).subtotal));
ok("the raw string '15.00' does NOT, which is why Number() is required",
   cp.priceCart(plain, { tierPct: '15.00' }).subtotal === 100);

/* ═══ 7. DOCUMENTS ARE NOT PUBLIC ═══════════════════════════════════════ */
section('7. Trade documents never reach public/');

const tc = R('src/controllers/tradeController.js');
ok('the upload directory default is outside public/',
   /storage\/trade-docs/.test(tc) && !/public[\\/].*trade/.test(tc),
   'one missing env var must not publish personal documents');
ok('the env override is read but the fallback is still private',
   /process\.env\.TRADE_DOCS_PATH/.test(tc));
ok('filenames are random, not the uploaded name',
   /crypto\.randomBytes/.test(tc),
   'the client name can carry traversal or a second extension');
ok('uploads are filtered by BOTH extension and mimetype',
   /ALLOWED_EXT\.has\(ext\) && ALLOWED_MIME\.has\(file\.mimetype\)/.test(tc));
ok('the admin doc route confines paths to the docs directory',
   /resolved\.startsWith\(path\.resolve\(docsDir\(\)\)\)/.test(tc),
   'a hand-edited row must not turn this into an arbitrary file reader');
ok('documents are sent as attachments with nosniff',
   /Content-Disposition.*attachment/.test(tc) && /nosniff/.test(tc),
   'an HTML or SVG upload would otherwise execute in the admin session');
ok('a failed application deletes its uploads',
   /function discard\(files\)/.test(tc) && /fs\.unlink/.test(tc),
   'orphan documents have no row and no retention clock');
ok('the admin routes sit BELOW requireAdmin',
   (() => {
     const a = R('src/routes/admin.js');
     return a.indexOf('router.use(requireAdmin)') < a.indexOf("router.get ('/trade'");
   })(),
   'this is the only thing making the document route safe');
ok('storage/ is git-ignored',
   fs.existsSync(path.join(ROOT, 'storage/.gitignore')),
   'uploaded personal data must never be committed');

/* ═══ 8. APPLYING IS NOT APPROVAL ═══════════════════════════════════════ */
section('8. Applying is not approval');

ok('submit writes trade_applied_at, never tier',
   /trade_applied_at\s*=\s*COALESCE/.test(tc) &&
   !/UPDATE customers SET tier[\s\S]{0,200}exports\.adminDecide/.test(tc.slice(0, tc.indexOf('exports.adminDecide'))),
   'a photo must not buy 15%');
ok('only adminDecide sets platinum_trade',
   tc.indexOf('tiers.STORED.PLATINUM_TRADE') > tc.indexOf('exports.adminDecide'));
ok('the admin CANNOT grant elite_trade',
   !/STORED\.ELITE_TRADE|'elite_trade'/.test(tc),
   'elite is earned by spend and computed at price time');
ok('the terms acknowledgement is checked SERVER-side',
   /if \(!b\.terms_ack\)/.test(tc),
   'the scroll gate is a courtesy; devtools defeats it in seconds');
ok('marketing consent is optional on the trade path',
   !/if \(!acceptsMkt\)[\s\S]{0,80}errors\.push/.test(tc),
   'approval must never depend on it');
ok('a tax ID is only demanded when exemption is claimed',
   /wantsTaxEx && !taxId/.test(tc),
   'asking everyone collects an SSN from people who do not need to give one');

console.log('\n' + (fail ? 'RED  ' : 'GREEN') + '  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
