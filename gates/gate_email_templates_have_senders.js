#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_email_templates_have_senders.js
 *
 * THE RULE: every ACTIVE row in `email_templates` must have a code path
 * that sends it.
 *
 * WHY THIS GATE EXISTS. Four templates — out_for_delivery,
 * order_delivered, review_request, cross_sell — sat in the table with
 * is_active = 1 from August to November 2026 and NOTHING EVER SENT THEM.
 * A customer spent $2,195, heard from us at purchase and at shipment,
 * then silence: no delivery confirmation on the day a freight truck
 * arrived, no review request, no cross-sell. See docs/BVO_GAP_ANALYSIS.md
 * GAP-01.
 *
 * Nothing caught it. Not review, not a gate, not testing. On 2026-10-27
 * the out_for_delivery SUBJECT LINE was rewritten, gated, committed and
 * pushed — copy polished on an email with no sender.
 *
 * ⚠️ WHY COMMENTS ARE STRIPPED BEFORE MATCHING, AND WHY THAT IS THE WHOLE
 * TRICK. `grep -rn "'out_for_delivery'" src/` returns three hits and
 * every one is a COMMENT about the shipments ENUM. A naive grep says the
 * template is wired. That near-miss is exactly how the gap survived being
 * looked for. Strings are stripped of comments first, in parser order.
 *
 * ⚠️ THE REVERSE DIRECTION IS A WARNING, NOT A FAILURE. auth_login_code,
 * auth_new_device and trade_application_received are called in code with
 * NO row in the table, on purpose: each has a hardcoded fallback via
 * brevo.sendRaw, because a security notice or a login code that silently
 * does not send because somebody deleted a row is worse than one slightly
 * out of date. Those three are allow-listed below. A NEW sender with no
 * row still gets reported, because that one probably is a mistake.
 *
 * ⚠️ "COULD NOT CHECK" IS NOT "PASS". The main assertion needs the real
 * table. Without DB credentials this gate exits 1 and says so, rather
 * than printing green and proving nothing. Use --no-db to run only the
 * static half, which says plainly that the main rule was not verified.
 *
 * Run:  node gates/gate_email_templates_have_senders.js
 *       node gates/gate_email_templates_have_senders.js --no-db
 * Exit: 0 = pass, 1 = fail
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const NO_DB = process.argv.includes('--no-db');

let pass = 0, fail = 0, warn = 0;
const ok = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};
const note = (label, why) => {
  console.log('  warn ' + label + (why ? '\n         ' + why : '')); warn++;
};

/* ⚠️ TEMPORARY. Active templates with no sender that are KNOWN and
   BLOCKED ON SOMETHING OTHER THAN EFFORT. Listed so this gate can go
   green on the real rule while still naming them on every run — a gate
   that is permanently red gets ignored, and an ignored gate is the same
   as no gate.

   ⚠️ ADDING TO THIS LIST IS HOW GAP-01 COMES BACK. Each entry needs the
   specific thing that unblocks it, not "later". Delete the entry the
   moment the template is wired; the gate then enforces it forever. */
const KNOWN_ORPHANS = {
  review_request:
    'needs the real Google review URL — the only value in the codebase is the '
  + 'literal placeholder https://g.page/r/YOUR_PLACE_ID/review in '
  + 'emailTemplatesController.js PREVIEW_VARS. Wiring it would send a dead link. '
  + 'ALSO marketing: must go through cartRecovery emailEligibility().',
  cross_sell:
    'needs a cross_sell_url destination (owner to choose: /collections/mirrors, '
  + 'or the model-matched mirror from the product page "Complete the Look"). '
  + 'ALSO marketing: must go through cartRecovery emailEligibility().',
};

/* Senders that legitimately have no row — each must keep its sendRaw
   fallback, which is asserted below rather than taken on trust. */
const CODE_FIRST = {
  auth_login_code:            'fallbackCodeEmail + sendRaw in accountController',
  auth_new_device:            'in-code security notice + sendRaw in accountController',
  trade_application_received: 'written fallback + sendRaw in tradeController',
};

console.log('\ngate_email_templates_have_senders — no template without a sender\n');

/* ═══ 1. FIND EVERY SENDER IN src/, COMMENTS REMOVED ═════════════════ */

/** Strip block and line comments WITHOUT eating string contents.
 *  Order matters: a URL inside a string contains "//" and a naive
 *  comment-strip run first would swallow the rest of that line. */
