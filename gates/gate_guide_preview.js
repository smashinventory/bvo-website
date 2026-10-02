#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_guide_preview.js — the Style Guides preview box on the homepage.

   Four things this has to hold, and three of them fail silently:

   1. ONE SOURCE FOR THE TEXT. The copy lives in themeSettings DEFAULTS and
      index.ejs renders it with no fallback of its own. If someone adds
      `|| 'Farmhouse bathrooms have...'` to the template as a "safety net",
      there are instantly two copies, the owner edits one in the Theme
      Editor, and the page keeps showing the other. Rule 10.

   2. THE SUBHEAD IS NOT A HEADING. It is an <h2> in the source guide. Carry
      the tag across and the homepage silently gains a heading back,
      immediately after eight were removed on purpose.

   3. SCROLL, NOT COLLAPSE. The box must clip with overflow. Swap it for a
      display:none "read more" and the 228 words stop counting for the very
      thing they were added for — and the page looks identical either way.

   4. OPTION A, NOT OPTION B. Style Guides was registered in the Theme
      Editor as a FIXED row so it gains a settings panel without becoming
      reorderable/hideable/duplicatable. Sam chose that explicitly over
      making it a full template section. Adding the key to _STATIC_KEYS or
      TEMPLATE_KEYS later would quietly grant those powers.

   Run:  node gates/gate_guide_preview.js
   Exit: 0 = pass, 1 = fail
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const stripEjsComments = (s) => s.replace(/<%\/\*[\s\S]*?\*\/%>/g, '');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

const tsSrc  = read('src/services/themeSettings.js');
const view   = stripEjsComments(read('views/pages/index.ejs'));
const editor = read('views/pages/admin/theme.ejs');
const css2   = read('public/css/site2.css');
const bundle = read('public/css/site-bundle.css');

/* Pull the inspiration DEFAULTS block out of source. The module cannot be
   required here — it loads config that refuses to start without database
   credentials, which a gate does not have. */
