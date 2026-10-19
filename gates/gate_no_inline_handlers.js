#!/usr/bin/env node
'use strict';

/* gate_no_inline_handlers.js — no markup may carry an inline event handler.
 *
 * WHY THIS EXISTS. On 2026-09-21, bad36bf set
 *
 *     scriptSrcAttr: ["'none'"]          (src/server.js)
 *
 * which tells the browser to refuse EVENT HANDLER ATTRIBUTES — onclick=,
 * onchange=, onkeydown= and the rest. The storefront PDP was converted to
 * delegated listeners in that same scope. THE ADMIN WAS NOT, and the
 * constraint was never written into CLAUDE.md or BVO_AUDIT_BRIEF.md, so
 * every session since has kept writing onclick= without knowing it could
 * not work.
 *
 * ⚠️ A NONCE DOES NOT RESCUE AN INLINE HANDLER. Nonces and hashes apply to
 * <script> BLOCKS. The browser's own words: "hashes do not apply to event
 * handlers, style attributes and javascript: navigations". A page can carry
 * a perfectly good nonce and still have every button dead.
 *
 * THE FAILURE IS SILENT, WHICH IS WHY IT SURVIVED A MONTH. No dialog, no
 * network request, no error surfaced to the operator. The browser reports
 * the refusal to the console and the button simply does nothing. On
 * 2026-10-19 the Release Hold button on an order with a live $89
 * authorization read exactly like a broken API endpoint, and cost a live
 * debugging session before the console was opened.
 *
 * THE FIX IS NEVER 'unsafe-inline'. Adding it to scriptSrcAttr reopens
 * precisely what bad36bf closed. Convert the handler instead — see the
 * ACTION DISPATCH block at the foot of views/pages/admin/orders/detail.ejs,
 * or the delegated controls described at views/pages/product.ejs:1081.
 *
 * ⚠️ TWO ZONES, NOT ONE. The first draft of this gate scanned markup only
 * and would have passed a page whose every button was still dead.
 *
 * A handler written into markup BY JAVASCRIPT is just as refused as one
 * typed into the template — the CSP judges the attribute the browser is
 * asked to attach, not where the string came from. admin/shipping/
 * create.ejs builds its rate buttons as
 *
 *     html += '<button id="…" onclick="selectRate(\'' + id + '\')">'
 *
 * so selectRate is unreachable and NO SHIPMENT CAN BE BOOKED, while a
 * markup-only scan reports the file clean. Zone B below catches these.
 *
 * Delegation fixes both at once, which is the other reason to prefer it:
 * a listener bound to document works on nodes that do not exist yet, so
 * dynamically-inserted rows need no re-binding.
 *
 * WHAT IS DELIBERATELY NOT SCANNED, and why each would be a false positive:
 *   • plain JS property assignment (el.onclick = fn) — that is a DOM
 *     property, not an attribute, and the CSP permits it. Zone B requires
 *     a quote after the = to tell the two apart.
 *   • EJS comments <%# … %> and <%/* … *\/%> — documentation ABOUT the
 *     problem, including this gate's own explanatory notes in the files it
 *     polices. The first draft of this gate failed on the comment that
 *     describes the fix.
 *   • data-* attributes — data-onclick= is not an event handler. The
 *     pattern requires whitespace before "on", so a hyphen does not match.
 */

const fs   = require('fs');
const path = require('path');
const cp   = require('child_process');
const ROOT = path.join(__dirname, '..');
const VIEWS = path.join(ROOT, 'views');

/* ── ONLY POLICE WHAT SHIPS ──────────────────────────────────────────────
 * .gitignore lines 36-37 ignore *-1.ejs and *-1.js. That is a deliberate
 * convention on this project: a `-1` file is a local working copy taken
 * before a risky edit — collection-1.ejs, index-1.ejs, homeController-1.js,
 * collectionsController-1.js. They are never committed, so the git deploy
 * never carries them to the server, and nothing in src/ or views/ refers
 * to one.
 *
 * A gate that fails on them is wrong twice over. It reports a defect in
 * something that cannot reach a customer, and — worse — it pressures the
 * next person to EDIT A BACKUP to make the build go green, which destroys
 * the thing the backup existed to preserve. That happened on 2026-10-19:
 * collection-1.ejs was "fixed" and had to be restored by hand.
 *
 * So the scan is scoped to files git would actually ship. If git is not
 * available the gate scans everything rather than silently checking less —
 * a gate that quietly narrows its own scope is worse than a noisy one. */
let IGNORED = new Set();
try {
  const out = cp.execFileSync('git', ['ls-files', '--others', '--ignored',
                                      '--exclude-standard', '--', 'views'],
                              { cwd: ROOT, encoding: 'utf8' });
  IGNORED = new Set(out.split('\n').filter(Boolean)
                       .map(p => path.join(ROOT, p)));
} catch (e) {
  console.log('  note  git unavailable — scanning every file, including ignored ones');
}