function stripComments(src) {
  let out = '', i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '"' || c === "'" || c === '`') {        // string: copy verbatim
      const q = c; out += c; i++;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i];
        if (src[i] === q) { i++; break; }
        i++;
      }
      continue;
    }
    if (c === '/' && d === '*') {                      // block comment
      i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2; out += ' '; continue;
    }
    if (c === '/' && d === '/') {                      // line comment
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    out += c; i++;
  }
  return out;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, acc); }
    /* ⚠️ .bak FILES ARE EXCLUDED. src/controllers/checkoutController.js
       .bak-acceptui-20260921211229 contains a live-looking
       sendTemplate('order_confirmed') call that nothing loads. Counting
       it would let a real sender be deleted while the gate stayed green. */
    else if (e.name.endsWith('.js') && !/\.bak/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = walk(path.join(ROOT, 'src'));
const senders = new Map();   // key -> [files]

/* ⚠️ WRAPPERS ARE RECOGNISED BY NAME, AND THE LIST IS LOAD BEARING.
   Not every send is a bare sendTemplate('key'). shipmentStatusPoll wraps
   its two in sendOnce(ctx, 'key', markerColumn, vars) so a Brevo failure
   cannot cost a status update and nothing can send twice.

   This gate's FIRST RUN proved why the list matters: it was written
   knowing only `sendTemplate`, and it immediately reported
   out_for_delivery and order_delivered as having no sender — minutes
   after they had been wired. A gate that cannot see a legitimate send
   raises false alarms until somebody stops believing it, which is worse
   than no gate.

   Adding a wrapper here is not enough on its own: section 1b asserts the
   wrapper really reaches brevo.sendTemplate, so it cannot quietly become
   a no-op while this gate keeps reporting green. */
const SEND_WRAPPERS = ['sendTemplate', 'sendOnce'];
const CALL_RE = new RegExp(
  `(?:${SEND_WRAPPERS.join('|')})\\(\\s*(?:[A-Za-z_$][\\w$]*\\s*,\\s*)?['"]([a-z0-9_]+)['"]`, 'gi');

for (const f of files) {
  const code = stripComments(fs.readFileSync(f, 'utf8'));
  const rel  = path.relative(ROOT, f);

  /* Literal key, either as the first argument (sendTemplate) or the
     second (sendOnce, whose first argument is the order context). */
  for (const m of code.matchAll(CALL_RE)) {
    if (!senders.has(m[1])) senders.set(m[1], []);
    senders.get(m[1]).push(rel);
  }
  // Via a module constant:  const TEMPLATE_KEY = 'cart_recovery'  →  sendTemplate(TEMPLATE_KEY
  for (const m of code.matchAll(/sendTemplate\(\s*([A-Z][A-Z0-9_]*)\s*[,)]/g)) {
    const def = code.match(
      new RegExp('(?:const|let|var)\\s+' + m[1] + '\\s*=\\s*[\'"]([a-z0-9_]+)[\'"]'));
    if (def) {
      if (!senders.has(def[1])) senders.set(def[1], []);
      senders.get(def[1]).push(rel + ` (via ${m[1]})`);
    } else {
      note(`sendTemplate(${m[1]}) in ${rel} — constant not resolvable`,
           'This gate cannot prove what key it sends. Resolve it or inline the string.');
    }
  }
}

console.log('--- senders found in src/ (comments stripped) ---');
for (const [k, where] of [...senders].sort()) {
  console.log(`  ${k.padEnd(28)} ${where[0]}`);
}

ok(senders.size > 0, 'at least one sendTemplate call was found',
   'Finding none means the scanner is broken, not that the code is clean.');

/* The scanner must survive the trap that hid GAP-01. */
{
  const fixture = `
    // sendTemplate('ghost_from_a_line_comment')
    /* sendTemplate('ghost_from_a_block_comment') */
    const u = 'https://example.com/x'; // a URL whose // must not eat this line
    brevo.sendTemplate('real_one', to, {});
  `;
  const s = stripComments(fixture);
  ok(!/ghost_from_a_line_comment|ghost_from_a_block_comment/.test(s),
     'commented-out sendTemplate calls are not counted as senders',
     'This is the exact near-miss that let GAP-01 survive a grep.');
  ok(/sendTemplate\('real_one'/.test(s),
     'a real call on a line following a URL survives stripping');
}

/* ═══ 1b. EVERY WRAPPER MUST ACTUALLY REACH brevo.sendTemplate ══════ */
console.log('\n--- send wrappers really send ---');
{
  const all = files.map(f => stripComments(fs.readFileSync(f, 'utf8'))).join('\n');
  for (const w of SEND_WRAPPERS) {
    if (w === 'sendTemplate') continue;              // the real thing
    const def = all.match(new RegExp(
      `(?:async\\s+)?function\\s+${w}\\s*\\(([\\s\\S]*?)\\n\\}`, 'm'));
    ok(def && /sendTemplate\(/.test(def[1]),
       `${w}() reaches brevo.sendTemplate`,
       `${w} is trusted by this gate as a send. If it stops sending, every`
       + ` key routed through it would be reported as wired while going nowhere —`
       + ` the GAP-01 failure with an extra layer of indirection.`);
  }
}

/* ═══ 2. THE CODE-FIRST SENDERS MUST KEEP THEIR FALLBACKS ═══════════ */
console.log('\n--- code-first senders keep a sendRaw fallback ---');
{
  const all = files.map(f => stripComments(fs.readFileSync(f, 'utf8'))).join('\n');
  for (const key of Object.keys(CODE_FIRST)) {
    if (!senders.has(key)) { note(`${key} is allow-listed but no longer sent`); continue; }
    /* The fallback idiom: sendTemplate(...) then `skipped` then sendRaw. */
    ok(/sendRaw\(/.test(all) && /\.skipped/.test(all),
       `${key} — fallback idiom present (${CODE_FIRST[key]})`,
       'Without it, deleting the DB row silently stops a login code or security notice.');
  }
}

/* ═══ 3. THE MAIN RULE — needs the real table ═══════════════════════ */
console.log('\n--- every active template has a sender ---');

if (NO_DB) {
  console.log('  ---- SKIPPED: --no-db was passed.');
  console.log('       THE MAIN RULE WAS NOT CHECKED. Only the scanner was.');
  console.log(`\n${pass} passed, ${fail} failed, ${warn} warning(s) — MAIN RULE UNVERIFIED\n`);
  process.exit(fail === 0 ? 0 : 1);
}

(async () => {
  let pool;
  try {
    for (const c of [
      process.env.BVO_ENV_PATH,
      '/home/u222311468/domains/bathroomvanitiesoutlet.com/hbuilds/config/.env',
      path.resolve(ROOT, '.env'),
    ].filter(Boolean)) {
      if (fs.existsSync(c)) { require('dotenv').config({ path: c }); if (process.env.DB_PASS) break; }
    }
    if (!process.env.DB_PASS) throw new Error('DB_PASS not found in any .env candidate');
    ({ bvoPool: pool } = require(path.join(ROOT, 'src/config/database')));

    const [rows] = await pool.query(
      'SELECT trigger_key, is_active FROM email_templates ORDER BY id');

    const active = rows.filter(r => Number(r.is_active) === 1).map(r => r.trigger_key);
    ok(active.length > 0, `email_templates has ${active.length} active row(s)`);

    for (const key of active) {
      if (senders.has(key)) { ok(true, `${key} — has a sender`); continue; }
      if (KNOWN_ORPHANS[key]) {
        note(`${key} — STILL AN ORPHAN (known, blocked)`, KNOWN_ORPHANS[key]);
        continue;
      }
      ok(false, `${key} — has a sender`,
         'Active in the table, sent by nothing, and NOT on the known-orphan '
       + 'list. This is GAP-01 recurring: a template somebody wrote and '
       + 'activated that no code path will ever send.');
    }

    /* A known-orphan entry that has since been wired must be deleted, or
       the list quietly becomes permission to leave things unsent. */
    for (const key of Object.keys(KNOWN_ORPHANS)) {
      if (senders.has(key)) {
        ok(false, `${key} is wired but still on KNOWN_ORPHANS`,
           'Remove it from the list so the gate enforces it from now on.');
      } else if (!active.includes(key)) {
        note(`${key} is on KNOWN_ORPHANS but is not an active template`,
             'Either it was deactivated or the key changed. Tidy the list.');
      }
    }

    console.log('\n--- senders with no active row (warning only) ---');
    for (const key of senders.keys()) {
      if (active.includes(key)) continue;
      if (CODE_FIRST[key]) {
        console.log(`  ok   ${key} — code-first by design (${CODE_FIRST[key]})`);
        pass++;
      } else {
        note(`${key} is sent by code but has no active row`,
             'sendTemplate returns {skipped:true} and sends NOTHING. Add the row, or a sendRaw fallback, or remove the call.');
      }
    }
  } catch (err) {
    console.log('  FAIL could not read email_templates — ' + (err && err.message));
    console.log('       "could not check" is NOT "pass". Run with DB access, or');
    console.log('       --no-db to run the scanner alone and say so out loud.');
    fail++;
  } finally {
    if (pool) await pool.end().catch(() => {});
  }

  console.log(`\n${pass} passed, ${fail} failed, ${warn} warning(s)\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
