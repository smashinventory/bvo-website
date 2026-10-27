#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_account_links_resolve.js
 *
 * THE RULE: EVERY /account/* LINK IN EVERY VIEW MUST RESOLVE TO A ROUTE
 * THAT IS ACTUALLY REGISTERED.
 *
 * THE DEFECT, TWICE, IN THE SAME DIRECTORY:
 *
 *   1. /account/addresses — the Addresses item sat in the account nav of
 *      four views from the day the nav was written. No route existed. Every
 *      signed-in customer who clicked it got a 404. Fixed 2026-10-25.
 *
 *   2. /account/orders/:id — orders.ejs line 38 and dashboard.ejs line 45
 *      rendered each order number as a link to its own detail page. No such
 *      route had EVER existed. So the single most natural click a customer
 *      makes after ordering — tapping their own order number — 404'd, from
 *      launch until 2026-10-26, when it showed up in a Clarity session
 *      recording rather than in any test. Found by the owner watching a
 *      real customer fail.
 *
 * WHY A GATE AND NOT CARE:
 *   A dangling <a href> is the quietest defect this codebase produces.
 *   Nothing throws. Nothing logs. The view renders perfectly, the link is
 *   styled correctly, and the page it points at does not exist. Every test
 *   that renders the view passes, because rendering a link never follows
 *   it. It is invisible to anything short of clicking every link as a
 *   signed-in customer — which is exactly why it survived twice.
 *
 *   The two halves of a link live in different files, so neither file is
 *   wrong on its own. Only the PAIR is wrong, and nothing in the codebase
 *   held both halves at once until this gate did.
 *
 * ⚠️ MATCHING IS SEGMENT-EXACT, NOT PREFIX OR SUBSTRING. Loose matching is
 * the repeat failure mode of gates in this repo: a check that asks "does
 * the routes file mention 'orders'" passes while /account/orders/:id is
 * missing, because /account/orders exists. So a link matches a route only
 * when they have the SAME NUMBER OF SEGMENTS and every segment is either
 * literally equal or a route parameter. Prefix matches are rejected.
 *
 * Run:  node gates/gate_account_links_resolve.js
 * Exit: 0 = pass, 1 = fail
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

/* ═══ THE ROUTE TABLE ════════════════════════════════════════════════
   Read from src/routes/account.js, not hand-copied. A hand-copied list is
   a second definition of the routes and would drift from the first — the
   "second caller" form of the rule that a test must not re-implement its
   subject. */
const MOUNT      = '/account';
const ROUTE_FILE = 'src/routes/account.js';

const routeSrc = fs.readFileSync(path.join(ROOT, ROUTE_FILE), 'utf8')
  /* Comments stripped FIRST. The header comments in that file quote route
     paths in prose ("/orders/:id placed first would still not shadow..."),
     and a regex over the raw text would collect those as real routes —
     making a deleted route look present. Quoting code in a comment
     satisfies a grep for that code. */
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const routes = [];   // { method, path, segs }
for (const m of routeSrc.matchAll(/router\.(get|post|put|patch|delete)\(\s*'([^']+)'/g)) {
  const full = m[2] === '/' ? MOUNT : MOUNT + m[2];
  routes.push({ method: m[1].toUpperCase(), path: full, segs: full.split('/').filter(Boolean) });
}

console.log('\ngate_account_links_resolve — every /account link has a page behind it\n');
console.log(`--- route table read from ${ROUTE_FILE} ---`);
check(routes.length >= 15,
      `the route table parsed (${routes.length} routes)`,
      'fewer routes than expected — if the parse broke, every link below ' +
      'would be reported as dangling, or worse, the gate would pass on an ' +
      'empty expectation');

/* ═══ THE MATCHER ════════════════════════════════════════════════════
   One function, used for every link, so there is exactly one definition of
   "resolves". */
function resolves(method, linkSegs) {
  return routes.some(r => {
    if (r.method !== method) return false;
    if (r.segs.length !== linkSegs.length) return false;      // no prefix matches
    return r.segs.every((rs, i) => {
      if (rs.startsWith(':')) return linkSegs[i] !== '';      // a param eats one segment
      return rs === linkSegs[i];
    });
  });
}

/* ═══ THE LINKS ══════════════════════════════════════════════════════ */
function walkViews(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) walkViews(rel, out);
    else if (e.name.endsWith('.ejs') && !e.name.includes('.bak')) out.push(rel);
  }
  return out;
}

/* An interpolated segment — <%= order.id %> — becomes this sentinel, which
   matches any route parameter but NOT a literal segment. A link built from
   a variable still has to land on a route that takes a parameter there. */
const DYNAMIC = '\u0001dyn';

