#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_card_framing.js — the card framing may not cost anything

   Run:  node gates/gate_card_framing.js
   Exit: 0 = pass, 1 = fail

   The whole reason this feature is CSS and not regenerated image files is
   that three days of image-performance work sits behind a handful of very
   specific things: one image hostname, thirteen srcset guards written as
   indexOf('images.bathroomvanitiesoutlet.com'), and a 320-800 ladder whose
   byte sizes were measured rather than guessed.

   Every one of those is easy to break from a distance and invisible when
   broken - the page still renders, it is just slower. So they are asserted
   here rather than trusted.
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

const framer = require('../src/utils/cardFraming');
const store  = require('../src/services/cardFramingStore');

const CARDS = ['views/pages/collection.ejs', 'views/pages/index.ejs'];

/* ═══ 1. THE PERFORMANCE WORK IS UNTOUCHED ═══════════════════════════ */
console.log('--- the image performance work is untouched ---');
for (const f of CARDS) {
  const src = read(f);
  ok(`${path.basename(f)}: srcset ladder still 320-800`,
     /\[320,400,480,640,800\]/.test(src),
     'the ladder was measured (800w = 46.4KB); a changed ladder is a changed page weight');
  ok(`${path.basename(f)}: sizes string unchanged`,
     /\(max-width: 600px\) 88vw, \(max-width: 1024px\) 46vw, 23vw/.test(src),
     'sizes was measured from real layouts, not guessed');
  ok(`${path.basename(f)}: srcset still guarded on the Bunny host`,
     /indexOf\('images\.bathroomvanitiesoutlet\.com'\)/.test(src),
     'this guard is why the ladder only goes to a host that can resize');
  ok(`${path.basename(f)}: card hero still loads from the existing host`,
     !/cards-bvo|b-cdn\.net|BUNNY_CARDS|CARD_IMAGE_CDN/.test(src),
     'a SECOND image hostname costs a DNS lookup and a TLS handshake per page');
  /* SCOPED TO THE PRODUCT-CARD <img>, NOT THE WHOLE FILE. The first
     version of this asserted on the file and failed: index.ejs discusses
     ?crop= in four comments and the HERO image genuinely uses it. The
     rule is about the card image, so it must look at the card image. */
  /* A FIXED WINDOW, NOT A LAZY MATCH TO THE NEXT '>'. The first version
     used [\s\S]{0,400}?> and a mutation sneaked a crop param past it:
     the src is `src="<%= product.primary_image %>?width=800"`, and the
     `%>` of the EJS tag IS a '>', so the lazy match ended before the
     query string it was supposed to be checking. Slicing a fixed window
     cannot be terminated early by the content it is inspecting. */
  const at = src.indexOf('<img class="product-img-pri');
  const cardImg = at === -1 ? '' : src.slice(at, at + 600);
  ok(`${path.basename(f)}: the card <img> was found`,
     cardImg.length > 0 && /src=/.test(cardImg) && /width=800/.test(cardImg),
     'the assertions below would pass vacuously on an empty or truncated slice');
  ok(`${path.basename(f)}: card <img> requests no cropped variant`,
     cardImg.length > 0 && !/[?&](crop|trim|autocrop)=/.test(cardImg),
     'crop was measured and REJECTED: it made the spread worse, 84px -> 155px');
  /* And that the src is still the product's own master. Swapping the src
     for anything else passed every check above — the srcset kept the
     width=800 the slice was looking for, so the file appeared unchanged
     while the card loaded a different picture entirely. */
  ok(`${path.basename(f)}: card <img> src is still the product master`,
     /src="<%=\s*product\.primary_image\s*%>\?width=800"/.test(cardImg),
     'the framing must reposition the existing image, never substitute one');
  ok(`${path.basename(f)}: still lazy`,
     /loading="lazy"/.test(src), 'lazy loading was part of the CWV work');
}