let checks = 0, fails = 0;
const ok    = m => { checks++; console.log('  ok   ' + m); };
const bad   = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);

console.log('\ngate_no_inline_handlers — the CSP refuses onclick=, so nothing may ship one\n');

/* ── walk every .ejs ─────────────────────────────────────────────── */
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ejs')) out.push(p);
  }
  return out;
}

/* Blank out a region, PRESERVING NEWLINES, so reported line numbers still
   point at the real line in the real file. Deleting the text instead would
   renumber everything after the first <script> block. */
function blank(s, re) {
  return s.replace(re, m => m.replace(/[^\n]/g, ' '));
}

/* ⚠️ COMMENTS FIRST, SCRIPTS SECOND. The order is load-bearing and the
   first draft had it backwards.
 *
 * A comment that mentions "<script>" — which the dispatcher partial does,
 * while explaining that nonces apply to script blocks — made the script
 * regex match from that word all the way to the real </script> at the end
 * of the file. Everything after it was blanked, so the comment's own
 * closing %> was erased, the comment rule could no longer match, and the
 * prose above it was scanned as live markup. The gate reported five
 * offences in its own documentation.
 *
 * Blanking comments first removes that text before the script rule ever
 * sees it, so prose about markup can never be mistaken for markup. */
function stripComments(s) {
  s = blank(s, /<%#[\s\S]*?%>/g);          // <%# ejs comment %>
  s = blank(s, /<%\/\*[\s\S]*?\*\/%>/g);   // <%/* ejs comment */%>
  s = blank(s, /<!--[\s\S]*?-->/g);        // html comment

  /* JS comments INSIDE a <% … %> scriptlet. index.ejs documents an XSS it
     defends against — a bg_color of `" onload="alert(1)` — and that prose
     is not markup. Only the comments are blanked, not the whole scriptlet,
     so a scriptlet that genuinely concatenates a handler into a string is
     still caught. */
  s = s.replace(/<%[^#=-][\s\S]*?%>/g, function (block) {
    return blank(blank(block, /\/\*[\s\S]*?\*\//g), /\/\/[^\n]*/g);
  });
  return s;
}

function scannableMarkup(src) {
  let s = stripComments(src);
  s = blank(s, /<script[\s\S]*?<\/script>/gi);  // JS — Zone B's job
  return s;
}

/* ZONE B — the inverse: ONLY the script blocks, everything else blanked,
   with JS line comments dropped so a note about onclick= is not a finding. */
function scannableScripts(src) {
  /* Same ordering trap as scannableMarkup — strip comments before looking
     for <script>, or a comment that says the word captures the rest of the
     file and the real script block is never isolated. */
  const cleaned = stripComments(src);
  const out = [];
  const re = /<script[\s\S]*?<\/script>/gi;
  let m, last = 0, s = '';
  while ((m = re.exec(cleaned)) !== null) {
    s += cleaned.slice(last, m.index).replace(/[^\n]/g, ' ');
    s += m[0];
    last = m.index + m[0].length;
  }
  s += cleaned.slice(last).replace(/[^\n]/g, ' ');
  s = blank(s, /\/\*[\s\S]*?\*\//g);   // /* block comment */
  s = blank(s, /\/\/[^\n]*/g);         // // line comment
  out.push(s);
  return out[0];
}

/* Whitespace, then on<name>, then =. The leading \s is what keeps
   data-onclick= and aria-*on* out of the results. */
const HANDLER = /\son([a-z]+)\s*=/gi;

/* Zone B needs the QUOTE. `el.onclick = fn` is a DOM property assignment
   and is allowed; `'<button onclick="fn()">'` is an attribute in a string
   and is refused. The quote immediately after = is what separates them. */
const HANDLER_IN_JS = /\son([a-z]+)\s*=\s*["'\\]/gi;

/* ── 1. the detector detects ─────────────────────────────────────── */
console.log('--- the detector itself works ---');
{
  const probe = '<button onclick="x()">hi</button>';
  check(HANDLER.test(probe), 'a bare onclick= is caught');
  HANDLER.lastIndex = 0;

  const scriptOnly = scannableMarkup('<script nonce="x">el.onclick = f;</script>');
  check(!/\son[a-z]+\s*=/i.test(scriptOnly),
        'onclick INSIDE a <script> block is ignored',
        'property assignment in JS is not a markup attribute');

  const commented = scannableMarkup('<%# these were onclick="" attributes %>');
  check(!/\son[a-z]+\s*=/i.test(commented),
        'onclick inside an EJS comment is ignored',
        'the first draft of this gate failed on its own documentation');

  const dataAttr = '<button data-onclick="x">';
  dataAttr.replace(HANDLER, () => {});
  HANDLER.lastIndex = 0;
  check(!HANDLER.test(dataAttr), 'data-onclick= is NOT treated as a handler');
  HANDLER.lastIndex = 0;

  /* Zone B, both directions. This is the pair the first draft got wrong. */
  const built = scannableScripts('<script>html += \'<button onclick="go()">\';</script>');
  HANDLER_IN_JS.lastIndex = 0;
  check(HANDLER_IN_JS.test(built),
        'a handler built INSIDE a JS string is caught',
        'create.ejs writes its rate buttons this way — markup-only scanning misses them');
  HANDLER_IN_JS.lastIndex = 0;

  const prop = scannableScripts('<script>el.onclick = doThing;</script>');
  HANDLER_IN_JS.lastIndex = 0;
  check(!HANDLER_IN_JS.test(prop),
        'el.onclick = fn (a DOM property) is NOT flagged',
        'property assignment is permitted by the CSP; only attributes are refused');
  HANDLER_IN_JS.lastIndex = 0;

  const jsComment = scannableScripts('<script>// was onclick="x()" once\n</script>');
  HANDLER_IN_JS.lastIndex = 0;
  check(!HANDLER_IN_JS.test(jsComment), 'a JS comment mentioning onclick= is ignored');
  HANDLER_IN_JS.lastIndex = 0;

  /* Line numbers must survive the blanking, or every report is useless. */
  const two = scannableMarkup('<script>\nx\n</script>\n<b onclick="y()">');
  check(two.split('\n').length === 4 && /onclick/.test(two.split('\n')[3]),
        'blanking preserves line numbers',
        'deleting a <script> block would renumber everything below it');
}

/* ── 2. the sweep ────────────────────────────────────────────────── */
console.log('\n--- every .ejs under views/ ---');
const allFiles = walk(VIEWS, []);
const files    = allFiles.filter(f => !IGNORED.has(f));
const skipped  = allFiles.length - files.length;
check(files.length > 0,
      `found ${files.length} .ejs files to scan` +
      (skipped ? ` (${skipped} gitignored, never deployed — not scanned)` : ''));

const offenders = [];
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const src = fs.readFileSync(f, 'utf8');

  /* Zone A — markup written in the template. */
  scannableMarkup(src).split('\n').forEach((line, i) => {
    let m;
    HANDLER.lastIndex = 0;
    while ((m = HANDLER.exec(line)) !== null) {
      offenders.push({ file: rel, line: i + 1, attr: 'on' + m[1].toLowerCase(), zone: 'markup' });
    }
  });

  /* Zone B — markup assembled by JavaScript. Equally refused, and the
     blind spot that would have let the shipping wizard ship still broken. */
  scannableScripts(src).split('\n').forEach((line, i) => {
    let m;
    HANDLER_IN_JS.lastIndex = 0;
    while ((m = HANDLER_IN_JS.exec(line)) !== null) {
      offenders.push({ file: rel, line: i + 1, attr: 'on' + m[1].toLowerCase(), zone: 'js-built' });
    }
  });
}

if (offenders.length) {
  const byFile = offenders.reduce((a, o) => ((a[o.file] = (a[o.file] || 0) + 1), a), {});
  const summary = Object.entries(byFile)
    .sort((a, b) => b[1] - a[1])
    .map(([f, n]) => `${String(n).padStart(3)}  ${f}`)
    .join('\n         ');
  const nJs = offenders.filter(o => o.zone === 'js-built').length;
  bad(`NO inline event handlers (found ${offenders.length}: ` +
      `${offenders.length - nJs} in markup, ${nJs} built by JS)`,
      summary + '\n\n         JS-BUILT (invisible to a markup-only scan):\n         ' +
      (nJs
        ? offenders.filter(o => o.zone === 'js-built')
            .map(o => `${o.file}:${o.line}  ${o.attr}=`).join('\n         ')
        : '(none)'));
} else {
  ok(`no inline event handler in any of ${files.length} .ejs files`);
}

/* ── 3. the policy that makes this necessary is still in force ───── */
console.log('\n--- the CSP still refuses them ---');
{
  const srv = fs.readFileSync(path.join(ROOT, 'src/server.js'), 'utf8');
  check(/scriptSrcAttr\s*:\s*\[\s*["']'none'["']\s*\]/.test(srv),
        "server.js still sets scriptSrcAttr: ['none']",
        'if this was relaxed to unsafe-inline, bad36bf has been undone — ' +
        'that is a security regression, not a fix for a dead button');
}

console.log('\n' + (fails
  ? 'gate_no_inline_handlers: FAILED ' + fails + ' of ' + checks
  : 'gate_no_inline_handlers: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
