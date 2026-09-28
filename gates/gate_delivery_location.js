'use strict';
/* Gates for the three-way delivery location, 2026-09-28.
 *
 * THE BUG BEING GUARDED, stated plainly so nobody "simplifies" it back:
 *
 *   ship_address_type was carrying two facts at once — who is at the
 *   address (residential surcharge) and whether they can get a crate off
 *   a trailer (liftgate). shippingController derived BOTH from
 *   `=== 'residential'`, so every commercial address booked with no
 *   liftgate. An office or studio with no dock — which had no honest
 *   option on the form anyway — got a truck that could not unload.
 *
 * The expensive failure is silent: the booking succeeds, the rate looks
 * normal, and it only goes wrong at the kerb three days later. So the
 * liftgate mapping is asserted per value, exhaustively.
 */

const ejs  = require('ejs');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const executable = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/* EJS comments stripped before asserting on anything a BUYER reads —
   this class of false pass has bitten five gates this month. */
const visible = src => src
  .replace(/<%\/\*[\s\S]*?\*\/%>/g, '').replace(/<%#[\s\S]*?%>/g, '');

const DL = require(path.join(ROOT, 'src/utils/deliveryLocation'));

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

/* ═══ 1. THE TRUTH TABLE — EXHAUSTIVE ══════════════════════════════ */
console.log('--- residential + liftgate, per value ---');

const EXPECT = {
  /* value              residential  liftgate */
  residential:        [ true,        true  ],
  commercial_no_dock: [ false,       true  ],
  commercial_dock:    [ false,       false ],
};

for (const [value, [res, lg]] of Object.entries(EXPECT)) {
  ok(`${value} -> residential ${res}`,
     DL.isResidential(value) === res, `got ${DL.isResidential(value)}`);
  ok(`${value} -> liftgate ${lg}`,
     DL.needsLiftgate(value) === lg, `got ${DL.needsLiftgate(value)}`);
}

/* The whole point of the change, stated as its own assertion. */
ok('a dockless commercial address DOES get a liftgate',
   DL.needsLiftgate('commercial_no_dock') === true,
   'THE BUG IS BACK — crate cannot come off the truck');
ok('only the dock option skips the liftgate',
   Object.keys(EXPECT).filter(v => !DL.needsLiftgate(v)).join() === 'commercial_dock',
   'wrong set of values skips the liftgate');

/* ═══ 2. LEGACY ROWS KEEP THEIR MEANING ════════════════════════════ */
console.log('\n--- legacy "commercial" ---');
/* The button those buyers clicked said "a business with a loading dock
   or forklift". Mapping them anywhere else rewrites what they told us. */
ok('legacy commercial -> commercial_dock',
   DL.normalise('commercial') === 'commercial_dock', DL.normalise('commercial'));
ok('legacy commercial keeps NO liftgate',
   DL.needsLiftgate('commercial') === false,
   'historical shipments would silently gain a liftgate');
ok('legacy commercial is NOT residential',
   DL.isResidential('commercial') === false, 'surcharge added retroactively');

/* But a live form post must not be allowed to send it. */
ok('legacy commercial is REJECTED as form input',
   DL.isValid('commercial') === false,
   'a stale cached page could keep submitting an ambiguous value');
for (const v of Object.keys(EXPECT)) {
  ok(`${v} is accepted as form input`, DL.isValid(v) === true, 'rejected');
}
ok('junk is rejected', !DL.isValid('warehouse') && !DL.isValid('') && !DL.isValid(null),
   'accepts anything');

/* ═══ 3. UNKNOWN INPUT FAILS SAFE ══════════════════════════════════ */
console.log('\n--- unknown / null input ---');
/* Residential is conservative in BOTH directions: a liftgate is booked
   (so the crate can always be unloaded) and the residential surcharge
   applies (so the quote is not short). Being wrong the other way
   strands a delivery. */
for (const bad of [null, undefined, '', 'nonsense', 'COMMERCIAL_DOCK ']) {
  const n = DL.normalise(bad);
  ok(`${JSON.stringify(bad)} -> a real type (${n})`,
     Object.prototype.hasOwnProperty.call(DL.TYPES, n), 'not a known type');
}
ok('unknown input still books a liftgate',
   DL.needsLiftgate('nonsense') === true, 'fails DANGEROUS, not safe');
/* Case and whitespace are normalised, not treated as unknown. */
ok('case/whitespace normalised, not defaulted',
   DL.normalise('COMMERCIAL_DOCK ') === 'commercial_dock',
   'a stray space would silently become residential');

/* ═══ 4. EVERY TYPE HAS COPY, AND IT DIFFERS ═══════════════════════ */
console.log('\n--- acknowledgement copy ---');
const acks = DL.ORDER.map(v => DL.acknowledgement(v));
ok('three distinct acknowledgements', new Set(acks).size === 3,
   'two types share a sentence');
ok('every type has a label, detail, short and ack',
   DL.all().every(t => t.label && t.detail && t.short && t.ack), 'missing field');

/* The specific wording the owner asked for. */
ok('residential says driveway or curb',
   /driveway or curb/i.test(DL.acknowledgement('residential')), DL.acknowledgement('residential'));
ok('no-dock says drive or yard',
   /drive or yard/i.test(DL.acknowledgement('commercial_no_dock')),
   DL.acknowledgement('commercial_no_dock'));
ok('dock says yard or dock',
   /yard or dock/i.test(DL.acknowledgement('commercial_dock')),
   DL.acknowledgement('commercial_dock'));

/* A buyer who just told us they own a forklift must not be asked to
   find help carrying it. */
ok('the DOCK ack does NOT say "arrange help"',
   !/arrange help/i.test(DL.acknowledgement('commercial_dock')),
   'asks a warehouse to line up a second pair of hands');
ok('both liftgate types DO say "arrange help"',
   /arrange help/i.test(DL.acknowledgement('residential'))
   && /arrange help/i.test(DL.acknowledgement('commercial_no_dock')),
   'the expectation-gap warning was dropped');

/* ═══ 5. THE FORM RENDERS ALL THREE ════════════════════════════════ */
console.log('\n--- checkout page 1 ---');
const infoView = read('views/pages/checkout-info.ejs');
ok('the radios are rendered from the util, not typed out',
   /DL\.all\(\)\.forEach/.test(infoView), 'hard-coded options will drift');
ok('the selected value is normalised',
   /DL\.normalise\(/.test(infoView), 'a legacy draft would pre-select nothing');
ok('no hard-coded value="commercial"',
   !/value="commercial"/.test(visible(infoView)), 'the ambiguous value is still submittable');

const ctl = executable(read('src/controllers/checkoutController.js'));
ok('validateInfo uses isValid',
   /deliveryLocation\.isValid\(/.test(ctl), 'still a hard-coded array');
ok('the old two-value array is gone',
   !/\['residential',\s*'commercial'\]/.test(ctl), 'third option would be rejected');

/* ═══ 6. THE BOOKING USES THE DERIVED FACTS ════════════════════════ */
console.log('\n--- shipping booking ---');
const ship = executable(read('src/controllers/shippingController.js'));
ok('residential comes from the util',
   /deliveryLocation\.isResidential\(order\.ship_address_type\)/.test(ship), 'not wired');
ok('LIFTGATE is derived, not inferred from residential',
   /liftgate:\s*deliveryLocation\.needsLiftgate\(order\.ship_address_type\)/.test(ship),
   'the original bug');
ok('the raw === comparison is gone',
   !/ship_address_type === 'residential'/.test(ship),
   'two sources for one fact');

const createView = read('views/pages/admin/shipping/create.ejs');
ok('the liftgate box honours the prefill',
   /pre\.liftgate/.test(createView), 'hard-checked regardless of the buyer answer');
ok('it defaults ON when unknown',
   /pre\.liftgate === undefined \|\| pre\.liftgate/.test(createView),
   'an order with no type would book without a liftgate');
/* An unticked liftgate with no explanation looks like an oversight, and
   the operator's safe-looking fix — ticking it — is what discards the
   buyer's answer. The reason has to be on screen next to the box. */
ok('the create form shows what the buyer chose',
   /pre\.addressType/.test(createView) && /Buyer selected/.test(visible(createView)),
   'operator cannot tell a deliberate untick from a missed one');
ok('and spells out the liftgate consequence',
   /NO liftgate, their staff unload it/.test(visible(createView)), 'no consequence stated');
ok('addressType is passed through',
   /addressType:\s*order\.ship_address_type/.test(ship), 'not passed');

/* ═══ 7. EVERY SCREEN LABELS ALL THREE ═════════════════════════════ */
console.log('\n--- labels across the screens ---');
for (const [label, file] of [
  ['delivery page',   'views/pages/checkout-delivery.ejs'],
  ['payment page',    'views/pages/checkout-payment.ejs'],
  ['admin detail',    'views/pages/admin/orders/detail.ejs'],
]) {
  const v = visible(read(file));
  ok(`${label} has no two-way 'commercial' ternary`,
     !/ship_address_type === 'commercial'/.test(v),
     'both new values would be mislabelled');
  ok(`${label} reads from deliveryLocation`,
     /deliveryLocation\./.test(v), 'not wired');
}
/* The rep booking the shipment needs the operational fact, not a label. */
ok('admin detail states the liftgate outcome',
   /liftgate/i.test(visible(read('views/pages/admin/orders/detail.ejs'))),
   'the one fact that strands a delivery is not shown');

/* ═══ 8. THE ACK ACTUALLY RENDERS PER TYPE ═════════════════════════ */
console.log('\n--- delivery page renders the right sentence ---');
const delSrc = read('views/pages/checkout-delivery.ejs');
const ackStart = delSrc.indexOf('checkout-check--ack');
ok('the ack block exists', ackStart !== -1, 'not found');
/* Rendered, not grepped: a template can contain the call and still not
   reach it. The fragment is small enough to render in isolation. */
const frag = '<span><%= deliveryLocation.acknowledgement(order.ship_address_type) %></span>';
for (const v of DL.ORDER) {
  const out = ejs.render(frag, { deliveryLocation: DL, order: { ship_address_type: v } });
  ok(`${v} renders its own sentence`, out.includes(DL.TYPES[v].ack), out.slice(0, 60));
}

/* ═══ 9. THE COLUMN IS WIDE ENOUGH ═════════════════════════════════ */
console.log('\n--- migration ---');
const mig = read('migrations/2026-09-28_delivery_location_third_option_RUNME.sql');
const longest = Math.max(...Object.keys(DL.TYPES).map(k => k.length));
ok(`longest value is ${longest} chars`, longest === 18, 'expectation drifted');
ok('orders column widened past it',
   /orders[\s\S]{0,80}ship_address_type VARCHAR\(32\)/.test(mig), 'still VARCHAR(16)');
ok('customer_addresses widened too',
   /customer_addresses[\s\S]{0,80}address_type VARCHAR\(32\)/.test(mig),
   'saved-address prefill would truncate');
ok('no INFORMATION_SCHEMA (denied on this host)',
   !/INFORMATION_SCHEMA/i.test(executable(mig).replace(/--.*$/gm, '')),
   'the denial aborts the rest of the file');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
