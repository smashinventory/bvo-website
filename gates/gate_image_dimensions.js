#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_image_dimensions.js
 *
 * THE RULE: every render site of the .iwt-img class reserves a box, so the
 * page cannot jump while the picture loads.
 *
 * WHY THIS EXISTS, AND WHY IT COUNTS SITES RATHER THAN CHECKING ONE.
 * Task #121 — "add width/height to iwt-img in index.ejs" — was done and
 * marked complete. It fixed ONE of the two places that render that class.
 * The samples banner was built later, reused .iwt-img, and shipped with no
 * dimensions. A Lighthouse run on 2026-11-23 duly reported "image elements
 * do not have explicit width and height" against a task already closed.
 *
 * One class, two render sites, one of them fixed, and nothing in the repo
 * could tell the difference. That is the shape of bug this gate exists for:
 * it does not ask "is the image I know about fixed?", it asks "is EVERY
 * site fixed?" — so the next section to reuse the class fails here rather
 * than in a performance report weeks later.
 *
 * ⚠️ AN ABSENT width/height IS SOMETIMES CORRECT. The dimensions are
 * derived from a settings-driven aspect ratio, and reserving a box of the
 * WRONG shape is worse than reserving none — it causes the layout shift it
 * was meant to prevent. So a site may omit them, but only behind a
 * conditional on a computed box. An unconditional bare <img> fails.
 *
 * Run:  node gates/gate_image_dimensions.js
 * Exit: 0 = pass, 1 = fail
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '\n         ' + d));
  if (c) pass++; else fail++;
};

console.log('\ngate_image_dimensions — every .iwt-img render site reserves a box\n');

const VIEW = 'views/pages/index.ejs';
/* Strip EJS and JS block comments: a comment mentioning the class is not a
   render site, and this repo has had six gates fooled by exactly that. */
const src = read(VIEW)
  .replace(/<%\/\*[\s\S]*?\*\/%>/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/* ⚠️ DO NOT MATCH THESE WITH /<img[^>]*>/ — THIS IS EJS, NOT HTML.
   An EJS output tag ends in "%>", so [^>]* stops dead at the > inside
   it. The first version of this gate did exactly that: it truncated one
   <img> at `src="<%= sb_.image %>` and never saw the other at all,
   reporting "found 1" for a class rendered twice. The gate was wrong,
   not the template.

   So scan for the tag's REAL end: the first > that is not the > of a %>. */
function imgTags(s) {
  const out = [];
  let i = 0;
  while ((i = s.indexOf('<img', i)) !== -1) {
    let j = i;
    while (j < s.length) {
      j = s.indexOf('>', j + 1);
      if (j === -1) break;
      if (s[j - 1] !== '%') break;      // a real tag end, not "%>"
    }
    if (j === -1) break;
    out.push(s.slice(i, j + 1));
    i = j + 1;
  }
  return out;
}
const tags = imgTags(src).filter(t => /class="iwt-img"/.test(t));

console.log('--- the render sites are found at all ---');
ok(`at least two .iwt-img render sites exist (found ${tags.length})`,
   tags.length >= 2,
   'the class is rendered in fewer places than expected — either a site was ' +
   'removed, or the markup changed shape and this gate is now looking at ' +
   'nothing. A gate that matches zero things passes silently; check before ' +
   'relaxing this.');

console.log('\n--- each site reserves a box, or is conditional on a computed one ---');
tags.forEach((tag, i) => {
  const hasDims = /\bwidth=/.test(tag) && /\bheight=/.test(tag);
  /* The conditional form: width/height inside an EJS if on a *Box variable.
     Absent dimensions are only acceptable when a computed box decides. */
  const conditional = /<%\s*if\s*\([^)]*Box\)/.test(tag) ||
                      /width="<%=\s*_\w*Box\./.test(tag);
  ok(`site ${i + 1} reserves a box`,
     hasDims,
     'this <img class="iwt-img"> emits no width/height. Derive them from ' +
     '_heroBox(url, aspect) like its siblings, and emit nothing only when ' +
     'that returns null.\n         ' + tag.replace(/\s+/g, ' ').slice(0, 160));
  if (hasDims && !conditional) {
    /* Not a failure — a literal pair is fine if the shape is truly fixed —
       but worth printing, because a hardcoded ratio cannot follow a
       re-uploaded image. */
    console.log('         note: site ' + (i + 1) + ' uses literal dimensions, ' +
                'not a computed box — it will not follow a reshaped upload');
  }
});

console.log('\n--- the aspect setting exists for every settings-driven site ---');
{
  const ts = read('src/services/themeSettings.js');
  /* sample_banner was the section that had an image but no aspect field,
     which is why its render site could not compute a box. */
  const block = ts.slice(ts.indexOf('sample_banner: {'));
  const end   = block.indexOf('\n  },');
  ok('sample_banner declares image_aspect',
     /image_aspect\s*:/.test(block.slice(0, end > 0 ? end : 4000)),
     'without it _heroBox returns null and the banner reserves nothing');

  ok('the Theme Editor exposes it',
     /sample_banner\.image_aspect/.test(read('views/pages/admin/theme.ejs')),
     'a setting with no control is one nobody can correct when the image ' +
     'is replaced with a different shape');
}

console.log(fail ? `\n*** ${fail} of ${pass + fail} CHECKS FAILED ***`
                 : `\nALL ${pass} CHECKS PASS`);
process.exit(fail ? 1 : 0);
