'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_admin_nav_reachable.js
 *
 * THE RULE: EVERY ADMIN PAGE MUST BE REACHABLE FROM THE ADMIN NAV.
 *
 * THE DEFECT (2026-10-22, found by the owner, not by any test):
 *   A trade applicant submitted. The row saved. The confirmation rendered.
 *   The owner then could not find the application anywhere — because
 *   /admin/trade had NO LINK IN THE SIDEBAR. Twenty-two nav items, and the
 *   word "trade" did not appear in the layout at all.
 *
 *   Everything else existed: the route, the controller (adminQueue), the
 *   page (trade-applications.ejs), the approve/decline flow. adminQueue
 *   even set `activePage: 'trade'` — the highlight key for a nav item that
 *   was never written. The intent is in the code; the link was not.
 *
 * WHY THIS IS WORTH A GATE RATHER THAN A ONE-LINE FIX:
 *   Nothing was broken. Every component passed every check that existed.
 *   A feature nobody can navigate to is indistinguishable from a feature
 *   that does not work, and it fails silently and permanently — there is
 *   no error, no log line, no 404. It is found only when somebody goes
 *   looking for something they know should be there.
 *
 *   `activePage` makes the rule checkable: a controller that sets it is
 *   declaring "I am a nav destination". If the layout has no item matching
 *   that key, the destination is orphaned.
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
const check = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

const LAYOUT = fs.readFileSync(path.join(ROOT, 'views/layouts/admin.ejs'), 'utf8')
  .replace(/<%#[\s\S]*?%>/g, '');   // strip EJS comments — they quote keys

/* Every activePage the layout can highlight. */
const navKeys = new Set(
  [...LAYOUT.matchAll(/activePage\s*===\s*'([^']+)'/g)].map(m => m[1]));

/* Every activePage any admin controller declares. */
const CONTROLLERS = fs.readdirSync(path.join(ROOT, 'src/controllers'))
  .filter(f => f.endsWith('.js'));

const declared = new Map();   // key -> [files]
for (const f of CONTROLLERS) {
  const src = fs.readFileSync(path.join(ROOT, 'src/controllers', f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const m of src.matchAll(/activePage:\s*'([^']+)'/g)) {
    if (!declared.has(m[1])) declared.set(m[1], []);
    if (!declared.get(m[1]).includes(f)) declared.get(m[1]).push(f);
  }
}

/* ⚠️ DELIBERATELY DORMANT DESTINATIONS, NAMED ONE BY ONE.
   A key here is NOT a page we failed to link — it is a page intentionally
   switched off, where the handler still exists but its route does not.
   Listing them individually (rather than relaxing the rule) keeps the
   exemption visible: adding one is a line in a diff a reviewer can argue
   with, and the reason has to be written down.

   'sync' — the RFLPOS sync. src/routes/admin.js has every /sync route
   commented out and replaced with `router.all('/sync*')` returning 503,
   and the sidebar item carries admin-nav-disabled + an "off" badge. The
   activePage:'sync' in adminController belongs to syncPage, which no route
   can reach. Re-enabling the sync means deleting this entry. */
const DORMANT = new Map([
  ['sync', 'RFLPOS sync is switched off — routes commented out, nav item disabled, handler unreachable'],
]);

console.log('\n1. Every activePage a controller declares has a nav item');

check(navKeys.size > 0, `the layout defines nav keys (found ${navKeys.size})`,
  'If this is zero the matcher has stopped working and every check below passes by not looking.');
check(declared.size > 0, `controllers declare activePage values (found ${declared.size})`);

for (const [key, files] of [...declared].sort()) {
  if (DORMANT.has(key)) {
    check(!navKeys.has(key),
      `activePage '${key}' is dormant and correctly has no live nav item`,
      `'${key}' is listed in DORMANT (${DORMANT.get(key)}). If it now HAS a nav item it is live again — delete it from DORMANT so the real rule applies.`);
    continue;
  }
  check(navKeys.has(key),
    `activePage '${key}' has a nav item  (${files.join(', ')})`,
    `This page sets activePage:'${key}' — it is declaring itself a nav destination — but no sidebar item matches that key. The page is only reachable by typing its URL. That is how the trade application queue stayed invisible while working perfectly.`);
}

console.log('\n2. The trade queue specifically — the page that was orphaned');

check(navKeys.has('trade'),
  "the sidebar links to the trade queue",
  'Regression of the 2026-10-22 defect: a trade applicant submits, the row saves, and the owner cannot find it.');
check(/href="\/admin\/trade"/.test(LAYOUT),
  'and the href points at /admin/trade',
  'The highlight key alone is not a link. Both are needed: the key lights it up, the href gets you there.');

console.log('\n3. Nav items point at routes that exist');

const ROUTES = fs.readFileSync(path.join(ROOT, 'src/routes/admin.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/* ⚠️ THE REVERSE DIRECTION, AND IT IS A DIFFERENT BUG.
   Section 1 catches a page with no link. This catches a link to nothing —
   a nav item surviving a route rename, which gives a 404 on click. Both
   are "unreachable", from opposite ends. */
const hrefs = [...LAYOUT.matchAll(/href="\/admin(\/[^"]*)?"/g)]
  .map(m => m[1] || '/')
  .filter(p => !p.includes('?'));

/* ⚠️ router.get IS NOT THE ONLY WAY A PATH IS SERVED, AND ASSUMING SO GAVE
   THIS GATE A FALSE FAILURE ON ITS FIRST RUN.
   /admin/sync has no router.get — every /sync route is commented out and
   replaced with `router.all('/sync*', ...)` returning a deliberate 503.
   The link does NOT 404; it reaches an intentional "switched off" page.

   A gate that reports a correct arrangement as broken gets argued with
   once and deleted the second time, so the matcher now understands every
   verb and trailing-wildcard patterns. Collect what the router actually
   declares, then ask whether each href is served. */
const declaredPaths = [...ROUTES.matchAll(
  /router\.(get|post|put|patch|delete|all)\s*\(\s*['"]([^'"]+)['"]/g)]
  .map(m => m[2]);

const served = p => declaredPaths.some(d => {
  if (d === p) return true;
  if (d.endsWith('*')) return p.startsWith(d.slice(0, -1));   // '/sync*'
  return false;
});

for (const p of [...new Set(hrefs)].sort()) {
  check(served(p),
    `nav href /admin${p === '/' ? '' : p} is served by a route`,
    'This sidebar link 404s. A route was probably renamed without updating the nav — the reverse of the trade-queue defect, and equally invisible until somebody clicks it.');
}

console.log(
  fail === 0
    ? `\nGREEN  ${pass} passed, 0 failed`
    : `\ngate_admin_nav_reachable: FAILED ${fail} of ${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);
