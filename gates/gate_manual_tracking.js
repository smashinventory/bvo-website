#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_manual_tracking.js
 *
 * Manual tracking entry for vendor-shipped orders, and the one rule the
 * whole feature exists to keep: WHAT THE CUSTOMER IS TOLD ABOUT DELIVERY
 * FOLLOWS product_type AND NOTHING ELSE.
 *
 * ⚠️ THIS GATE *RUNS* src/utils/shipMode.js RATHER THAN RE-DESCRIBING IT.
 * A gate that re-implements its subject agrees with the bug: if the rule
 * and the check are written twice, a wrong rule and a wrong check match
 * perfectly. So the behavioural section below calls the real functions
 * with real row shapes and asserts the real answers. Only the structural
 * section greps, and only for things that cannot be executed (a form
 * field, a SQL fragment).
 *
 * THE DEFECTS THIS LOCKS DOWN, all found 2026-10-26/27:
 *   1. One set of delivery copy, written for freight, shown to parcel
 *      customers — "the carrier will call you to arrange an appointment"
 *      for a UPS box that gets left at the door.
 *   2. Two booking paths writing different columns: shippingController
 *      writes pro_number, ordersController writes tracking_number.
 *      getOrderTracking read pro_number alone, so every order-page
 *      booking showed the customer NO Track button at all.
 *   3. `https://wwex.com/track/<n>` hardcoded into the shipped email and
 *      the admin panel for every carrier — dead for FedEx and UPS.
 *   4. The WWEX status poll would overwrite a hand-entered status with a
 *      lookup failure if manual rows were not excluded.
 *
 * Run:  node gates/gate_manual_tracking.js
 * Exit: 0 = pass, 1 = fail
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const shipMode = require(path.join(ROOT, 'src/utils/shipMode'));

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const strip = s => s.replace(/<%#[\s\S]*?%>/g, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '')
                    .replace(/^\s*\/\/.*$/gm, '');

console.log('\ngate_manual_tracking — mode decides the promise, and nothing else does\n');

/* ═══ 1. MODE, EXECUTED ══════════════════════════════════════════════ */
console.log('--- mode comes from product_type (running the real function) ---');
{
  /* The FedEx pair is the whole point: one name, two networks. If mode
     were ever keyed on the carrier string these two would agree, and one
     of them would be a lie told to a customer. */
  const fedexParcel  = { product_type: 'SMALLPACK', carrier: 'FedEx Ground',  tracking_number: '794657320123' };
  const fedexFreight = { product_type: 'LTL',       carrier: 'FedEx Freight', pro_number: '123456789' };

  check(shipMode.isParcel(fedexParcel) === true,
        'FedEx Ground is parcel');
  check(shipMode.isParcel(fedexFreight) === false,
        'FedEx Freight is freight',
        'same carrier name, opposite network — the name cannot decide this');
  check(shipMode.mode(fedexParcel) !== shipMode.mode(fedexFreight),
        'the two FedEx shipments get DIFFERENT modes');

  /* Anything that is not explicitly SMALLPACK must be freight. Wrongly
     promising an appointment costs a redelivery; wrongly promising a
     doorstep drop leaves a pallet on a driveway with nobody home. */
  for (const bad of [undefined, null, '', '  ', 'smallpak', 'PARCEL', 'ltl']) {
    check(shipMode.isParcel({ product_type: bad }) === false,
          `product_type ${JSON.stringify(bad)} is treated as freight`,
          'the safe direction is the one that promises a phone call');
  }
  check(shipMode.isParcel({ product_type: ' smallpack ' }) === true,
        'SMALLPACK is matched case- and whitespace-insensitively');
}

/* ═══ 2. THE NUMBER, FROM EITHER COLUMN ══════════════════════════════ */
console.log('\n--- the tracking number is found whichever path wrote it ---');
{
  check(shipMode.trackingNumber({ pro_number: 'I421887340' }) === 'I421887340',
        'reads pro_number (shippingController / WWEX path)');
  check(shipMode.trackingNumber({ tracking_number: '794657320123' }) === '794657320123',
        'reads tracking_number (ordersController path)',
        'this is the one that returned nothing and cost every order-page ' +
        'booking its Track button');
  check(shipMode.trackingNumber({ pro_number: 'PRO1', tracking_number: 'TN2' }) === 'PRO1',
        'pro_number wins when both are set');
  check(shipMode.trackingNumber({ pro_number: '   ', tracking_number: 'TN2' }) === 'TN2',
        'a whitespace-only pro_number falls through rather than winning',
        "'' and '   ' are what an empty form field writes");
  check(shipMode.trackingNumber({}) === null,
        'no number at all is null, not an empty string');

  check(shipMode.isTrackable({ product_type: 'LTL', pro_number: 'X', status: 'in_transit' }) === true,
        'a moving shipment with a number is trackable');
  check(shipMode.isTrackable({ product_type: 'LTL', pro_number: 'X', status: 'voided' }) === false,
        'a VOIDED shipment is never trackable',
        'the Track button must not appear on a cancelled booking');
  check(shipMode.isTrackable({ product_type: 'LTL', status: 'booked' }) === false,
        'booked with no number yet is not trackable');
}

/* ═══ 3. THE LINK — NEVER GUESSED ════════════════════════════════════ */
console.log('\n--- the tracking link is trustworthy or absent ---');
{
  const pasted = shipMode.trackingUrl({
    carrier: 'FedEx', tracking_number: '1', tracking_url: 'https://vendor.example/t/9' });
  check(pasted === 'https://vendor.example/t/9',
        'a pasted URL wins over every built-in template',
        'carrier URL formats rot; a pasted link cannot');

  check(shipMode.trackingUrl({ carrier: 'Some Regional LTL', pro_number: 'ABC' }) === null,
        'an unknown carrier gets NO link rather than a guessed one',
        'a wrong tracking link reads as a lost shipment');
  check(shipMode.trackingUrl({ carrier: '', pro_number: 'ABC' }) === null,
        'no carrier means no link');
  check(shipMode.trackingUrl({ carrier: 'UPS' }) === null,
        'no number means no link');

  /* The value lands in an href on a customer page. */
  for (const nasty of ['javascript:alert(1)', 'data:text/html,x', 'JaVaScRiPt:x', '//evil.example']) {
    const out = shipMode.trackingUrl({ carrier: 'Nobody', tracking_number: '1', tracking_url: nasty });
    check(out === null, `tracking_url ${JSON.stringify(nasty)} is rejected`,
          'this string would be rendered straight into an href');
  }

  const ups = shipMode.trackingUrl({ carrier: 'UPS Ground', tracking_number: '1Z999AA10123456784' });
  check(/^https:\/\/www\.ups\.com\//.test(ups), 'a known carrier builds an https link');

  /* The hardcoded host that was in the email and the admin panel. */
  for (const f of ['src/utils/shipMode.js', 'src/controllers/ordersController.js',
                   'views/pages/admin/orders/detail.ejs']) {
    check(!/wwex\.com\/track/.test(strip(read(f))),
          `${path.basename(f)} has no hardcoded wwex.com/track link`,
          'that URL was sent to every customer regardless of carrier');
  }
}

/* ═══ 4. THE ENTRY FORM ══════════════════════════════════════════════ */
console.log('\n--- the entry form cannot default the mode ---');
{
  const view = strip(read('views/pages/admin/orders/detail.ejs'));
  check(/name="product_type"[^>]*value="LTL"/.test(view) &&
        /name="product_type"[^>]*value="SMALLPACK"/.test(view),
        'both modes are offered');
  check(/name="product_type"[^>]*required/.test(view),
        'choosing a mode is REQUIRED',
        'product_type defaults to LTL in the schema — accepting that ' +
        'default is what made every parcel look like freight');
  check(/action="\/admin\/orders\/<%= order\.id %>\/tracking"/.test(view),
        'the form posts to the save endpoint');
  check(/\/tracking\/notify/.test(view),
        'sending the email is a SEPARATE form',
        'an email cannot be unsent; a typo must be catchable first');
  /* CSP refuses inline handlers silently — that is how destructive admin
     buttons lost their confirmations before. */
  const block = view.slice(view.indexOf('name="product_type"'));
  check(!/\son(submit|click|change)=/i.test(block.slice(0, 4000)),
        'no inline event handlers in the tracking form',
        'CSP drops them without a console error');
}

/* ═══ 5. THE HANDLER ═════════════════════════════════════════════════ */
console.log('\n--- the save handler validates, upserts and never emails ---');
{
  const ctrl = strip(read('src/controllers/ordersController.js'));
  const save = ctrl.slice(ctrl.indexOf('exports.saveTracking'),
                          ctrl.indexOf('exports.notifyTracking'));
  check(save.length > 200, 'saveTracking found');
  check(/!==\s*'LTL'\s*&&[\s\S]{0,40}!==\s*'SMALLPACK'/.test(save),
        'product_type is validated against the ENUM',
        'MySQL stores an EMPTY STRING for an out-of-ENUM value in ' +
        'non-strict mode — the row then vanishes from every filter');
  check(/sendTemplate|brevo\./.test(save) === false,
        'saveTracking sends NO email',
        'save and send are two buttons on purpose');
  check(/entry_source/.test(save) && /'manual'/.test(save),
        'the row is marked as hand-entered');
  check(/pro_number[\s\S]{0,80}tracking_number/.test(save),
        'BOTH number columns are written',
        'so no reader has to know which path produced the row');
  check(/UPDATE shipments/.test(save) && /INSERT INTO shipments/.test(save),
        'it upserts',
        'shipments.order_id is UNIQUE — a second save corrects the first');
  check(/entry_source\s*!==\s*'manual'/.test(save),
        'it refuses to overwrite a real WWEX booking',
        'that booking carries the id needed to void it at the carrier');

  const notify = ctrl.slice(ctrl.indexOf('exports.notifyTracking'));
  check(/isTrackable/.test(notify),
        'notifyTracking refuses to mail an untrackable shipment');
  check(/your vanity/.test(notify) === false,
        'the email has no "your vanity" fallback',
        'the same freight-shaped assumption, applied to a box of faucets');
  check(/delivery_note/.test(notify) && /appointment/.test(notify),
        'the email is given mode-correct delivery wording');
}

/* ═══ 6. THE POLL LEAVES MANUAL ROWS ALONE ═══════════════════════════ */
console.log('\n--- the WWEX poll skips hand-entered shipments ---');
{
  const poll = strip(read('src/jobs/shipmentStatusPoll.js'));
  check(/entry_source\s*=\s*'wwex'/.test(poll),
        'the poll query filters to entry_source = wwex',
        'a manual row has no product_transaction_id; polling it would ' +
        'overwrite a deliberate status with a lookup failure');
}

/* ═══ 7. THE CUSTOMER QUERY ACCEPTS EITHER COLUMN ════════════════════ */
console.log('\n--- the customer tracking query is not pro_number-only ---');
{
  const model = strip(read('src/models/Customer.js'));
  const q = model.slice(model.indexOf('async getOrderTracking'));
  /* ⚠️ ASSERTED ON THE *WHERE CLAUSE*, NOT ON THE METHOD BODY.
     The first version of this check grepped the whole method for
     'tracking_number' and MISSED its own mutation: reverting the WHERE
     to pro_number-only leaves tracking_number sitting in the SELECT
     list, so the grep still matched. The SELECT decides what is
     returned; the WHERE decides whether a row is returned at all, and
     the defect was entirely in the WHERE. */
  const where = q.slice(q.indexOf('WHERE'), q.indexOf('ORDER BY'));
  check(where.includes('tracking_number'),
        'the WHERE clause accepts EITHER number column',
        'requiring pro_number alone hid the Track button on every ' +
        'order-page booking');
  check(!/AND\s*\(s\.pro_number IS NOT NULL AND s\.pro_number <> ''\)/.test(where),
        'the WHERE is not pro_number-only');
  check(/tracking_url/.test(q) && /entry_source/.test(q),
        'it selects the columns the views need');
}

console.log(fail ? `\n*** ${fail} of ${pass + fail} CHECKS FAILED ***`
                 : `\nALL ${pass} CHECKS PASS`);
process.exit(fail ? 1 : 0);
