'use strict';
/* Gates for the two consent checkboxes on checkout page 1.
 * Spec 9.2 (verbatim copy) and 9.2a (placement and defaults).
 *
 * The page is RENDERED and the resulting HTML inspected. Checkbox
 * defaults cannot be verified by grep: the whole failure mode is that
 * `checked` appears in the output when it should not, and vice versa.
 *
 * The case that matters most is the validation bounce. An unchecked box
 * submits NOTHING, so a helper that treats "missing" as "use the
 * default" silently re-ticks a box the buyer just cleared — and the
 * consent record would then claim they agreed. That is asserted here in
 * both directions.
 */

const ejs  = require('ejs');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'views/pages/checkout-info.ejs');
const src  = fs.readFileSync(FILE, 'utf8');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail++;
};

const base = {
  pageTitle: 'x', metaDesc: '', noindex: true,
  cart: { items: [{ product_id: 1, name: 'Amberly 60"', price: 1599, quantity: 1, image: '' }],
          count: 1, subtotal: 1599 },
  subtotal: 1599,
  /* old is {} — NOT null. takeCheckoutFlash returns `s.checkoutOld || {}`,
     so the view never sees null. The first version of this fixture used
     null, which let a real bug through: {} is truthy, so `if (old)` took
     the was-submitted branch on every first render. Fixtures must mirror
     what the controller actually passes. */
  draft: null, errors: {}, old: {}, checkoutError: null,
  mapsKey: '', addrWarning: null,
  /* A BRAND-NEW customer, as created seconds earlier at
     /checkout/identify. Both flags are 0 because the columns are NOT
     NULL DEFAULT 0, and both *_at are NULL because nobody has asked
     yet. This fixture is the one that matters: an earlier version of
     the helper read the 0 as an answer, which meant the pre-checked
     default applied to NOBODY. */
  customer: { id: 7, email: 'sam@example.com', first_name: 'Sam',
              accepts_marketing: 0,     marketing_consent_at: null,
              delivery_sms_consent: 0,  delivery_sms_consent_at: null },
  csrfToken: 'tok', cspNonce: 'nonce123',
};

function render(over) {
  return ejs.render(src, Object.assign({}, base, over), { filename: FILE });
}

/* Isolates one checkbox's own <input ...> tag, so a `checked` belonging
   to a different control on the page cannot satisfy the assertion. */
function inputTag(html, id) {
  const m = html.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'));
  return m ? m[0] : null;
}
const isChecked = (html, id) => {
  const t = inputTag(html, id);
  return t === null ? null : /\bchecked\b/.test(t);
};

console.log('--- renders at all ---');
let html;
try { html = render({}); ok('page renders', html.length > 0); }
catch (e) { ok('page renders', false, e.message); console.log('\n*** cannot continue ***'); process.exit(1); }

ok('marketing checkbox present', inputTag(html, 'marketing_opt_in') !== null, 'missing');
ok('delivery-sms checkbox present', inputTag(html, 'delivery_sms_opt_in') !== null, 'missing');

console.log('--- defaults on FIRST render (spec 9.2a) ---');
ok('marketing is UNCHECKED by default',
   isChecked(html, 'marketing_opt_in') === false,
   'a pre-ticked marketing box is weaker consent evidence');
ok('delivery SMS is PRE-CHECKED by default',
   isChecked(html, 'delivery_sms_opt_in') === true,
   'transactional; the buyer gave the number for this delivery');

console.log('--- an EMPTY flash object is not a submission ---');
{
  /* The exact shape a first render produces. If this regresses, the
     pre-checked default silently reaches nobody. */
  const h = render({ old: {} });
  ok('old:{} still gets the pre-checked default',
     isChecked(h, 'delivery_sms_opt_in') === true,
     'an empty flash object was read as "they submitted and unticked it"');
  ok('old:{} leaves marketing unchecked',
     isChecked(h, 'marketing_opt_in') === false, 'wrong default');
}
{
  const h = render({ old: undefined });
  ok('old:undefined also gets the default',
     isChecked(h, 'delivery_sms_opt_in') === true, 'undefined mishandled');
}

console.log('--- THE VALIDATION BOUNCE ---');
/* `old` present = the form was submitted and came back. An unchecked
   box is ABSENT from the body, and must stay unchecked. */
{
  const h = render({ old: { ship_name: 'Sam', email: 'sam@example.com' }, errors: { ship_phone: 'Required' } });
  ok('delivery SMS stays UNCHECKED after the buyer cleared it',
     isChecked(h, 'delivery_sms_opt_in') === false,
     'SILENTLY RE-TICKED — the consent record would be false');
  ok('marketing stays unchecked when it was never ticked',
     isChecked(h, 'marketing_opt_in') === false, 're-ticked');
}
{
  const h = render({ old: { delivery_sms_opt_in: '1', marketing_opt_in: '1' }, errors: { ship_phone: 'Required' } });
  ok('delivery SMS stays CHECKED when it was ticked',
     isChecked(h, 'delivery_sms_opt_in') === true, 'lost the buyer’s choice');
  ok('marketing stays CHECKED when it was ticked',
     isChecked(h, 'marketing_opt_in') === true, 'lost the buyer’s choice');
}

