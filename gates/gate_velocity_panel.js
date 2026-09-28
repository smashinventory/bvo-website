'use strict';
/* Gates for the address-history panel on the order detail screen.
 * Items 6/9 — context for the verification call.
 *
 * The panel fragment is RENDERED. Whether a block appears at all is the
 * entire behaviour, and grep cannot tell "shown" from "present in the
 * file but inside a false branch".
 *
 * The fragment is extracted rather than rendering the whole page: the
 * full detail.ejs needs ~20 locals and a layout, and a fixture that
 * large stops being a test of this panel.
 */

const ejs  = require('ejs');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'views/pages/admin/orders/detail.ejs');
const full = fs.readFileSync(FILE, 'utf8');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

/* From the ADDRESS HISTORY comment to the dispute block that follows. */
const start = full.indexOf('<%/* ── ADDRESS HISTORY');
const end   = full.indexOf('<% if (order.dispute_id) { %>');
ok('the panel is present in detail.ejs', start !== -1 && end > start,
   `start=${start} end=${end}`);
if (start === -1 || end <= start) { console.log('\n*** cannot continue ***'); process.exit(1); }
const frag = full.slice(start, end);

const render = (o) => ejs.render(frag, Object.assign({
  order: { ship_bill_mismatch: 0 },
  addressHistory: { shipping: [], billing: [] },
}, o), { filename: FILE });

const addr = (city, state, last, times = 1, address1 = '1 Main St') => ({
  address1, city, state, zip: '30060', last_used_at: last, times_used: times,
});

console.log('--- when it stays QUIET ---');
/* A panel that shows on every order is wallpaper. */
ok('nothing to say -> renders nothing',
   render({}).trim() === '', render({}).trim().slice(0, 80));
ok('ONE shipping address -> still nothing',
   render({ addressHistory: { shipping: [addr('Marietta', 'GA', '2026-09-20')], billing: [] } })
     .trim() === '', 'fires on every repeat customer');
ok('one shipping + one billing -> nothing',
   render({ addressHistory: {
     shipping: [addr('Marietta', 'GA', '2026-09-20')],
     billing:  [addr('Marietta', 'GA', '2026-09-20')] } }).trim() === '', 'noisy');

console.log('--- when it SPEAKS ---');
const two = { shipping: [addr('Marietta', 'GA', '2026-09-20', 3),
                         addr('Alpharetta', 'GA', '2026-08-14')], billing: [] };
let h = render({ addressHistory: two });
ok('TWO addresses is enough to show', h.trim() !== '',
   'advisory context should be MORE sensitive, not less');
ok('it counts them', /2 delivery addresses in the last 90 days/.test(h), 'no count');
ok('it names the cities', /Marietta/.test(h) && /Alpharetta/.test(h), 'unidentifiable');
/* Two orders to one town render as "Roswell, GA" twice without this —
   indistinguishable, so the rep cannot form a question. */
{
  const h2 = render({ addressHistory: { shipping: [
    addr('Roswell', 'GA', '2026-09-28', 1, '5150 Old Ellis Point'),
    addr('Roswell', 'GA', '2026-09-28', 1, '22 Canton Street')], billing: [] } });
  ok('it shows the STREET, not just the city',
     /5150 Old Ellis Point/.test(h2) && /22 Canton Street/.test(h2),
     'two addresses in one town would be indistinguishable');
  ok('a missing street says so rather than rendering blank',
     /\(no street recorded\)/.test(render({ addressHistory: { shipping: [
       { city: 'A', state: 'GA', last_used_at: '2026-09-01', times_used: 1 },
       addr('B', 'GA', '2026-08-01')], billing: [] } })), 'blank line');
}
ok('the panel is RED, not beige',
   /background:#fff5f5/.test(frag) && /border:1px solid var\(--red\)/.test(frag),
   'beige reads as decoration, not a flag');
ok('it shows when each was last used', /last used Sep 20/.test(h), 'no dates');
ok('it shows repeat use', /3 times/.test(h), 'a regular destination looks like a one-off');

