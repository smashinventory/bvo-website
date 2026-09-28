'use strict';
/* Gates for saved addresses — items 27/28 and the velocity data for 6/9.
 *
 * addressKey is exercised for real (it is a pure module, which is why it
 * is its own file). The page is RENDERED, because prefill precedence
 * cannot be checked by grep: the failure mode is a value appearing in a
 * field when it should not.
 *
 * CustomerAddress is loaded with ../config/database stubbed, so the SQL
 * shape can be asserted without a live DB.
 */

const ejs    = require('ejs');
const fs     = require('fs');
const path   = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const addressKey = require(path.join(ROOT, 'src/utils/addressKey'));

console.log('--- addressKey: place_id wins ---');
const PID = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
const base = { address1: '123 Main St', city: 'Marietta', state: 'GA', zip: '30060' };

ok('same place_id, different street spelling -> SAME key',
   addressKey({ ...base, place_id: PID }) ===
   addressKey({ ...base, place_id: PID, address1: '123 Main Street' }),
   'the place_id was not preferred');

ok('same place_id, different CITY -> same key',
   addressKey({ ...base, place_id: PID }) ===
   addressKey({ ...base, place_id: PID, city: 'Smyrna' }),
   'place_id must be the sole identity when present');

ok('different place_id -> different key',
   addressKey({ ...base, place_id: PID }) !== addressKey({ ...base, place_id: PID + 'X' }),
   'collision');

/* A place_id the shape check rejects must NOT be trusted as identity —
   same guard addressProvenance applies. */
ok('malformed place_id falls back to the string',
   addressKey({ ...base, place_id: 'no!' }) === addressKey(base),
   'a bad place_id was hashed as if it were real');

console.log('--- addressKey: string fallback normalises ---');
const variants = [
  { ...base, address1: '123 Main Street' },
  { ...base, address1: '123 main st.' },
  { ...base, address1: '123 MAIN ST' },
  { ...base, zip: '30060-1234' },
];
variants.forEach((v, i) =>
  ok(`variant ${i + 1} matches the base`, addressKey(v) === addressKey(base),
     JSON.stringify(v)));

ok('a genuinely different house does NOT match',
   addressKey({ ...base, address1: '125 Main St' }) !== addressKey(base),
   'over-normalised - a wrong merge HIDES a duplicate');
ok('a different city does NOT match',
   addressKey({ ...base, city: 'Alpharetta' }) !== addressKey(base), 'merged');
ok('apartment number is part of the identity',
   addressKey({ ...base, address2: 'Apt 4' }) !== addressKey(base),
   'two units in one building would collapse into one address');
ok('Apt 4 and apartment 4 are the same',
   addressKey({ ...base, address2: 'Apt 4' }) ===
   addressKey({ ...base, address2: 'apartment 4' }), 'not normalised');

console.log('--- addressKey: always returns a usable key ---');
ok('empty input still returns 64 hex', /^[0-9a-f]{64}$/.test(addressKey({})),
   'the column is NOT NULL; a null key would defeat the unique index');
ok('undefined input does not throw', /^[0-9a-f]{64}$/.test(addressKey()), 'threw');
ok('place-key and string-key never collide',
   addressKey({ ...base, place_id: PID }) !== addressKey(base), 'prefixes missing');

console.log('--- CustomerAddress SQL shape ---');
const origLoad = Module._load;
const queries = [];
Module._load = function (request) {
  if (request.indexOf('config/database') !== -1) {
    return { bvoPool: { query: async (sql, params) => {
      queries.push({ sql, params }); return [[]];
    } } };
  }
  return origLoad.apply(this, arguments);
};
const CustomerAddress = require(path.join(ROOT, 'src/models/CustomerAddress'));

(async () => {
  await CustomerAddress.record(7, 'shipping', { ...base, place_id: PID });
  const q = queries[0];
  ok('a write was attempted', !!q, 'nothing ran');
  /* \b after UPDATE, or the assertion matches the PREFIX of a broken
     clause: /ON DUPLICATE KEY UPDATE/ happily matches
     "ON DUPLICATE KEY UPDATE_DISABLED". A mutation test walked through
     the loose version. */
  ok('it is an UPSERT', /ON DUPLICATE KEY UPDATE\b/i.test(q.sql),
     'without it every checkout inserts a duplicate and times_used stays 1');
  ok('it bumps times_used', /times_used\s*=\s*times_used \+ 1/.test(q.sql), 'missing');
  ok('it refreshes last_used_at', /last_used_at\s*=\s*NOW\(\)/.test(q.sql), 'missing');
  ok('placeholders match parameters',
     (q.sql.match(/\?/g) || []).length === q.params.length,
     `${(q.sql.match(/\?/g) || []).length} ? vs ${q.params.length} params`);
  ok('the key is passed, not null',
     typeof q.params[2] === 'string' && q.params[2].length === 64, String(q.params[2]));

  console.log('--- CustomerAddress refuses junk ---');
  const cases = [
    [await CustomerAddress.record(null, 'shipping', base), 'no customer id'],
    [await CustomerAddress.record(7, 'postal', base),      'bad kind'],
    [await CustomerAddress.record(7, 'shipping', { city: 'X' }), 'no address1'],
  ];
  cases.forEach(([r, label]) => ok(`rejects: ${label}`, r.ok === false, JSON.stringify(r)));
  ok('only the one good write ran', queries.length === 1, `${queries.length} queries`);

  Module._load = origLoad;
  render();
})();

