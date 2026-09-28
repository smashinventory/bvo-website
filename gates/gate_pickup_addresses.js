'use strict';
/* Gates for saved pickup addresses, 2026-09-28.
 *
 * WHAT IS AT STAKE
 *
 * The origin is the address a FREIGHT CARRIER IS DISPATCHED TO. Wrong
 * here means a truck at the wrong dock and a missed pickup window —
 * and the failure surfaces on the day, not at save time. So the
 * assertions below are about the things that produce a silently wrong
 * booking rather than a visible error:
 *
 *   - the dropdown filling some fields but not others
 *   - the form locking a field an operator needs to correct
 *   - a deleted address orphaning a historic shipment
 *   - the origin phone missing, which WWEX rejects at booking
 *   - an auto-select rule reappearing, which the owner ruled out
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const executable = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/* EJS comments stripped before asserting on rendered markup. */
const visible = src => src
  .replace(/<%\/\*[\s\S]*?\*\/%>/g, '').replace(/<%#[\s\S]*?%>/g, '');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const ctl    = read('src/controllers/pickupAddressController.js');
const ctlX   = executable(ctl);
const create = read('views/pages/admin/shipping/create.ejs');
const admin  = read('views/pages/admin/shipping/pickup-addresses.ejs');
const ship   = executable(read('src/controllers/shippingController.js'));
const routes = executable(read('src/routes/admin.js'));
const mig    = read('migrations/2026-09-28_pickup_addresses_RUNME.sql');

/* ═══ 1. THE DROPDOWN FILLS EVERY FIELD WWEX NEEDS ═════════════════ */
console.log('--- the dropdown fills a complete origin ---');
/* A partial fill is the dangerous failure: the form looks populated,
   the operator books, and WWEX rejects on a missing phone — or worse,
   accepts with a stale ZIP from the previous selection. */
for (const id of ['orig_company', 'orig_phone', 'orig_address1', 'orig_address2',
                  'orig_city', 'orig_state', 'orig_zip', 'orig_country']) {
  ok(`applyPickupAddress sets ${id}`,
     new RegExp(`set\\('${id}'`).test(create), 'field left stale from the previous pick');
}
ok('it sets the pickup location type too',
   /orig_locationType.*p\.location_type/s.test(create), 'location type stale');
ok('it runs once on load, not only on change',
   /applyPickupAddress\(\);\s*\n\}\);/.test(create)
   || /DOMContentLoaded[\s\S]{0,400}applyPickupAddress\(\)/.test(create),
   'selected in markup fires no change event — the default would never apply');

/* ═══ 2. IT FILLS, IT DOES NOT LOCK ════════════════════════════════ */
console.log('\n--- operator can still correct a line ---');
const originBlock = create.slice(
  create.indexOf('Origin (Ship From)'),
  create.indexOf('Shipment Date'));
ok('no origin field is readonly',  !/readonly/i.test(originBlock), 'a field cannot be corrected');
ok('no origin field is disabled',  !/disabled/i.test(originBlock), 'a field cannot be corrected');
/* "Other" must not wipe a hand-typed address just because someone
   opened the dropdown and closed it again. */
ok('choosing "Other" leaves the fields alone',
   /if \(!raw\) \{[^}]*return;/.test(create), 'a hand-typed address would be cleared');

/* ═══ 3. EXACTLY ONE DEFAULT, ALWAYS ═══════════════════════════════ */
console.log('\n--- exactly one default ---');
ok('setting a default clears the others',
   /UPDATE pickup_addresses SET is_default = 0 WHERE is_default = 1/.test(ctlX),
   'two defaults — the form would pick arbitrarily');
ok('that happens inside a transaction',
   /beginTransaction\(\)[\s\S]{0,600}is_default = 0 WHERE is_default = 1/.test(ctlX),
   'a window with zero defaults, during which the form prefills nothing');
ok('deactivating a default promotes another',
   (ctlX.match(/SET is_default = 1\s*\n?\s*WHERE is_active = 1 ORDER BY/g) || []).length >= 2,
   'the system could end up with no default at all');
ok('an inactive address cannot stay default',
   /if \(!row\.is_active\)[\s\S]{0,200}is_default = 0/.test(ctlX),
   'the form would preselect an address the dropdown does not offer');

/* ═══ 4. DEACTIVATE, NEVER DELETE ══════════════════════════════════ */
console.log('\n--- history survives ---');
/* shipments.pickup_address_id points at these rows. */
ok('no delete route exists',
   !/pickup-addresses\/:id\/delete/.test(routes), 'a historic shipment would dangle');
ok('the controller exports no delete handler',
   !/exports\.delete|exports\.destroy|exports\.remove/.test(ctlX), 'delete handler present');
ok('deactivate also clears the default flag',
   /is_active = 0, is_default = 0/.test(ctlX), 'an inactive default');
ok('the admin page offers Deactivate, not Delete',
   /Deactivate/.test(visible(admin)) && !/>\s*Delete\s*</.test(visible(admin)),
   'delete button present');

