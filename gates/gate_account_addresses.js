'use strict';
/* Gates for GET /account/addresses — the read-only list.
 *
 * The page is RENDERED rather than grepped, because the failures that
 * matter are rendering failures: a stray comma from a missing company, a
 * blank line from an absent address2, an invented helper that throws only
 * when a row happens to carry that column. A grep sees none of those.
 *
 * ⚠️ THE CENTRAL ASSERTION IS THAT THERE IS NO WRITE PATH. The owner
 * decided the customer gets no Remove button. That is not a default to
 * drift back from: the table is the address-velocity source behind admin
 * items 6/9, and a customer-facing delete would hand the subject of that
 * control the means to reset it. So this gate fails if a route, a form,
 * or a model function appears that would let the storefront write here.
 *
 * CustomerAddress is loaded with ../config/database stubbed, matching
 * gate_saved_addresses.
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

/* Comments stripped before every source scan. A gate that reads raw files
   matches its own explanatory prose — and the prose above says "Remove
   button" and "delete" repeatedly, which is exactly what the negative
   assertions below look for. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const CTRL   = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/accountController.js'), 'utf8'));
const ROUTES = strip(fs.readFileSync(path.join(ROOT, 'src/routes/account.js'), 'utf8'));
const MODEL  = strip(fs.readFileSync(path.join(ROOT, 'src/models/CustomerAddress.js'), 'utf8'));
const VIEW   = fs.readFileSync(path.join(ROOT, 'views/pages/account/addresses.ejs'), 'utf8');

console.log('--- the route exists and is authenticated ---');
/* The whole reason this page was built: the nav has linked to it from
   four views and returned 404. */