/* ═══ 2. FRAMING IS APPLIED, AND ONLY WHERE IT BELONGS ═══════════════ */
console.log('\n--- applied to cards, and nowhere else ---');
for (const f of CARDS) {
  const src = read(f);
  ok(`${path.basename(f)}: asks for a frame`,
     /cardFrameStyle\(product\.primary_image\)/.test(src), 'no framing on this surface');
  ok(`${path.basename(f)}: emits it only when non-empty`,
     /if \(_frame\) \{ %>style="/.test(src),
     'an empty style attribute is markup nobody needs');
  ok(`${path.basename(f)}: guarded against a missing helper`,
     /typeof cardFrameStyle === 'function'/.test(src),
     'an undefined local throws at render on every card page');
}
for (const f of ['views/pages/product.ejs', 'views/pages/bundle-builder.ejs']) {
  let src = ''; try { src = read(f); } catch { continue; }
  ok(`${path.basename(f)}: NOT framed`,
     !/cardFrameStyle/.test(src),
     'the owner asked for cards only - product pages keep the full image for zoom');
}
ok('server.js exposes the helper to templates',
   /res\.locals\.cardFrameStyle\s*=/.test(read('src/server.js')),
   'an EJS template cannot require()');

/* ═══ 3. THE MATHS ═══════════════════════════════════════════════════ */
console.log('\n--- the geometry ---');
{
  /* The three cards from the owner's screenshot, measured 2026-09-29, with
     the widths approved in the mockup. Anchored so a "harmless" tweak to a
     constant cannot quietly change what everyone agreed to look at. */
  const cases = [
    ['650-V48-M-SC',     { src_w:400, src_h:400, fill_w:82,   fill_h:68.8, off_x:0.1,  off_y:2.7  }, 225],
    ['650-V48-SGR-3EJP', { src_w:400, src_h:600, fill_w:83.5, fill_h:47.8, off_x:-0.1, off_y:0    }, 220],
    ['650-V48-SGR-FEJP', { src_w:400, src_h:599, fill_w:57,   fill_h:32.4, off_x:0.4,  off_y:23.7 }, 222],
  ];
  const heights = [];
  for (const [sku, m, wantW] of cases) {
    const r = framer.frame(m);
    ok(`${sku} reframes`, !!r, 'this one is why the owner raised it');
    if (!r) continue;
    ok(`${sku} renders ~${wantW}px wide`, Math.abs(r.productW - wantW) <= 6,
       `got ${r.productW}px, mockup showed ${wantW}px`);
    /* Solve the rendered product height back out of the returned geometry. */
    const s = r.height / m.src_h;
    heights.push((m.fill_h / 100) * m.src_h * s);
  }
  ok('all three land at the same height',
     Math.max(...heights) - Math.min(...heights) < 2,
     `heights ${heights.map(h => h.toFixed(0)).join(', ')} — uniformity is the point`);

  /* Centring: the product's middle must end on the box's middle. */
  const m = { src_w:400, src_h:599, fill_w:57, fill_h:32.4, off_x:0.4, off_y:23.7 };
  const r = framer.frame(m);
  const s = r.height / m.src_h;
  const cy = m.src_h / 2 + (m.off_y / 100) * m.src_h;
  ok('the product centre lands on the box centre',
     Math.abs(r.top + cy * s - framer.BOX_H / 2) < 0.6,
     `off by ${(r.top + cy * s - framer.BOX_H / 2).toFixed(1)}px — this is the stagger`);

  ok('nothing is drawn wider than the narrowest card',
     framer.MAX_W_SHARE * framer.MIN_BOX_W <= framer.MIN_BOX_W,
     'a product wider than its box is clipped at the sides');
  ok('the target still matches the approved mockup',
     Math.abs(framer.TARGET_H * framer.BOX_H - 189) < 1,
     `${framer.TARGET_H} x ${framer.BOX_H} = ${framer.TARGET_H * framer.BOX_H}px; ` +
     `the owner approved 189px`);
}

/* ═══ 4. EVERY FAILURE RENDERS TODAY'S CARD ══════════════════════════ */
console.log('\n--- every failure falls back to today ---');
{
  const bad = [
    ['null',            null],
    ['undefined',       undefined],
    ['empty object',    {}],
    ['zero dimensions', { src_w:0,   src_h:0,   fill_w:50, fill_h:50 }],
    ['zero fill',       { src_w:400, src_h:400, fill_w:0,  fill_h:0  }],
    ['negative fill',   { src_w:400, src_h:400, fill_w:-5, fill_h:-5 }],
    ['strings',         { src_w:'x', src_h:'y', fill_w:'a', fill_h:'b' }],
    ['missing offsets', { src_w:400, src_h:400, fill_w:50, fill_h:50 }],
  ];
  let bad_ok = true;
  for (const [name, m] of bad) {
    let s; try { s = framer.frameStyle(m); } catch (e) { s = 'THREW: ' + e.message; }
    if (typeof s !== 'string' || /THREW/.test(s)) {
      ok(`${name} -> '' (today's markup)`, false, String(s)); bad_ok = false;
    }
  }
  if (bad_ok) ok('all 8 malformed inputs return a string, none throw', true);
  ok('a missing-offset row still frames (offsets default to centred)',
     typeof framer.frameStyle({ src_w:400, src_h:600, fill_w:57, fill_h:32 }) === 'string');

  ok('an already-well-framed image is left alone',
     framer.frame({ src_w:400, src_h:300, fill_w:92, fill_h:90, off_x:0, off_y:0 }) === null,
     'transforming a card that gains nothing is risk without benefit');

  store._setCache(new Map());
  ok('an empty store returns no style',
     framer.frameStyle(store.get('https://x/y.webp')) === '',
     'before the migration runs, every card must render exactly as today');
  ok('the store matches a URL that carries ?width=',
     store.normaliseUrl('https://x/y.webp?width=800') === 'https://x/y.webp',
     'the templates append ?width= themselves; the measurement is of the image');
}

/* ═══ 5. THE STYLE ITSELF ════════════════════════════════════════════ */
console.log('\n--- the emitted style ---');
{
  const s = framer.frameStyle({ src_w:400, src_h:599, fill_w:57, fill_h:32.4,
                                off_x:0.4, off_y:23.7 });
  ok('positions absolutely', /position:absolute/.test(s));
  ok('lifts the max-width cap', /max-width:none/.test(s),
     'the base rule is width:100%; without this the px width is ignored');
  ok('horizontal position is viewport-independent', /left:calc\(50% - [\d.]+px\)/.test(s),
     'the card box is a FIXED 210px tall but a FLUID width — a px left would ' +
     'be wrong on every breakpoint but one');
  ok('vertical position is a fixed px', /top:-?[\d.]+px/.test(s),
     'box height is fixed, so this one is safe as px');
  ok('carries no url, host or query', !/https?:|\?|b-cdn|bunny/i.test(s),
     'this feature must not be able to change what is downloaded');
  ok('stays under 110 bytes', s.length < 110, `${s.length} bytes x ~24 cards`);
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