console.log('--- NEVER ASKED vs ASKED-AND-DECLINED ---');
/* Both flags are NOT NULL DEFAULT 0, so the flag alone cannot tell
   these apart. The *_at timestamp is the only discriminator, and the
   default hangs on it. */
{
  const h = render({ customer: { ...base.customer,
    delivery_sms_consent: 0, delivery_sms_consent_at: null } });
  ok('never asked -> pre-checked default applies',
     isChecked(h, 'delivery_sms_opt_in') === true,
     'the default would reach nobody');
}
{
  const h = render({ customer: { ...base.customer,
    delivery_sms_consent: 0, delivery_sms_consent_at: '2026-09-20 10:00:00' } });
  ok('asked and DECLINED -> stays unchecked',
     isChecked(h, 'delivery_sms_opt_in') === false,
     'someone who opted out is re-ticked without being asked');
}
{
  const h = render({ customer: { ...base.customer,
    accepts_marketing: 1, marketing_consent_at: '2026-09-20 10:00:00' } });
  ok('stored marketing=1 pre-ticks the box', isChecked(h, 'marketing_opt_in') === true, 'ignored');
}
{
  const h = render({ customer: { ...base.customer,
    accepts_marketing: 0, marketing_consent_at: null } });
  ok('never asked about marketing -> unchecked (its default)',
     isChecked(h, 'marketing_opt_in') === false, 'pre-ticked');
}
{
  /* A submitted form must beat the stored value — otherwise the buyer
     cannot change their mind on this order. */
  const h = render({ customer: { ...base.customer, accepts_marketing: 1,
                                 marketing_consent_at: '2026-09-20 10:00:00' },
                     old: { ship_name: 'Sam' }, errors: { ship_phone: 'x' } });
  ok('this form’s choice beats the stored value',
     isChecked(h, 'marketing_opt_in') === false,
     'stored value overrode what they just did');
}

console.log('--- the email field ---');
ok('email is NOT an editable input',
   inputTag(html, 'email') === null,
   'identity was proven at /checkout/identify; an editable field hands that back');
ok('no hidden email field either',
   !/<input[^>]*name="email"/.test(html),
   'a forgeable copy of a fact the server already holds');
ok('the proven address is displayed', /sam@example\.com/.test(html), 'not shown');
ok('there is a way to change it', /checkout\/identify/.test(html), 'no escape hatch');

console.log('--- owner-approved copy, verbatim (spec 9.2) ---');
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const MUST = [
  'Email me about my vanity.',
  'Matching pieces in your finish when they go on sale',
  'replacement parts when we stock them',
  'Nothing else, and one click to stop.',
  'Text me about my delivery.',
  'The carrier calls to book your appointment.',
];
MUST.forEach(s => ok('copy: "' + s.slice(0, 44) + '"', text.includes(s), 'altered or missing'));

/* Cut by the owner on 2026-09-27 and not to be reintroduced. */
const BANNED = ['rebate', 'price drop', 'price adjustment', 'repricing', 'refund if the price'];
BANNED.forEach(s => ok('does NOT promise: ' + s, !new RegExp(s, 'i').test(text),
                       'owner cut this on 2026-09-27'));

console.log('--- placement (spec 9.2a: inline, not a gate) ---');
ok('delivery-SMS box sits AFTER the phone field it governs',
   html.indexOf('id="ship_phone"') < html.indexOf('id="delivery_sms_opt_in"'),
   'a consent box away from its field needs explaining');
ok('marketing box is in the contact block, before the address',
   html.indexOf('id="marketing_opt_in"') < html.indexOf('id="ship_address1"'),
   'not in the contact block');
ok('no skip / just-delivery button was added',
   !/just delivery|skip this|Just Delivery/i.test(text),
   'consent is inline, so there is nothing to skip past');
ok('both boxes are inside the main form',
   html.indexOf('id="info-form"') < html.indexOf('id="marketing_opt_in"') &&
   html.indexOf('id="delivery_sms_opt_in"') < html.lastIndexOf('</form>'),
   'a box outside the form submits nothing');

console.log('--- the helper itself ---');
ok('a checkbox-aware helper exists',
   /const checked = \(k, dflt, stored, answered\)/.test(src), 'missing or wrong signature');
/* `answered` is the whole fix: both flags are NOT NULL DEFAULT 0, so
   without it a new customer's 0 reads as a decision and the
   pre-checked default reaches nobody. */
ok('the helper takes an `answered` discriminator',
   /if \(answered\) return !!Number\(stored\)/.test(src),
   'stored 0 would be read as "declined" for every new customer');
ok('both call sites pass the *_consent_at timestamp',
   /checked\('marketing_opt_in',[^)]*marketing_consent_at\)/.test(src) &&
   /checked\('delivery_sms_opt_in',[^)]*delivery_sms_consent_at\)/.test(src),
   'a call site still infers "answered" from the flag');
ok('checkboxes do NOT use val()',
   !/val\('(marketing_opt_in|delivery_sms_opt_in)'/.test(src),
   'val() treats missing as the default and re-ticks cleared boxes');
ok('the helper reads presence, not truthiness',
   /if \(submitted\) return old\[k\] === '1'/.test(src), 'wrong test');
/* The specific regression: `if (old)` rather than `if (submitted)`.
   takeCheckoutFlash returns {} on a first render and {} is truthy, so
   the bare form reads every first render as a submission and no default
   ever applies. */
ok('submitted is derived from EMPTINESS, not existence',
   /const submitted = old && Object\.keys\(old\)\.length > 0/.test(src),
   'a truthy {} would be read as a submission');
ok('no bare `if (old)` left in the checkbox helper',
   !/if \(old\)\s*return old\[k\]/.test(src), 'the e613af5 bug is back');

console.log(fail ? '\n*** ' + fail + ' GATE(S) FAILED ***' : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