const addrRoute = (ROUTES.match(/router\.get\(\s*'\/addresses'[^\n]*/) || [''])[0];
ok('GET /addresses is routed', /\/addresses/.test(addrRoute), 'no route — the nav 404s again');
ok('it requires auth', /requireAuth/.test(addrRoute), addrRoute || 'ANY signed-out visitor could read it');
ok('it points at addressesPage',
   /controller\.addressesPage/.test(addrRoute), addrRoute);
ok('the handler is exported', /exports\.addressesPage\s*=/.test(CTRL), 'route would 500');

console.log('--- NO WRITE PATH FROM THE STOREFRONT ---');
/* Each of these is a separate assertion rather than one combined regex.
   The lesson from gate_customer_analytics: a whole-file search for a
   condition passed while the condition it was meant to protect had been
   neutered, because a DIFFERENT line in the file matched. */
ok('no POST /addresses route',
   !/router\.post\(\s*'\/addresses/.test(ROUTES),
   'a write route appeared — see the header of this gate');
ok('no DELETE route either',
   !/router\.delete\(\s*'\/addresses/.test(ROUTES), 'found one');
ok('no /addresses/:id/* route of any verb',
   !/router\.\w+\(\s*'\/addresses\/:/.test(ROUTES), 'found one');
ok('the controller exports no address write handler',
   !/exports\.(deleteAddress|removeAddress|hideAddress|saveAddress|addAddress|updateAddress)\s*=/.test(CTRL),
   'a write handler appeared');
ok('the model exports no destructive address function',
   !/\b(hide|remove|destroy|deleteById)\s*[,(]/.test(
     (MODEL.match(/module\.exports\s*=\s*\{[^}]*\}/) || [''])[0]),
   (MODEL.match(/module\.exports\s*=\s*\{[^}]*\}/) || [''])[0]);
ok('no DELETE or UPDATE statement against customer_addresses outside record()',
   (() => {
     /* record() legitimately contains ON DUPLICATE KEY UPDATE. Checked by
        cutting record() out first, rather than by trying to write a regex
        clever enough to tell the two apart — the FK's ON DELETE CASCADE
        in the migration also contains the word DELETE, which is how an
        earlier gate flagged its own schema. */
     const withoutRecord = MODEL.replace(/async function record\([\s\S]*?\n\}/, '');
     return !/\bDELETE\s+FROM\s+customer_addresses/i.test(withoutRecord)
         && !/\bUPDATE\s+customer_addresses\b/i.test(withoutRecord);
   })(), 'a write statement exists outside the checkout upsert');
ok('the view contains no form at all except Sign Out',
   (VIEW.match(/<form/g) || []).length === 1,
   `${(VIEW.match(/<form/g) || []).length} forms — expected only the logout form`);
ok('the one form IS the logout form',
   /<form action="\/account\/logout"/.test(VIEW), 'the single form is something else');
ok('no Remove/Delete control in the markup',
   !/>\s*(Remove|Delete)\s*</i.test(VIEW), 'a button slipped in');

console.log('--- the id comes from the session, never the request ---');
const handler = (CTRL.match(/exports\.addressesPage[\s\S]*?\n\};/) || [''])[0];
ok('listFor is called with req.session.customerId',
   /listFor\(\s*req\.session\.customerId\s*\)/.test(handler), handler.slice(0, 200));
ok('the handler never reads req.body / req.params / req.query',
   !/req\.(body|params|query)/.test(handler),
   'a request value reached an address lookup');

console.log('--- listFor is scoped in SQL, not just by the caller ---');
const listFor = (MODEL.match(/async function listFor[\s\S]*?\n\}/) || [''])[0];
ok('customer_id is in the WHERE clause',
   /WHERE\s+customer_id\s*=\s*\?/i.test(listFor),
   'a guard in the caller is a guard someone deletes');
ok('it does not SELECT *',
   !/SELECT\s+\*/i.test(listFor),
   'SELECT * would leak address_key, lat/lng and the fraud columns');
['address_key', 'lat', 'lng', 'validation_verdict', 'usps_dpv', 'times_used'].forEach(col =>
  ok(`${col} is NOT selected`, !new RegExp('\\b' + col + '\\b').test(listFor),
     'a fraud-control input would be shown to its subject'));
ok('it returns [] on error rather than throwing',
   /catch[\s\S]*?return \[\]/.test(listFor), 'an account page would 500');

console.log('--- the page renders, and renders sparse rows cleanly ---');
const origLoad = Module._load;
Module._load = function (request) {
  if (request.indexOf('config/database') !== -1) {
    return { bvoPool: { query: async () => [[]] } };
  }
  return origLoad.apply(this, arguments);
};
require(path.join(ROOT, 'src/models/CustomerAddress'));
Module._load = origLoad;

const FILE = path.join(ROOT, 'views/pages/account/addresses.ejs');
const L = {
  pageTitle: 'x', metaDesc: '', csrfToken: 'tok', cspNonce: 'n',
  /* Set on res.locals in server.js, so a real request always has it. */
  deliveryLocation: require(path.join(ROOT, 'src/utils/deliveryLocation')),
  addresses: [],
};
const go = o => ejs.render(FILE && fs.readFileSync(FILE, 'utf8'),
                           Object.assign({}, L, o), { filename: FILE });

let h = go({});
ok('empty list renders the empty state', /No addresses on file yet/.test(h), 'missing');
ok('the empty state does not claim an address exists',
   !/last used/.test(h), 'leaked row markup');

const FULL = {
  id: 1, kind: 'shipping', first_name: 'Sam', last_name: 'Doe',
  company: 'Smash Inventory', address1: '45 Oak Ave', address2: 'Apt 2',
  city: 'Alpharetta', state: 'GA', zip: '30004', country: 'US',
  phone: '+14045551234', phone_ext: '12', address_type: 'commercial_dock',
  last_used_at: new Date('2026-09-20T12:00:00Z'), created_at: new Date(),
};
h = go({ addresses: [FULL] });
['Sam Doe', 'Smash Inventory', '45 Oak Ave', 'Apt 2', 'Alpharetta, GA', '30004']
  .forEach(s => ok(`renders ${JSON.stringify(s)}`, h.indexOf(s) !== -1, 'missing'));
ok('the extension is shown with the phone', /ext\. 12/.test(h), 'missing');
ok('the delivery type is labelled via deliveryLocation',
   h.indexOf(L.deliveryLocation.shortLabel('commercial_dock')) !== -1,
   'the label is wrong or hand-written — shortLabel() is the only source');
ok('US is NOT printed', !/United States/.test(h) && !/>US</.test(h),
   'country noise on every card');
ok('the kind is labelled', /Shipping/.test(h), 'two identical cards would be indistinguishable');

/* The sparse row is the real test. Most saved addresses have no company,
   no address2 and no extension, and the failure mode is cosmetic but
   visible: "Alpharetta, " with a dangling comma, or an empty <p>. */
const SPARSE = {
  id: 2, kind: 'billing', first_name: '', last_name: '', company: null,
  address1: '9 Jobsite Rd', address2: null, city: 'Marietta', state: 'GA',
  zip: '30060', country: 'US', phone: null, phone_ext: null,
  address_type: null, last_used_at: null, created_at: new Date(),
};
h = go({ addresses: [SPARSE] });
ok('a sparse row renders', /9 Jobsite Rd/.test(h), 'threw or omitted');
ok('no empty paragraph', !/<p>\s*<\/p>/.test(h), 'blank line in the card');
ok('no empty bold', !/<strong>\s*<\/strong>/.test(h), 'blank bold line');
ok('no dangling comma', !/,\s*</.test(h.replace(/<!--[\s\S]*?-->/g, '')), 'trailing comma');
ok('no literal null or undefined', !/\b(null|undefined)\b/.test(
     h.replace(/<%[\s\S]*?%>/g, '')), 'a null reached the output');
ok('no "last used" when the date is null', !/last used/.test(h),
   'would print Invalid Date');
ok('billing is labelled billing', /Billing/.test(h), 'mislabelled');

console.log('--- every CSS class used already exists ---');
/* The lesson from gate_customer_name: three invented class names shipped
   in a draft of the login step. A class with no rule is invisible — the
   page looks broken and nothing errors. */
const CSS = fs.readFileSync(path.join(ROOT, 'public/css/site-bundle.css'), 'utf8');
const used = new Set();
(VIEW.match(/class="([^"]+)"/g) || []).forEach(m =>
  m.replace(/class="|"/g, '').split(/\s+/).filter(Boolean).forEach(c => used.add(c)));
used.forEach(c => ok(`.${c} exists in site-bundle.css`,
  new RegExp('\\.' + c.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '[\\s,{:>.]').test(CSS),
  'no rule — the markup would render unstyled'));

console.log('--- the nav link is consistent across every account page ---');
/* It has already drifted once. Until there is a partial, assert it. */
['dashboard', 'orders', 'favorites', 'bundles', 'addresses'].forEach(p => {
  const v = fs.readFileSync(path.join(ROOT, `views/pages/account/${p}.ejs`), 'utf8');
  ok(`${p}.ejs links to /account/addresses`,
     /href="\/account\/addresses"/.test(v), 'missing from the nav');
});
const self = (VIEW.match(/<a href="\/account\/addresses"[^>]*>/) || [''])[0];
ok('addresses.ejs marks its own nav item active', /active/.test(self), self);

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