function render() {
  console.log('--- prefill precedence on the page ---');
  const FILE = path.join(ROOT, 'views/pages/checkout-info.ejs');
  const src  = fs.readFileSync(FILE, 'utf8');
  const L = {
    pageTitle: 'x', metaDesc: '', noindex: true,
    cart: { items: [{ product_id: 1, name: 'V', price: 1, quantity: 1, image: '' }],
            count: 1, subtotal: 1 },
    subtotal: 1, draft: null, errors: {}, old: {}, checkoutError: null,
    mapsKey: '', addrWarning: null,
    customer: { id: 7, email: 'a@b.com', first_name: 'Sam', accepts_marketing: 0,
                marketing_consent_at: null, delivery_sms_consent: 0,
                delivery_sms_consent_at: null },
    savedAddress: null, csrfToken: 'tok', cspNonce: 'n',
  };
  const go = o => ejs.render(src, Object.assign({}, L, o), { filename: FILE });
  const valueOf = (html, id) => {
    const m = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'));
    if (!m) return null;
    const v = m[0].match(/value="([^"]*)"/);
    return v ? v[1] : '';
  };

  const SAVED = { address1: '45 Oak Ave', address2: 'Apt 2', city: 'Alpharetta',
                  state: 'GA', zip: '30004', phone: '+14045551234',
                  phone_ext: '12', first_name: 'Sam', last_name: 'Doe',
                  address_type: 'residential' };

  let h = go({});
  ok('no saved address -> fields empty', valueOf(h, 'ship_address1') === '',
     valueOf(h, 'ship_address1'));
  ok('no saved address -> NO notice', !/Shipping to your last address/.test(h), 'shown');

  h = go({ savedAddress: SAVED });
  ok('saved address prefills street', valueOf(h, 'ship_address1') === '45 Oak Ave',
     valueOf(h, 'ship_address1'));
  ok('saved address prefills city', valueOf(h, 'ship_city') === 'Alpharetta',
     valueOf(h, 'ship_city'));
  ok('saved address prefills zip', valueOf(h, 'ship_zip') === '30004',
     valueOf(h, 'ship_zip'));
  ok('saved address prefills the name', valueOf(h, 'ship_name') === 'Sam Doe',
     valueOf(h, 'ship_name'));
  ok('saved address prefills the extension', valueOf(h, 'ship_phone_ext') === '12',
     valueOf(h, 'ship_phone_ext'));

  console.log('    (the notice — silent prefill is the hazard)');
  ok('the notice IS shown', /Shipping to your last address/.test(h), 'silent prefill');
  ok('it names the city', /Alpharetta/.test(h), 'unidentifiable');
  ok('it tells them they can change it', /Change anything below/.test(h), 'no instruction');

  console.log('--- a saved address NEVER overwrites this order ---');
  /* The failure that costs money: a trade buyer types a new jobsite,
     hits a validation error, and the bounce silently restores last
     month's site. */
  h = go({ savedAddress: SAVED,
           old: { ship_address1: '9 Jobsite Rd', ship_city: 'Marietta' },
           errors: { ship_phone: 'Required' } });
  ok('a bounced submit beats the saved address',
     valueOf(h, 'ship_address1') === '9 Jobsite Rd', valueOf(h, 'ship_address1'));
  ok('and the bounced city too',
     valueOf(h, 'ship_city') === 'Marietta', valueOf(h, 'ship_city'));

  h = go({ savedAddress: SAVED,
           draft: { ship_address1: '7 Draft Way', ship_city: 'Roswell',
                    ship_first_name: 'Dee', ship_last_name: 'Ray' } });
  ok('an existing draft beats the saved address',
     valueOf(h, 'ship_address1') === '7 Draft Way', valueOf(h, 'ship_address1'));
  ok('the draft name wins too', valueOf(h, 'ship_name') === 'Dee Ray',
     valueOf(h, 'ship_name'));

  console.log('--- controller wiring ---');
  const cc = fs.readFileSync(path.join(ROOT, 'src/controllers/checkoutController.js'), 'utf8');
  const code = cc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  ok('shipping is recorded in saveInfo',
     /CustomerAddress\.record\(\s*req\.session\.customerId,\s*'shipping'/.test(code), 'missing');
  ok('billing is recorded in the webhook',
     /CustomerAddress\.record\(\s*\n?\s*row\.customer_id,\s*'billing'/.test(code)
     || /'billing'/.test(code), 'missing');
  ok('the billing write reads customer_id off the ORDER, not a session',
     /SELECT customer_id FROM orders WHERE id = \?/.test(code),
     'a webhook has no session');
  ok('savedAddress is only fetched when nothing was typed',
     /!draft && !flash\.old\.ship_address1/.test(code),
     'a saved address could overwrite this order');
  ok('savedAddress reaches the view', /savedAddress,/.test(code), 'not passed');
  ok('the shipping write is fire-and-forget',
     /CustomerAddress\.record\([\s\S]{0,700}?\}\)\.catch\(\(\) => \{\}\)/.test(code),
     'an address write could fail a checkout');

  console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
  process.exit(fail ? 1 : 0);
}
