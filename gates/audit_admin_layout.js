'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   audit_admin_layout.js — every res.render of an admin view must pass
   layout: 'layouts/admin'.

   WHY. app.set('layout', 'layouts/main') in server.js makes the STOREFRONT
   layout the default for everything. An admin controller that forgets the
   layout therefore does not error — it renders the admin page inside the
   customer layout, cart drawer and all, with no sidebar. It looks like a
   styling bug and it is actually a routing-level mistake.

   This has now happened twice: task #205 (email-templates, which returned
   the generic error page because its views also called layout() themselves)
   and /admin/diagnostics/email, found 2026-10-24 — reachable from the
   sidebar yet rendering with zero nav items, so the only recovery tool for
   a locked-out customer was also a dead end once you arrived.

   CLAUDE.md: "⛔ EJS LAYOUT RULE — NEVER VIOLATE" — the layout comes from
   the controller, never from a layout() call in the template.

   COMMENTS ARE STRIPPED FIRST. Several of these controllers discuss the
   layout rule in prose directly above the render call, which would satisfy
   a naive /layout:/ test on the surrounding text. Rule 18 corollary.
   ═══════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(path.join(ROOT, 'src'));

/* res.render('<admin view>', { ... }) — also matches
   res.status(500).render(...). The arg window is generous because some of
   these option objects are long. */
const RENDER = new RegExp(
  'res\\s*\\.\\s*(?:status\\(\\s*\\d+\\s*\\)\\s*\\.\\s*)?render\\(' +
  '\\s*[\'"`]((?:pages\\/)?admin\\/[^\'"`]+)[\'"`]' +
  '([\\s\\S]{0,800}?)\\)\\s*;',
  'g'
);

const bad = [];
let checked = 0;

for (const f of files) {
  const raw  = fs.readFileSync(f, 'utf8');
  const code = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
    .replace(/^[ \t]*\/\/.*$/gm, '');     // line comments

  let m;
  RENDER.lastIndex = 0;
  while ((m = RENDER.exec(code)) !== null) {
    checked++;
    const view = m[1];
    const args = m[2];
    const hasLayout =
      /layout\s*:/.test(args) ||          // literal layout: 'layouts/admin'
      /\.\.\.\s*[A-Za-z_$][\w$]*/.test(args); // ...LAYOUT spread
    if (!hasLayout) {
      bad.push({ file: path.relative(ROOT, f), view });
    }
  }
}

console.log('admin renders inspected: ' + checked);

if (!bad.length) {
  console.log('\nALL ADMIN RENDERS CARRY A LAYOUT');
  process.exit(0);
}

console.log('\n*** ' + bad.length + ' ADMIN RENDER(S) WITH NO LAYOUT ***');
console.log('These render inside layouts/main — the storefront — with no admin nav.\n');
for (const b of bad) console.log('  ' + b.file + '\n      -> ' + b.view);
process.exit(1);
