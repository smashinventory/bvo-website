#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_heading_labels.js

   Covers two unrelated-looking changes that share one root cause: a CSS rule
   that targets headings by TAG, so changing a title's tag silently changes
   how it looks.

     h1,h2,h3,h4,h5,h6 { font-family: var(--font-serif);
                         color: var(--text-primary); line-height: 1.2 }

   1. "Label (not a heading)" renders a section title as <p>. The tag rule
      stops applying, so any title class relying on it — or on the browser's
      default bold — changes appearance the moment the setting is used.

   2. The SAME rule is why the <h1> on /lookbook and /blog was invisible:
      it painted the heading navy, overriding the white the dark hero sets
      on its children, because a rule matching the element beats colour
      inherited from a parent. Navy text on a navy background.

   Run:  node gates/gate_heading_labels.js
   Exit: 0 = pass, 1 = fail
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

const view   = read('views/pages/index.ejs');
const editor = read('views/pages/admin/theme.ejs');
const css    = read('public/css/site.css');
const css3   = read('public/css/site3.css');
const bundle = read('public/css/site-bundle.css');

/* ═══ 1. RENDERER AND EDITOR AGREE ═════════════════════════════════
   These are in different files with nothing connecting them. Offer an option
   the renderer rejects and _safeTag silently falls back to h2 — which looks
   exactly like the setting being ignored, with no error anywhere. */
console.log('--- the renderer and the Theme Editor offer the same thing ---');
{
  const m = view.match(/_ALLOWED_TAGS = new Set\(\[([^\]]*)\]\)/);
  ok('_ALLOWED_TAGS was found', !!m);
  const tags = m ? m[1].replace(/'/g, '"') : '';

  ok("the renderer accepts 'p'", /"p"/.test(tags),
     'the Theme Editor would offer Label and the page would still render h2');
  ok('the Theme Editor offers the Label option',
     /value="p"'\+\(v==='p'\?' selected':''\)\+'>Label \(not a heading\)/.test(editor),
     'the renderer would accept p with no way to choose it');

  /* The whitelist exists to stop settings injecting arbitrary HTML through
     the raw EJS output tags that emit these elements. Adding 'p' keeps it a
     whitelist; widening it to anything else does not. */
  for (const bad of ['div', 'span', 'script', 'style', 'a']) {
    ok(`the whitelist still rejects ${bad}`, !new RegExp('"' + bad + '"').test(tags),
       'this is an HTML-injection guard, not a convenience list');
  }

  ok('_safeTag still falls back when the value is unknown',
     /_ALLOWED_TAGS\.has\(val\) \? val : \(def \|\| 'h2'\)/.test(view));
}

/* ═══ 2. A LABEL STILL LOOKS LIKE THE TITLE IT REPLACED ════════════
   Both of these are no-ops while the tag is a heading, which is exactly why
   they are easy to drop. They only matter the first time someone picks
   Label, and by then nobody connects the two. */
console.log('\n--- switching to Label must not change how the title looks ---');
{
  for (const [label, sheet] of [['site.css', css], ['site-bundle.css (shipped)', bundle]]) {
    ok(`${label}: .section-title sets its own font-weight`,
       /\.section-title\{[^}]*font-weight:700/.test(sheet),
       'as a <p> it would drop to normal weight — headings are bold only by ' +
       'browser default');
    ok(`${label}: .hero-h1 sets its own font-weight`,
       /\.hero-h1\{[^}]*font-weight:700/.test(sheet));
    ok(`${label}: .section-title sets its own font-family`,
       /\.section-title\{[^}]*font-family/.test(sheet),
       'the serif comes from the h1-h6 rule, which stops applying');
    ok(`${label}: .section-title sets its own colour`,
       /\.section-title\{[^}]*color:/.test(sheet));
  }
}

/* ═══ 3. THE INVISIBLE HERO TITLES ═════════════════════════════════
   /lookbook and /blog both put a heading inside a navy hero. The hero sets
   color:#fff on itself, but the h1-h6 rule sets navy ON the heading, and a
   direct match always beats inheritance. The title rendered navy on navy.

   Not an SEO problem — the text was always in the HTML — but on two pages
   the title simply was not there to look at. */
console.log('\n--- dark-hero titles are not the same colour as their background ---');
{
  for (const sel of ['.lb-hero-title', '.blog-hero-title']) {
    const m = css3.match(new RegExp('\\' + sel + '\\{[^}]*\\}'));
    ok(`${sel} exists in site3.css`, !!m);
    ok(`${sel} sets its own colour`, !!m && /color:\s*#fff/.test(m[0]),
       'inherits nothing useful — the global h1-h6 rule paints it navy, and ' +
       'the hero behind it is navy');
  }

  /* The two that were already correct. Asserted so a future "tidy up these
     duplicate colour declarations" pass fails here instead of blanking four
     page titles. */
  for (const sel of ['.inspo-hub-title', '.inspo-hero-title']) {
    const m = css3.match(new RegExp('\\' + sel + '\\{[^}]*\\}'));
    ok(`${sel} still sets its own colour`, !!m && /color:\s*#fff/.test(m[0]));
  }
}

/* ═══ 4. ONE VERSION OF THE PER-PAGE STYLESHEET ════════════════════
   site3.css is linked by each page that needs it rather than from the
   layout, so the cache-buster is repeated in sixteen templates. It had
   drifted into ?v=18 on eleven and ?v=28 on five — the same file requested
   as two different URLs, so a change could land on half the site. */
console.log('\n--- every page requests the same site3.css ---');
{
  const dir = path.join(ROOT, 'views');
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      /* .bak-* snapshots are history, not rendered. Excluded deliberately —
         including them would make this gate unfixable without deleting
         files nobody asked to delete. */
      else if (e.name.endsWith('.ejs')) files.push(p);
    }
  })(dir);

  const versions = new Set();
  for (const f of files) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/site3\.css\?v=(\d+)/g)) {
      versions.add(m[1]);
    }
  }
  ok(`all live templates agree on one version (found ${[...versions].join(', ') || 'none'})`,
     versions.size === 1,
     'the same stylesheet requested under two URLs — a change reaches only ' +
     'the pages whose version moved');
  ok('that version is at least 29', [...versions].every(v => Number(v) >= 29),
     'site3.css changed; without a bump the CDN keeps the old copy and the ' +
     'invisible titles stay invisible');
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