const block = (() => {
  const s = tsSrc.indexOf('  inspiration: {');
  if (s < 0) return '';
  const e = tsSrc.indexOf('  testimonials: {', s);
  return e < 0 ? tsSrc.slice(s) : tsSrc.slice(s, e);
})();
const field = (k) => {
  const m = block.match(new RegExp(k + ":\\s*'((?:[^'\\\\]|\\\\.)*)'"));
  return m ? m[1].replace(/\\'/g, "'") : null;
};
const words = (s) => (s ? s.trim().split(/\s+/).length : 0);

/* ═══ 1. THE DEFAULTS EXIST AND ARE THE AGREED TEXT ════════════════ */
console.log('--- the copy lives in themeSettings DEFAULTS ---');
{
  ok('the inspiration block exists', block.length > 400);
  ok('preview_enabled defaults to true', /preview_enabled:\s*true/.test(block));
  ok('preview_lines defaults to 6',      /preview_lines:\s*6\b/.test(block));

  const b1 = field('preview_body1'), sh = field('preview_subhead'), b2 = field('preview_body2');
  ok('the opening paragraph is present', words(b1) > 70);
  ok('the subheading is present',        !!sh && words(sh) < 12);
  ok('the second paragraph is present',  words(b2) > 110);

  const total = words(b1) + words(sh) + words(b2);
  ok(`the excerpt is 228 words (found ${total})`, total === 228,
     'the agreed cut was the opening paragraph, the subheading, and the ' +
     'paragraph after it — nothing more');

  /* Sam picked this cut point by name. If the text is ever re-pasted from
     the guide, this is what catches an over-long paste. */
  ok('it ends at the agreed sentence',
     !!b2 && /reinforce the farmhouse character in different ways\.$/.test(b2),
     'should end "...reinforce the farmhouse character in different ways."');

  ok('the link points at the farmhouse guide',
     field('preview_cta_url') === '/inspiration/farmhouse-bathroom-vanity-ideas');
}

/* ═══ 2. THE TEMPLATE HOLDS NO SECOND COPY ═════════════════════════ */
console.log('\n--- index.ejs renders from settings and carries no copy of its own ---');
{
  ok('index.ejs reads the settings block', /settings\.inspiration/.test(view));

  const b1 = field('preview_body1') || '@@none@@';
  ok('the body text is NOT duplicated into the template',
     !view.includes(b1.slice(0, 60)),
     'two copies of the text means the Theme Editor edits one and the page ' +
     'renders the other');
  /* Scoped to the VISIBLE heading only. The first version of this assertion
     banned `preview_heading || '...'` anywhere, and tripped on
     aria-label="<%= _ip.preview_heading || 'Guide preview' %>" — which is
     correct code: an aria-label must never render empty, and a fallback
     accessible name is not a second copy of the page's text. Banning it
     would have pushed the fix toward deleting the aria-label. */
  ok('the displayed heading has no hardcoded fallback',
     !/<p class="hp-gp-heading"><%=[^%]*\|\|/.test(view),
     'display copy must come from settings alone; an aria-label fallback is fine');
  ok('the body is NOT hardcoded as a fallback',
     !/preview_body1\s*\|\|\s*'/.test(view));

  ok('the box is skipped entirely when there is no body',
     /_ip\.preview_body1/.test(view) && /_ip\.preview_enabled !== false/.test(view),
     'it should disappear rather than render half of itself');
}

/* ═══ 3. STRUCTURE — NO NEW HEADING, AND IT SCROLLS ════════════════ */
console.log('\n--- structure ---');
{
  ok('the subhead renders as a <p>, not a heading',
     /<p class="hp-gp-subhead">/.test(view));
  ok('no h1-h6 anywhere in the preview block',
     !/<h[1-6][^>]*class="hp-gp/.test(view) && !/hp-gp[^"]*"[^>]*>\s*<h[1-6]/.test(view),
     'the whole point of rendering the subhead as a <p> is not adding one back');

  ok('the eyebrow and heading are also <p>',
     /<p class="hp-gp-eyebrow">/.test(view) && /<p class="hp-gp-heading">/.test(view));

  /* [\s\S] rather than [^>]: the style attribute between the class and the
     tabindex contains an EJS tag, and every EJS tag contains a ">" (in "%>").
     Third time this exact trap has bitten a gate in this repo. */
  ok('the scroller is focusable by keyboard',
     /class="hp-gp-scroll"[\s\S]{0,220}?tabindex="0"/.test(view),
     'an overflow container that cannot take focus cannot be scrolled ' +
     'without a mouse');

  ok('the line count is clamped before it reaches CSS',
     /Math\.max\(3,\s*Math\.min\(40,/.test(view),
     'a blank or silly Theme Editor value would render a one-line box');
}

/* ═══ 4. THE CSS, IN BOTH FILES ════════════════════════════════════ */
console.log('\n--- the styles, including the file that actually ships ---');
{
  for (const [label, sheet] of [['site2.css (source)', css2], ['site-bundle.css (shipped)', bundle]]) {
    ok(`${label}: .hp-guide-preview exists`, /\.hp-guide-preview\s*\{/.test(sheet));
    ok(`${label}: the box clips with overflow`,
       /\.hp-gp-scroll\s*\{[^}]*overflow-y:\s*auto/.test(sheet),
       'without this the full 228 words render and there is no box at all');
    ok(`${label}: the height comes from --hp-gp-lines`,
       /max-height:\s*calc\(var\(--hp-gp-lines/.test(sheet),
       'the Theme Editor line count would stop doing anything');
  }

  /* The one substitution that would look fine and destroy the purpose. */
  ok('the preview is never hidden with display:none',
     !/\.hp-gp-scroll\s*\{[^}]*display:\s*none/.test(bundle),
     'hidden text is discounted by Google — the word count was the reason ' +
     'this box exists');

  const bytes = Buffer.byteLength(css2, 'utf8');
  ok(`Rule 11: site2.css is ${(bytes / 1024).toFixed(1)} KB`, bytes < 80 * 1024);
}

/* ═══ 5. THEME EDITOR — OPTION A, NOT OPTION B ═════════════════════ */
console.log('\n--- the editor panel, and the limits Sam chose ---');
{
  ok('Style Guides is registered in the Content group',
     /CONTENT_SECS\s*=\s*\[[\s\S]{0,200}key:'inspiration'/.test(editor));
  ok('the Content group is rendered in the sidebar',
     /CONTENT_SECS\.forEach/.test(editor));
  ok('the row is fixed, not draggable',
     /CONTENT_SECS\.forEach[\s\S]{0,300}te4-sec-row te4-sec-fixed/.test(editor));
  ok('the panel exists', /id="panel-inspiration"/.test(editor));

  for (const f of ['preview_enabled','preview_eyebrow','preview_heading','preview_body1',
                   'preview_subhead','preview_body2','preview_lines',
                   'preview_cta_text','preview_cta_url']) {
    ok(`the panel can edit ${f}`, editor.includes(`inspiration.${f}`));
  }

  /* THE OPTION A GUARANTEE. Adding the key to either list turns an existing,
     working section into one that can be dragged, hidden or duplicated —
     which is Option B, and was declined. */
  ok('inspiration is NOT in _STATIC_KEYS',
     !/_STATIC_KEYS\s*=\s*\[[^\]]*'inspiration'/.test(editor),
     'that would make Style Guides reorderable and hideable — Option B, declined');
  ok('inspiration is NOT in TEMPLATE_KEYS',
     !/TEMPLATE_KEYS\s*=\s*\[[^\]]*'inspiration'/.test(editor));
  ok('inspiration is NOT duplicatable',
     !/_DUPL_BASES\s*=\s*new Set\(\[[^\]]*'inspiration'/.test(editor));
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