function linkSegments(href) {
  return href
    .replace(/<%[-=]?[\s\S]*?%>/g, DYNAMIC)   // interpolation -> one sentinel
    .split(/[?#]/)[0]                          // drop query and fragment
    .split('/').filter(Boolean);
}

const views = walkViews('views');
const dangling = [];
let linkCount = 0;

for (const f of views) {
  const body = fs.readFileSync(path.join(ROOT, f), 'utf8')
    /* EJS comments stripped: several views carry commented-out markup and
       prose that names old URLs. A dead link inside a comment is not a
       dead link. */
    .replace(/<%#[\s\S]*?%>/g, '');

  /* href="..." is a GET; action="..." on a form is a POST. Both are
     collected because the addresses defect was an href and the logout
     defect class would be an action. */
  const found = [
    ...[...body.matchAll(/href="(\/account(?:\/[^"]*)?)"/g)].map(m => ({ method: 'GET',  href: m[1] })),
    ...[...body.matchAll(/action="(\/account(?:\/[^"]*)?)"/g)].map(m => ({ method: 'POST', href: m[1] })),
  ];

  for (const { method, href } of found) {
    linkCount++;
    const segs = linkSegments(href);
    /* A sentinel segment can only match a :param, which `resolves` already
       enforces by comparing segment counts and letting ':' match anything
       non-empty. Nothing extra to do here. */
    if (!resolves(method, segs)) dangling.push(`${f}: ${method} ${href}`);
  }
}

console.log('\n--- every link found in views/ resolves ---');
check(linkCount >= 20,
      `links collected (${linkCount})`,
      'suspiciously few — a broken regex here would make this gate pass by ' +
      'finding nothing to check');
check(dangling.length === 0,
      'no /account link points at an unregistered route',
      dangling.join('\n         '));

/* ═══ THE TWO KNOWN REGRESSIONS, NAMED ══════════════════════════════
   The sweep above would catch these if the LINK were present. These assert
   the ROUTE is present, so that deleting the route AND the link together —
   which the sweep would happily pass — still fails. Both of these pages
   were missing in production; neither gets to go missing quietly again. */
console.log('\n--- the routes that were missing in production exist ---');
for (const [method, p] of [
  ['GET', '/account/orders/14'],
  ['GET', '/account/orders/14/tracking'],
  ['GET', '/account/addresses'],
]) {
  check(resolves(method, p.split('/').filter(Boolean)),
        `${method} ${p} resolves`,
        'this exact URL 404\'d in production — see the header');
}

/* ═══ AND THE LINK AND ITS PAGE SHIP TOGETHER ═══════════════════════
   The Track Your Order button was written before its page existed, in the
   same session as the fix for the same defect. The view file must exist
   whenever the route renders it. */
console.log('\n--- every account view a route renders is on disk ---');
{
  const ctrl = fs.readFileSync(path.join(ROOT, 'src/controllers/accountController.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const rendered = new Set([...ctrl.matchAll(/res\.render\(\s*'(pages\/account\/[^']+)'/g)].map(m => m[1]));
  check(rendered.size >= 5, `render targets found (${rendered.size})`);
  for (const v of rendered) {
    check(fs.existsSync(path.join(ROOT, 'views', v + '.ejs')),
          `views/${v}.ejs exists`,
          'a controller renders a template that is not on disk — this throws ' +
          'at request time, not at boot');
  }
}

/* ═══ AND A BROKEN QUERY CANNOT IMPERSONATE "NOT FOUND" ════════════
 * THE DEFECT, 2026-10-27, four hours after the fix above shipped:
 *   `Customer.getOrder` selected `o.ship_name`. There is no such column —
 *   the table stores ship_first_name / ship_last_name. MySQL raised
 *   ER_BAD_FIELD_ERROR, the method's `catch { return null }` swallowed it,
 *   the controller read null as "no such order", and the customer got
 *   THE SAME 404 this feature was built to remove. The gate above passed
 *   the whole time, because the route was registered and the view existed:
 *   the link resolved perfectly to a page that then 404'd itself.
 *
 *   A catch that returns the same value as a legitimate empty result is
 *   indistinguishable from success at the call site. These two checks are
 *   the general rule and the specific column.
 */
console.log('\n--- a DB error cannot be disguised as "no such order" ---');
{
  const model = fs.readFileSync(path.join(ROOT, 'src/models/Customer.js'), 'utf8');

  /* Slice each method body by name, bounded by the next `async <name>(` or
     the module's end — not by a brace count, which comments and template
     literals in this file would defeat. */
  function body(name) {
    const start = model.indexOf(`async ${name}(`);
    if (start < 0) return null;
    const rest = model.slice(start + 1);
    const nextIdx = rest.search(/\n  (?:async )?[A-Za-z_]+\(/);
    return nextIdx < 0 ? rest : rest.slice(0, nextIdx);
  }

  for (const name of ['getOrder', 'getOrderItems', 'getOrderTracking']) {
    const b = body(name);
    check(b !== null, `${name} found in the model`);
    if (!b) continue;
    /* Comments stripped: these methods explain IN PROSE why they do not
       catch, and the word "catch" in that prose would satisfy a raw grep. */
    const code = b.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    check(!/\bcatch\b/.test(code),
          `${name} lets a DB error throw instead of returning a not-found value`,
          'a swallowed error here renders as 404 "that order does not exist" ' +
          'to a customer looking at an order they paid for');
  }

  /* The specific column. `ship_name` is fine as an AS alias — that is how
     getOrder now exposes the CONCAT — but selecting it as a column of
     `orders` is the bug. */
  const SRC = ['src/models/Customer.js', 'src/controllers/accountController.js'];
  for (const f of SRC) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    check(!/\bo\.ship_name\b/.test(src) && !/\borders\.ship_name\b/.test(src),
          `${f} does not select a ship_name column from orders`,
          'the orders table has ship_first_name / ship_last_name; ' +
          'o.ship_name raises ER_BAD_FIELD_ERROR');
  }

  check(/ship_first_name[\s\S]{0,120}ship_last_name[\s\S]{0,200}AS ship_name/.test(model),
        'getOrder builds ship_name from ship_first_name + ship_last_name',
        'deleting the CONCAT would pass the check above by removing the ' +
        'address block entirely — this asserts the replacement is present');
}

/* ═══ FREIGHT COPY IS NOT SHOWN TO A PARCEL CUSTOMER ═══════════════
 * The tracking page shipped telling every customer the carrier would
 * phone to arrange a delivery appointment and would not leave the
 * shipment without someone present. True of LTL, false of a UPS or
 * FedEx parcel, which is left at the door — and shippingController
 * books both (SMALLPACK has its own WWEX credentials and pickup flow).
 * A customer waiting in all day for a call that was never coming is a
 * defect the page cannot detect about itself.
 *
 * ⚠️ product_type IS THE DISCRIMINATOR; THE CARRIER NAME MUST NEVER BE.
 * 'FedEx' is both — FedEx Freight is LTL, FedEx Ground is parcel — so a
 * match on the carrier string is wrong half the time and looks fine in
 * review.
 */
console.log('\n--- delivery copy follows product_type, not the carrier name ---');
{
  const view = fs.readFileSync(path.join(ROOT, 'views/pages/account/order-tracking.ejs'), 'utf8');
  const code = view.replace(/<%#[\s\S]*?%>/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  /* Either form is correct: reading product_type directly, or asking
     shipMode (which reads product_type and nothing else). The view moved
     to the second on 2026-10-27 so admin and customer surfaces share ONE
     definition — this check failed on that improvement because it tested
     for the literal column name rather than for the rule. What matters
     is that the mode comes from the TYPE, never from the carrier, which
     the carrier check below enforces. */
  check((/product_type/.test(code) || /shipMode\.isParcel/.test(code)) && /SMALLPACK/.test(code),
        'the tracking view takes its mode from product_type (directly or via shipMode)',
        'without this every customer gets freight copy');

  /* Both modes must cover every status. A mode missing a status falls
     through to the raw-value fallback, which says nothing useful. */
  const copyBlock = code.slice(code.indexOf('var COPY'), code.indexOf('var SET'));
  const spIdx = copyBlock.indexOf('SMALLPACK:');
  check(spIdx > 0, 'both copy sets are in one object');
  if (spIdx > 0) {
    const ltl = copyBlock.slice(0, spIdx), sp = copyBlock.slice(spIdx);
    for (const status of ['booked', 'in_transit', 'delivered', 'exception']) {
      check(ltl.includes(status + ':') && sp.includes(status + ':'),
            `${status} copy exists for BOTH freight and parcel`,
            'the missing one renders the raw status with a generic sentence');
    }
    /* And the two are not the same text — satisfying the check above by
       pasting the freight wording into the parcel branch would reinstate
       the exact defect.

       ⚠️ ANCHORED ON THE PROMISE, NOT ON THE WORD 'appointment'. The
       first version of this check tested for that word and failed on
       correct code, because the parcel copy says "No appointment is
       needed" — a NEGATION of the promise contains the same word as the
       promise. What must not appear in the parcel branch is the
       commitment that somebody will phone. */
    check(/will call you/i.test(ltl), 'freight copy promises the carrier will call');
    check(!/will call you/i.test(sp),
          'parcel copy does NOT promise a call',
          'a parcel is left at the door; promising a call costs the ' +
          'customer a day at home');
  }

  /* No copy decision may be taken from the carrier string. */
  for (const f of ['views/pages/account/order-tracking.ejs',
                   'views/pages/account/order-detail.ejs']) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
      .replace(/<%#[\s\S]*?%>/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    check(!/tracking\.carrier\s*(?:\.(?:match|includes|indexOf|toLowerCase)|===|==|=~)/.test(src),
          `${path.basename(f)} does not branch on the carrier name`,
          'FedEx Freight is LTL and FedEx Ground is parcel — the name ' +
          'cannot tell them apart');
  }
}

console.log(fail ? `\n*** ${fail} of ${pass + fail} CHECKS FAILED ***`
                 : `\nALL ${pass} CHECKS PASS`);
process.exit(fail ? 1 : 0);
