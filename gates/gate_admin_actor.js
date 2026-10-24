'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   gate_admin_actor.js — req.session.adminUser, the audit trail's actor.

   THE DEFECT THIS EXISTS FOR (found 2026-10-24). adminUser was READ in 17
   places across five controllers and WRITTEN in none. Every audit row ever
   recorded — order status changes, captures, cancels, deletes, vendor POs,
   shipment events, trade approvals, customer outreach — stored the literal
   string 'admin'.

   It hid for two compounding reasons, and both are the reason this gate is
   shaped the way it is:

     1. `req.session?.adminUser || 'admin'` FAILS OPEN to a value that
        looks exactly like a real answer. Nothing errored, nothing logged,
        and the column was never empty.
     2. There is exactly one admin account (ADMIN_USER), so 'admin' was
        accidentally correct. The bug was latent — it would have become
        real and stayed silent the day multi-admin shipped.

   SO THIS GATE EXECUTES THE LOGIN HANDLER. A grep for
   `session.adminUser =` would have been satisfied by the line existing,
   which says nothing about whether it survives regenerate() or runs at
   all. Rule 14: make the thing runnable and run it. The session here is a
   fake whose regenerate() WIPES EVERYTHING, exactly as express-session's
   does — that is the behaviour that silently ate the cart in 2026-09-28
   and it must not be mocked away.

   AND IT PINS THE TYPE. 15 of the 17 reads interpolate the value straight
   into a DB column, so an object would store '[object Object]'.
   tradeController was the lone `.email`-shaped read and is now a string
   read like the rest; if a new one appears, section 3 goes red.
   ═══════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (c ? '' : '   <- ' + d));
  if (!c) fail++;
};

/* ── 1. EXECUTE THE LOGIN HANDLER ─────────────────────────────────── */
console.log('--- login actually writes adminUser onto the session ---');

const Module  = require('module');
const origLoad = Module._load;
Module._load = function (request) {
  /* adminController pulls in the DB pool at module scope. */
  if (request.indexOf('config/database') !== -1) {
    return { bvoPool: { query: async () => [[]] }, rflPool: { query: async () => [[]] } };
  }
  return origLoad.apply(this, arguments);
};

/* A real bcrypt hash of 'correct-horse'. Using the real library rather
   than a stub keeps the password comparison honest.
   ⚠️ bcryptJS, not bcrypt — adminController requires 'bcryptjs' and that
   is what package.json installs. Requiring 'bcrypt' here would hash with
   a library the app does not have. */
const bcrypt = require('bcryptjs');
const PASSWORD = 'correct-horse';
const HASH     = bcrypt.hashSync(PASSWORD, 4);   // low cost: this is a test

process.env.ADMIN_USER   = 'sam@bvo';
process.env.ADMIN_PW_B64 = Buffer.from(HASH).toString('base64');

let admin;
try {
  admin = require(path.join(ROOT, 'src/controllers/adminController.js'));
  ok('adminController loads', typeof admin.login === 'function');
} catch (e) {
  ok('adminController loads', false, e.message);
}

/* express-session's regenerate() DISCARDS THE SESSION CONTENTS. Modelled
   faithfully, because a regenerate that preserved state would make this
   gate pass on code that writes adminUser BEFORE the regenerate — which
   is precisely the mistake establishSession had to be built to avoid. */
function fakeSession() {
  const s = {
    regenerate(cb) {
      for (const k of Object.keys(s)) {
        if (typeof s[k] !== 'function') delete s[k];
      }
      cb(null);
    },
    destroy(cb) { cb(null); },
    save(cb) { cb && cb(null); },
  };
  return s;
}

async function runLogin(body) {
  const session = fakeSession();
  let redirected = null, rendered = null;
  const req = { body, session };
  const res = {
    redirect: (u) => { redirected = u; },
    render:   (v, o) => { rendered = { v, o }; },
    locals:   {},
    status:   () => res,
  };
  await admin.login(req, res);
  /* regenerate's callback is synchronous in the fake, but login() returns
     before the redirect in the real async path, so yield once. */
  await new Promise(r => setImmediate(r));
  return { session, redirected, rendered };
}

