#!/usr/bin/env node
/**
 * gate_lookbook_payload.js
 *
 * /lookbook shipped 7,020 KB of HTML. 6,875 KB of that — 98% — was image
 * URLs crammed into data-images attributes: 55,429 of them across 41 cards,
 * median 603 per card, 6,699 on the largest.
 *
 * The carousel shows one frame at a time. Nobody pages through 6,699. Every
 * visitor downloaded all of them.
 *
 * Sam found it from the "2/603" and "12/936" counters on the cards. The
 * counter was the only visible symptom — the page looked fine.
 *
 * WHY A GATE AND NOT JUST THE FIX
 * The failure mode is invisible. Remove the cap and the page still renders
 * correctly, still links correctly, still passes every other gate. It is
 * seven megabytes heavier and nothing says so. That is exactly the class of
 * regression that needs an assertion rather than an eye.
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const vm   = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0;
const ok    = m => console.log('  PASS  ' + m);
const bad   = m => { console.log('  FAIL  ' + m); fails++; };
const check = (c, m) => c ? ok(m) : bad(m);

const ctrl = read('src/controllers/lookbookController.js');

console.log('\n=== gate_lookbook_payload ===\n');

/* ───────────── 1. the cap exists and is sane ───────────── */
console.log('-- the cap --');
const capMatch = ctrl.match(/const LOOKBOOK_CARD_IMAGE_CAP\s*=\s*(\d+)/);
check(!!capMatch, 'LOOKBOOK_CARD_IMAGE_CAP is declared');
const cap = capMatch ? Number(capMatch[1]) : null;
check(cap !== null && cap > 0, `the cap is a positive number (${cap})`);
/* An upper bound as well as a lower one. A cap of 500 is a cap in name only
   and would put the page straight back into megabytes. */
check(cap !== null && cap <= 30,
      `the cap is small enough to matter (${cap} <= 30; at 12 the page is ~202 KB, uncapped it was 7,020 KB)`);

check(/picked\.length >= LOOKBOOK_CARD_IMAGE_CAP/.test(ctrl),
      'the fill loop actually stops at the cap');
check(/slice\(0, LOOKBOOK_CARD_IMAGE_CAP\)/.test(ctrl),
      'the per-colour picks are also capped, so many colours cannot overflow it');

/* ───────────── 2. one per colour, then fill ───────────── */
console.log('\n-- selection: one per colour, then fill --');
/* ANCHORED TO THE IMAGE QUERY, not a bare substring.
   The first version of this check was /p\.color_family/ against the whole
   file, which passed with the column deleted from the image query because
   p.color_family also appears in the colour FILTER condition and in the main
   product SELECT. The mutation sweep caught it.

   Same shape as the aria-expanded hole found earlier the same day: a bare
   substring that occurs elsewhere asserts nothing about the place that
   matters. */
{
  const imgQuery = (ctrl.match(/SELECT pi\.product_id[\s\S]{0,400}?`/) || [''])[0];
  check(imgQuery.length > 50, 'the image query was located');
  check(/p\.color_family/.test(imgQuery),
        'the IMAGE query selects color_family (without it there is nothing to group by)');
}
check(/modelByColor/.test(ctrl) && /modelRest/.test(ctrl),
      'images are split into per-colour picks and a fill pile');
/* The null guard. Without it every uncoloured variant collapses into one
   bucket keyed undefined, reserving a single slot for all of them and
   pushing real colours out of the carousel. */
check(/const cf = row\.color_family \|\| null;/.test(ctrl),
      'a null/empty colour_family is normalised rather than used as a key');
check(/if \(cf && !modelByColor\[k\]\.has\(cf\)\)/.test(ctrl),
      '...and only a real colour reserves a slot');

/* ───────────── 3. the logic, executed ───────────── */
console.log('\n-- selection logic (real code, lifted and run) --');
{
  const s = ctrl.indexOf('const LOOKBOOK_CARD_IMAGE_CAP = 12;');
  const tail = 'modelImages[k] = picked;\n        }';
  const e = ctrl.indexOf(tail, s) + tail.length;
  check(s > 0 && e > s, 'the accumulation block was found');

  if (s > 0) {
    const block = ctrl.slice(s, e);
    const run = rows => {
      const c = { imgRows: rows, modelKey: r => `${r.model}||${r.brand}`, Object, Map, Set, console };
      vm.createContext(c);
      vm.runInContext(block, c);
      return vm.runInContext('modelImages', c);
    };
    const mk = (n, colour, tag) => Array.from({ length: n }, (_, i) =>
      ({ model: 'M', brand: 'B', color_family: colour, url: `${tag}#${i}` }));
    const colourOf = u => u.split('#')[0];

    let r = run(mk(500, 'white', 'white'));
    check(r['M||B'].length === cap, `500 images of one colour collapse to the cap (${r['M||B'].length})`);

    const nine = ['white','gray','black','blue','green','cream','woodL','woodM','woodD'];
    r = run(nine.flatMap(c => mk(40, c, c)));
    check(new Set(r['M||B'].slice(0, 9).map(colourOf)).size === 9,
          'with 9 colours, the first 9 frames are one per colour');
    check(r['M||B'].length === cap, '...and the rest is filled to the cap');

    const many = Array.from({ length: 20 }, (_, i) => 'col' + String.fromCharCode(65 + i));
    r = run(many.flatMap(c => mk(5, c, c)));
    check(new Set(r['M||B'].map(colourOf)).size === cap,
          `with 20 colours, all ${cap} frames are distinct colours — no near-duplicates`);

    r = run([...mk(30, null, 'nocol'), ...mk(1, 'white', 'white')]);
    check(r['M||B'].length === cap && colourOf(r['M||B'][0]) === 'white',
          'uncoloured variants fill rather than crowd out a real colour');

    r = run([{ model:'M', brand:'B', color_family:'white', url:'same' },
             { model:'M', brand:'B', color_family:'gray',  url:'same' },
             { model:'M', brand:'B', color_family:'black', url:'other' }]);
    check(r['M||B'].length === 2, 'a URL shared by two colours is kept once');

    r = run(mk(4, 'white', 'white'));
    check(r['M||B'].length === 4, 'a model with fewer images than the cap keeps all of them');

    r = run([...mk(30,'white','a').map(x => ({ ...x, model:'A' })),
             ...mk(30,'white','b').map(x => ({ ...x, model:'B' }))]);
    check(r['A||B'].length === cap && r['B||B'].length === cap, 'models do not merge');

    /* The headline number, asserted rather than asserted-about: 41 cards at
       the cap must stay under a few hundred entries, where uncapped it was
       55,429. */
    const worst = cap * 41;
    check(worst <= 1000,
          `41 cards at the cap is ${worst} image entries (was 55,429)`);
  }
}

console.log(`\n${fails ? 'FAILED: ' + fails + ' assertion(s)' : 'All assertions passed.'}\n`);
process.exit(fails ? 1 : 0);