console.log('    (it asks, it does not accuse)');
ok('NO "fraud" wording anywhere', !/fraud/i.test(h), 'a badge trains people to ignore it');
ok('NO risk score', !/score/i.test(h), 'this is not a score');
ok('it says it does not block capture', /none of this blocks capture/i.test(h), 'missing');
ok('it tells the rep to ask', /Ask, do not assume/i.test(h), 'missing');

console.log('--- ship-to vs bill-to mismatch ---');
h = render({ order: { ship_bill_mismatch: 1 } });
ok('mismatch alone is enough to show', h.trim() !== '', 'a real signal was hidden');
ok('it says so plainly', /does not match the billing address/i.test(h), 'missing');
ok('it says WHEN that was recorded', /Recorded at authorisation/i.test(h),
   'a later edit must not look like it rewrote the flag');
ok('no mismatch -> that line is absent',
   !/does not match the billing address/i.test(render({ addressHistory: two })),
   'shown when false');

console.log('--- degrades rather than throwing ---');
/* An order placed before the identity gate has a NULL customer_id and
   gets an empty history. The panel must not take the whole order screen
   down over a fraud hint. */
for (const [label, locals] of [
  ['addressHistory undefined', { addressHistory: undefined }],
  ['addressHistory null',      { addressHistory: null }],
  ['missing arrays',           { addressHistory: {} }],
]) {
  let threw = false, out = '';
  try { out = render(locals); } catch (e) { threw = true; out = e.message; }
  ok(`${label} -> renders empty, no throw`, !threw && out.trim() === '', out.slice(0, 60));
}
{
  let threw = false;
  try {
    render({ addressHistory: { shipping: [addr(null, null, null), addr('X', 'GA', null)],
                               billing: [] } });
  } catch (e) { threw = true; }
  ok('null city/date do not throw', !threw, 'threw on incomplete rows');
}
{
  /* Date-only strings are parsed as UTC midnight and render as the
     PREVIOUS day in Eastern. mysql2 hands back Date objects so
     production does not hit it, but the panel must not rely on that. */
  const asString = render({ addressHistory: {
    shipping: [addr('Marietta', 'GA', '2026-09-20'), addr('X', 'GA', '2026-08-14')],
    billing: [] } });
  const asDate = render({ addressHistory: {
    shipping: [addr('Marietta', 'GA', new Date(2026, 8, 20)), addr('X', 'GA', '2026-08-14')],
    billing: [] } });
  ok('a date-only STRING renders the right day',
     /last used Sep 20/.test(asString), 'off by one - UTC midnight in a local timezone');
  ok('a Date OBJECT renders the same day',
     /last used Sep 20/.test(asDate), 'mysql2 shape disagrees with the string shape');
  ok('an unparseable date degrades to a dash',
     /—/.test(render({ addressHistory: {
       shipping: [addr('A', 'GA', 'not-a-date'), addr('B', 'GA', '2026-08-14')],
       billing: [] } })), 'Invalid Date shown to staff');
}

console.log('--- controller wiring ---');
const oc = fs.readFileSync(path.join(ROOT, 'src/controllers/ordersController.js'), 'utf8');
const code = oc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok('velocity() is called', /CustomerAddress\.velocity\(/.test(code), 'missing');
ok('it is 90 days', /velocity\(order\.customer_id, 90\)/.test(code), 'wrong window');
ok('a NULL customer_id is handled',
   /order\.customer_id\s*\n?\s*\?/.test(code), 'pre-gate orders would error');
ok('addressHistory reaches the view', /addressHistory,/.test(code), 'not passed');

console.log('--- it must never gate capture ---');
/* The one rule that matters. Item 4 is the mechanism that blocks
   capture; this is not it. */
const capBlock = (full.match(/Capture[\s\S]{0,400}?<\/form>/g) || []).join('\n');
ok('no capture control references addressHistory',
   !/addressHistory/.test(capBlock), 'an advisory flag started blocking money');
ok('the panel sets no disabled state',
   !/disabled/.test(frag), 'the panel disables a control');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