/* Wrapped in an async main(): top-level await in a .js file with require()
   is ERR_AMBIGUOUS_MODULE_SYNTAX on Node 22. */
async function main() {
if (admin && admin.login) {
  const good = await runLogin({ username: 'sam@bvo', password: PASSWORD });

  ok('correct credentials sign in', good.redirected === '/admin',
     'redirected to ' + good.redirected);
  ok('isAdmin is set', good.session.isAdmin === true,
     String(good.session.isAdmin));

  /* THE CHECK THE WHOLE FILE EXISTS FOR. */
  ok('adminUser is set on the session',
     good.session.adminUser !== undefined,
     'undefined — every audit row will record the literal string "admin"');

  ok('adminUser is the configured ADMIN_USER',
     good.session.adminUser === 'sam@bvo',
     JSON.stringify(good.session.adminUser));

  /* A STRING. An object here means '[object Object]' in 15 DB columns. */
  ok('adminUser is a primitive string, not an object',
     typeof good.session.adminUser === 'string',
     'typeof is ' + typeof good.session.adminUser);

  /* It must land AFTER regenerate. Written before, it is wiped and this is
     the only check that can tell the difference. */
  ok('adminUser survives session.regenerate()',
     good.session.adminUser === 'sam@bvo' && good.session.isAdmin === true,
     'the write happened on the pre-regenerate session and was discarded');

  const bad = await runLogin({ username: 'sam@bvo', password: 'wrong' });
  ok('a wrong password sets no actor',
     bad.session.adminUser === undefined && bad.session.isAdmin !== true,
     'adminUser=' + JSON.stringify(bad.session.adminUser));
  ok('a wrong password re-renders the login page', !!bad.rendered, 'no render');
}

Module._load = origLoad;

/* ── 2. EVERY READ SITE IS ACCOUNTED FOR ──────────────────────────── */
console.log('--- all read sites, one shape ---');

const CONTROLLERS = path.join(ROOT, 'src/controllers');
const reads = [];
for (const f of fs.readdirSync(CONTROLLERS)) {
  if (!f.endsWith('.js')) continue;
  const raw  = fs.readFileSync(path.join(CONTROLLERS, f), 'utf8');
  /* Comments stripped — these files now DISCUSS adminUser at length, and
     prose must not satisfy a check about code. Rule 18 corollary. */
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const m = code.match(/session(?:\?\.)?\.?adminUser[^\n]*/g) || [];
  for (const line of m) reads.push({ file: f, line: line.trim() });
}

ok('read sites still exist (the audit trail was not deleted)',
   reads.length > 0, 'none found — did the actor get removed?');

/* ── 3. NO .email-SHAPED READ ANYWHERE ─────────────────────────────── */
const objShaped = reads.filter(r => /adminUser\s*(?:&&|\?\.|\.)\s*\w*\.?email|adminUser\.email/.test(r.line));
ok('no read treats adminUser as an object with .email',
   objShaped.length === 0,
   objShaped.map(r => r.file + ': ' + r.line).join(' | '));

/* Non-login writes would be a second source of truth for the actor. */
const writes = [];
for (const f of fs.readdirSync(CONTROLLERS)) {
  if (!f.endsWith('.js')) continue;
  const raw  = fs.readFileSync(path.join(CONTROLLERS, f), 'utf8');
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  if (/session\.adminUser\s*=[^=]/.test(code)) writes.push(f);
}
ok('adminUser is written in exactly one place',
   writes.length === 1 && writes[0] === 'adminController.js',
   'written in: ' + (writes.join(', ') || 'NOWHERE'));

console.log('\nread sites: ' + reads.length + '  (all string-shaped)');
console.log(fail ? '\n*** ' + fail + ' GATE(S) FAILED ***' : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
}

main().catch(err => {
  console.error('\n*** GATE CRASHED *** ' + (err && err.stack || err));
  process.exit(1);
});