/* ═══ 5. THE SHIPMENT RECORDS WHERE IT LEFT FROM ═══════════════════ */
console.log('\n--- the origin is recorded on the shipment ---');
ok('the booking INSERT carries pickup_address_id',
   /pickup_address_id/.test(ship), 'not persisted');
ok('and a nickname SNAPSHOT, not just the id',
   /pickup_nickname/.test(ship),
   'renaming an address would rewrite what a past shipment says');
ok('the create form sends both',
   /pickupAddressId:/.test(create) && /pickupNickname:/.test(create), 'not sent');
/* The server must book what is ON SCREEN, not what the saved record
   says — the operator may have corrected a line after selecting. */
ok('the address fields are still sent alongside the id',
   /origin: \{[\s\S]{0,400}address1:\s*val\('orig_address1'\)/.test(create),
   'the server would re-read the saved record and ignore corrections');
ok('placeholder columns are in the migration',
   /pickup_address_id INT UNSIGNED NULL/.test(mig) && /pickup_nickname VARCHAR\(80\)/.test(mig),
   'the INSERT would fail on unknown column');

/* ═══ 6. AUTO-SELECT BY VENDOR MUST NOT REAPPEAR ═══════════════════ */
console.log('\n--- no vendor auto-select ---');
/* Owner ruled this out: vendors have several pickup addresses and the
   right one is a manual pre-shipping determination. A rule here would
   be wrong more often than right, and wrong dispatches a truck. */
ok('nothing picks an address from the order/vendor',
   !/vendor_id[\s\S]{0,80}pickup_address/i.test(ship)
   && !/pickup_address[\s\S]{0,80}vendor_id/i.test(ship),
   'an auto-select rule appeared');
/* Matched on a SHORT phrase, not a sentence. The first version of this
   asserted "manually check in the pre-shipping phase" and failed —
   comment wrapping puts a newline and a "-- " between "manually" and
   "check" in the .sql file. The prose is there; the regex was wrong.
   Anchor on the shortest fragment that cannot be broken by wrapping. */
ok('the reasoning is recorded so it is not re-added',
   /pre-shipping phase/i.test(ctl) && /pre-shipping phase/i.test(mig),
   'the next reader will think it was an oversight');

/* ═══ 7. WHAT THE CARRIER REJECTS ══════════════════════════════════ */
console.log('\n--- required fields, validated before the carrier sees them ---');
ok('phone is required on save',
   /\['nickname', 'phone', 'address1', 'city', 'state', 'zip'\]/.test(ctlX),
   'WWEX rejects a booking with no origin phone');
ok('phone is stripped to digits',
   /phone:\s*clean\(b\.phone, 30\)\.replace\(\/\\D\/g, ''\)/.test(ctlX),
   'a formatted number is rejected by the carrier');
ok('state is upper-cased', /state:\s*clean\(b\.state, 2\)\.toUpperCase\(\)/.test(ctlX), 'lowercase state');
/* WWEX IGNORES an unknown locationType rather than erroring, so a typo
   books a standard commercial pickup while the screen says otherwise. */
ok('location_type is allowlisted, not free text',
   /LOCATION_TYPES\.includes\(/.test(ctlX), 'a typo would silently change the pickup type');
ok('the admin form uses a select for it',
   /<select name="location_type"/.test(admin), 'free-text location type');

/* ═══ 8. WIRING ════════════════════════════════════════════════════ */
console.log('\n--- wiring ---');
ok('createForm loads the addresses', /pickupCtrl\.listActive\(\)/.test(ship), 'not loaded');
ok('and passes them to the view', /pickupAddresses,/.test(ship), 'not passed');
ok('listActive returns [] on failure rather than throwing',
   /catch[\s\S]{0,200}return \[\];/.test(ctlX),
   'a database hiccup would take the shipping screen down');
ok('routes are registered', /pickup-addresses',\s+pickupCtrl\.index/.test(routes), 'no route');
ok('the nav links to it', /shipping\/pickup-addresses/.test(read('views/layouts/admin.ejs')), 'unreachable');

/* ═══ 9. MIGRATION ═════════════════════════════════════════════════ */
console.log('\n--- migration ---');
ok('nickname is unique', /UNIQUE KEY uniq_nickname/.test(mig), 'two "RFL Marietta" rows');
ok('the collation is named explicitly',
   /COLLATE=utf8mb4_unicode_ci/.test(mig),
   'the server default differs and produces #1267 on the first text join');
ok('RFL Marietta is seeded', /'RFL Marietta'/.test(mig), 'the current origin would be lost');
ok('the seed matches what was hard-coded',
   /50 Ernest W Barrett Pkwy NW/.test(mig) && /7706352030/.test(mig) && /'30066'/.test(mig),
   'the form would change behaviour on day one');
ok('the seed is re-run safe',
   /WHERE NOT EXISTS \(SELECT 1 FROM pickup_addresses WHERE nickname = 'RFL Marietta'\)/.test(mig),
   'a second run would fail on the unique key');
ok('no INFORMATION_SCHEMA', !/INFORMATION_SCHEMA/i.test(mig.replace(/--.*$/gm, '')),
   'denied on this host — aborts the rest of the file');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
