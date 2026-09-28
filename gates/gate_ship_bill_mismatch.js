'use strict';
/* Gates for ship-to vs bill-to (item 5, repaired 2026-09-28).
 *
 * THE FLAG WAS DEAD FOR TWO DAYS AND NOTHING SAID SO.
 * shipping_address_collection was removed from the Stripe session on
 * 2026-09-26, so session.shipping_details is always null, so
 * shippingFrom().shipBillMismatch returned false on its first line every
 * time. It read 0 on every order. The comparison was also between the
 * wrong two things: Stripe only knows BILLING; the DELIVERY address is
 * BVO's, from checkout page 1.
 */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const stripe = require(path.join(ROOT, 'src/services/stripeService'));
const cmp = stripe.compareShipBill;

console.log('--- compareShipBill behaviour ---');
ok('identical streets -> no mismatch',
   cmp({ shipLine1: '123 Main St', billLine1: '123 Main St' }) === false, 'flagged');
ok('punctuation and case are ignored',
   cmp({ shipLine1: '123 Main St', billLine1: '123 MAIN ST.' }) === false,
   'a false alarm on every order trains everyone to ignore it');
ok('different streets -> mismatch',
   cmp({ shipLine1: '123 Main St', billLine1: '99 Oak Ave' }) === true, 'missed');

console.log('    (ZIP-only, the common case under billing_address_collection:auto)');
ok('same ZIP -> no mismatch', cmp({ shipZip: '30076', billZip: '30076' }) === false, 'flagged');
ok('ZIP+4 matches its 5-digit base',
   cmp({ shipZip: '30076', billZip: '30076-1234' }) === false, 'flagged');
ok('different ZIP -> mismatch', cmp({ shipZip: '30076', billZip: '30075' }) === true, 'missed');
ok('street wins over ZIP when both sides have one',
   cmp({ shipLine1: '1 A St', shipZip: '30076',
         billLine1: '2 B St', billZip: '30076' }) === true,
   'two houses can share a postcode');

console.log('    (unknown must NEVER read as a mismatch)');
for (const [label, args] of [
  ['nothing at all',        {}],
  ['ship only',             { shipLine1: '1 A St', shipZip: '30076' }],
  ['bill only',             { billLine1: '1 A St', billZip: '30076' }],
  ['empty strings',         { shipLine1: '', billLine1: '', shipZip: '', billZip: '' }],
  ['nulls',                 { shipLine1: null, billLine1: null }],
]) ok(`${label} -> false`, cmp(args) === false, 'an unknown read as a mismatch');
ok('undefined argument does not throw', cmp() === false, 'threw');

console.log('--- the dead one is labelled, not silently left ---');
const ss = fs.readFileSync(path.join(ROOT, 'src/services/stripeService.js'), 'utf8');
ok('shippingFrom.shipBillMismatch is marked ALWAYS FALSE',
   /ALWAYS FALSE[\s\S]{0,400}shipBillMismatch: \(\(\) => \{/.test(ss),
   'a future reader would trust a flag that cannot fire');
ok('it points at the replacement',
   /USE exports\.compareShipBill\(\) INSTEAD/.test(ss), 'no forward pointer');

console.log('--- the webhook wiring, INCLUDING SCOPE ---');
/* ⚠️ new vm.Script() checks SYNTAX, NOT SCOPE. This block was first
   inserted into saveInfo by a replace(count=1) that hit the wrong
   `await bvoPool.getConnection()` — `who` and `orderId` do not exist
   there, so it parsed clean and would have thrown ReferenceError on
   every checkout submit. Scope is asserted here because nothing else
   can see it. */
const cc = fs.readFileSync(path.join(ROOT, 'src/controllers/checkoutController.js'), 'utf8');
const lines = cc.split('\n');
const at = lines.findIndex(l => l.includes('let shipBillMismatch = false;'));
ok('the comparison block exists', at !== -1, 'missing');

let enclosing = null;
for (let i = at; i >= 0; i--) {
  if (/^(async )?function \w+|^exports\.\w+ = async/.test(lines[i])) { enclosing = lines[i].trim(); break; }
}
ok('it lives in handleSessionCompleted, NOT saveInfo',
   /handleSessionCompleted/.test(enclosing || ''), String(enclosing));

for (const v of ['const who', 'const orderId']) {
  let found = false;
  for (let i = at; i >= 0; i--) {
    if (/^(async )?function \w+|^exports\.\w+ = async/.test(lines[i])) break;
    if (lines[i].includes(v)) { found = true; break; }
  }
  ok(`${v} is in scope at the block`, found,
     'ReferenceError on every webhook - syntax checks cannot see this');
}

const code = cc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
ok('it calls compareShipBill', /stripe\.compareShipBill\(/.test(code), 'missing');
/* SCOPED TO THE FUNCTION. A file-wide indexOf finds the `UPDATE orders`
   in saveInfo, hundreds of lines earlier, and the ordering assertion
   fails on correct code. Third variant of the same mistake in these
   gates: compare positions only within the region they belong to. */
const fnStart = code.indexOf('async function handleSessionCompleted');
const fnBody  = code.slice(fnStart);
const iSel = fnBody.indexOf('SELECT ship_address1, ship_zip FROM orders');
const iUpd = fnBody.indexOf('UPDATE orders');
ok('both statements are in handleSessionCompleted', iSel !== -1 && iUpd !== -1,
   `select@${iSel} update@${iUpd}`);
ok('it reads the order BEFORE the UPDATE',
   iSel !== -1 && iUpd !== -1 && iSel < iUpd,
   "the UPDATE's COALESCE would make it compare a value with itself");
ok('the UPDATE writes the computed value, not the dead one',
   /shipBillMismatch \? 1 : 0/.test(code) && !/who\.shipBillMismatch \? 1 : 0/.test(code),
   'still writing the permanently-false flag');
ok('a failed compare falls back to FALSE',
   /let shipBillMismatch = false;/.test(code), 'an error could read as a mismatch');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
