'use strict';
/* Gates for the 2026-09-27 deliverability changes:
   plain-text alternative, replyTo, and per-trigger tags.

   The deriver is EXERCISED, not grepped. htmlToText is extracted from
   source and run, because requiring brevoService drags in
   ../config/database, which hard-exits the process when DB_PASS is
   unset — a gate that needs a database password to check a regex is a
   gate that gets skipped. */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'src/services/brevoService.js'), 'utf8');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (c ? '' : '   <- ' + d));
  if (!c) fail++;
};

console.log('--- syntax ---');
try { new vm.Script(src); ok('brevoService.js parses', true); }
catch (e) { ok('brevoService.js parses', false, e.message); }

const m = src.match(/function htmlToText\(html\)\s*\{[\s\S]*?\n\}/);
const t = src.match(/function textFor\(html, subject\)\s*\{[\s\S]*?\n\}/);
ok('htmlToText present', !!m, 'not found');
ok('textFor present', !!t, 'not found');
if (!m || !t) { console.log('\n*** cannot continue ***'); process.exit(1); }

/* Named _fn rather than reusing the source names: `const htmlToText =
   eval('... htmlToText)')` puts the outer binding in its temporal dead
   zone at exactly the moment the eval'd expression resolves the name,
   and it throws instead of returning the function. */
const htmlToText_fn = eval('(function(){' + m[0] + '; return htmlToText; })()');
const textFor_fn    = eval('(function(){' + m[0] + ';' + t[0] + '; return textFor; })()');
const htmlToText = htmlToText_fn;
const textFor    = textFor_fn;

console.log('--- deriver behaviour ---');
const AMP = String.fromCharCode(38);   // avoids any shell/quoting hazard
const LT  = String.fromCharCode(60);
const GT  = String.fromCharCode(62);

ok('strips tags',
   htmlToText('<p>Hello <b>world</b></p>') === 'Hello world',
   JSON.stringify(htmlToText('<p>Hello <b>world</b></p>')));

ok('style body does NOT survive',
   !/color/i.test(htmlToText('<style>p{color:red}</style><p>Hi</p>')),
   JSON.stringify(htmlToText('<style>p{color:red}</style><p>Hi</p>')));

ok('script body does NOT survive',
   !/alert/i.test(htmlToText('<script>alert(1)</scr' + 'ipt><p>Hi</p>')),
   JSON.stringify(htmlToText('<script>alert(1)</scr' + 'ipt><p>Hi</p>')));

ok('br becomes newline',
   htmlToText('a<br>b') === 'a\nb', JSON.stringify(htmlToText('a<br>b')));

const ent = '<p>Tom ' + AMP + 'amp; Jerry' + AMP + 'nbsp;' + AMP + '#39;s</p>';
ok('entities decoded',
   htmlToText(ent) === "Tom " + AMP + " Jerry 's",
   JSON.stringify(htmlToText(ent)));

/* THE ORDERING TRAP. Decoding entities BEFORE stripping tags turns
   escaped text into a fake tag and deletes everything up to the next
   '>' — silently truncating the message. */
const esc = '<p>use ' + AMP + 'lt;b' + AMP + 'gt; for bold</p>';
/* Assert the ESCAPED TAG SURVIVES AS TEXT, not merely that the trailing
   words do. Broken ordering yields "use  for bold" — the words after it
   are still there, so a check for 'for bold' passes while the content is
   quietly gone. That exact assertion was written first and a mutation
   test walked straight through it. */
ok('escaped angle brackets survive as literal text',
   htmlToText(esc) === 'use ' + LT + 'b' + GT + ' for bold',
   JSON.stringify(htmlToText(esc)));

ok('six-digit code survives (the login case)',
   htmlToText('<p>Your code is <strong>823059</strong></p>').indexOf('823059') !== -1,
   JSON.stringify(htmlToText('<p>Your code is <strong>823059</strong></p>')));

ok('never empty for an image-only body',
   textFor('<img src=x>', 'Your BVO code') === 'Your BVO code',
   JSON.stringify(textFor('<img src=x>', 'Your BVO code')));

ok('never empty with no subject either',
   textFor('', '').length > 0, 'returned empty');

console.log('--- payload wiring ---');
const bodies = src.split('BREVO_API_URL,').slice(1);
ok('three send payloads found', bodies.length === 3, 'found ' + bodies.length);
bodies.forEach((b, i) => {
  const head = b.slice(0, 1200);
  ok('payload ' + (i + 1) + ' sets textContent via textFor',
     /textContent:\s*textFor\(/.test(head), 'missing');
  ok('payload ' + (i + 1) + ' sets replyTo',
     /replyTo:\s*\{/.test(head), 'missing');
});

ok('tags applied once, on sendTemplate only',
   (src.match(/tags:\s*\[String\(triggerKey\)\]/g) || []).length === 1,
   'wrong count');

ok('REPLY_TO declared before first use',
   src.indexOf('const REPLY_TO') > -1 &&
   src.indexOf('const REPLY_TO') < src.indexOf('replyTo:'),
   'declared after use or missing');

ok('REPLY_TO falls back to FROM_EMAIL',
   /const REPLY_TO\s*=\s*process\.env\.BREVO_REPLY_TO\s*\|\|\s*FROM_EMAIL/.test(src),
   'no fallback');

console.log('--- diagnostics controller ---');
const dgPath = path.join(ROOT, 'src/controllers/emailDiagnosticsController.js');
const dg = fs.readFileSync(dgPath, 'utf8');
try { new vm.Script(dg); ok('diagnostics parses', true); }
catch (e) { ok('diagnostics parses', false, e.message); }
ok('test send carries textContent', /textContent:/.test(dg), 'missing');
ok('test send carries replyTo',     /replyTo:/.test(dg), 'missing');
ok('test send is tagged',           /tags:\s*\['diagnostics_test'\]/.test(dg), 'missing');

console.log(fail ? '\n*** ' + fail + ' GATE(S) FAILED ***' : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
