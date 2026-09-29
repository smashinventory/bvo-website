#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   surveyHeroFill.test.js — does the bounding box actually find the product?

   Run:  node scripts/surveyHeroFill.test.js
   Exit: 0 = all pass, 1 = a failure

   Needs no network and no database: every image is synthesised here with a
   KNOWN rectangle in it, so the expected answer is arithmetic rather than
   opinion.

   WHY THIS EXISTS. The survey's entire output rests on one function. Eight
   hand-checked examples told me it looked right — which is exactly the kind
   of evidence that has been wrong twice already on this project. A fill
   percentage that is quietly 10 points off would send the owner's threshold
   to the wrong place and mis-select thousands of images.
   ───────────────────────────────────────────────────────────────────────── */

const sharp = require('sharp');
const { analyse } = require('./surveyHeroFill');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};
const near = (got, want, tol = 1.2) => Math.abs(got - want) <= tol;

/* A canvas with one solid rectangle on it. */
async function make({ W, H, bg, x, y, w, h, colour = { r: 40, g: 60, b: 50 } }) {
  const rect = await sharp({
    create: { width: w, height: h, channels: 4,
              background: { ...colour, alpha: 1 } },
  }).png().toBuffer();
  return sharp({
    create: { width: W, height: H, channels: 4, background: bg },
  }).composite([{ input: rect, left: x, top: y }]).png().toBuffer();
}

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const OFFWHITE = { r: 250, g: 249, b: 250, alpha: 1 };   // real "white" backdrops
const ROOM  = { r: 120, g: 110, b: 100, alpha: 1 };      // a lifestyle scene

(async () => {
  console.log('--- the box finds the rectangle ---');
  {
    // 400x400 canvas, 200x100 product => 50% wide, 25% tall
    const buf = await make({ W: 400, H: 400, bg: WHITE, x: 100, y: 150, w: 200, h: 100 });
    const m = await analyse(buf);
    ok('fillW is the rectangle width',  near(m.fillW, 50),  `got ${m.fillW}, want 50`);
    ok('fillH is the rectangle height', near(m.fillH, 25),  `got ${m.fillH}, want 25`);
    ok('fillMax takes the larger axis', near(m.fillMax, 50), `got ${m.fillMax}`);
    ok('a white backdrop reads as a cutout', m.bgWhite === 1, `bgWhite=${m.bgWhite}`);
  }

  /* ── the three cases a mutation sweep proved the first draft missed ──
     Written after running the sweep, not before: an off-by-one, a
     one-corner background check, and a transparent backdrop all passed
     the original tests. Each is a real way the survey could be quietly
     wrong across thousands of images. */
  console.log('\n--- cases the first draft of this test missed ---');
  {
    /* A 1px error on a 400px canvas is 0.25% — invisible inside the 1.2pt
       tolerance the other cases use. On a 40px canvas it is 2.5pt. */
    const buf = await make({ W: 40, H: 40, bg: WHITE, x: 10, y: 15, w: 20, h: 10 });
    const m = await analyse(buf);
    ok('the box is inclusive of both edges (off-by-one)',
       near(m.fillW, 50, 0.4) && near(m.fillH, 25, 0.4),
       `got ${m.fillW}/${m.fillH}, want exactly 50/25`);
  }
  {
    /* Product in the BOTTOM-RIGHT corner. Checking only corner (0,0) — as
       a mutation did — would call this a clean cutout and offer it up for
       cropping with its edge already flush. */
    const buf = await make({ W: 400, H: 400, bg: WHITE, x: 200, y: 200, w: 200, h: 200 });
    const m = await analyse(buf);
    ok('a product in the far corner is excluded too', m.bgWhite === 0,
       `bgWhite=${m.bgWhite} — only checking the top-left corner would miss this`);
  }
  {
    /* Transparent backdrop. Cutouts are often delivered this way, and the
       alpha branch is the only thing that recognises them — without it the
       box is the whole canvas and the image scores a false 100%. */
    const buf = await make({ W: 400, H: 400,
                             bg: { r: 0, g: 0, b: 0, alpha: 0 },
                             x: 100, y: 150, w: 200, h: 100 });
    const m = await analyse(buf);
    ok('a transparent backdrop reads as a cutout', m.bgWhite === 1,
       `bgWhite=${m.bgWhite}`);
    ok('and its box is the product, not the canvas',
       near(m.fillW, 50) && near(m.fillH, 25),
       `got ${m.fillW}/${m.fillH}, want 50/25 — 100/100 means alpha was ignored`);
  }

  console.log('\n--- the two real-catalogue cases, reproduced ---');
  {
    // The worst offender measured live: 47.7% tall, 63.3% wide on 2048 sq.
    const buf = await make({ W: 400, H: 400, bg: OFFWHITE,
                             x: 73, y: 105, w: 253, h: 191 });
    const m = await analyse(buf);
    ok('a 48%-fill hero reports ~48% tall', near(m.fillH, 47.7), `got ${m.fillH}`);
    ok('and ~63% wide',                     near(m.fillW, 63.3), `got ${m.fillW}`);
  }
  {
    // A well-framed one: ~79% tall.
    const buf = await make({ W: 400, H: 400, bg: OFFWHITE,
                             x: 40, y: 42, w: 320, h: 316 });
    const m = await analyse(buf);
    ok('a well-framed hero reports ~79%', near(m.fillH, 79), `got ${m.fillH}`);

    /* This was `ok(..., true, '')` in the first draft — an assertion that
       passes whatever the code does, which is worse than no assertion
       because it reads like coverage. Re-measure both and compare. */
    const poor = await analyse(await make({ W: 400, H: 400, bg: OFFWHITE,
                                            x: 73, y: 105, w: 253, h: 191 }));
    const gap = m.fillH - poor.fillH;
    ok('the two differ by ~31 points — the gap the owner can see',
       near(gap, 31.3, 2), `gap is ${gap.toFixed(1)} points`);
  }

  console.log('\n--- lifestyle shots are excluded, not cropped ---');
  {
    const buf = await make({ W: 400, H: 400, bg: ROOM, x: 100, y: 100, w: 200, h: 200 });
    const m = await analyse(buf);
    ok('a room scene is not a cutout', m.bgWhite === 0, `bgWhite=${m.bgWhite}`);
    ok('and it fills the frame, so a naive rule would skip it anyway',
       m.fillMax > 95, `fillMax=${m.fillMax}`);
  }
  {
    // A product touching a corner must NOT be treated as a cutout — the
    // survey should under-select rather than propose a crop on this.
    const buf = await make({ W: 400, H: 400, bg: WHITE, x: 0, y: 0, w: 200, h: 200 });
    const m = await analyse(buf);
    ok('a product touching a corner is excluded', m.bgWhite === 0,
       `bgWhite=${m.bgWhite} — this would be a crop candidate nobody checked`);
  }

  console.log('\n--- shadows stay inside the box ---');
  {
    // Light grey contact shadow (235) is below WHITE_MIN(243), so it counts
    // as product. Cropping it away would shave the vanity's base.
    const buf = await make({ W: 400, H: 400, bg: WHITE, x: 100, y: 100,
                             w: 200, h: 200, colour: { r: 235, g: 235, b: 235 } });
    const m = await analyse(buf);
    ok('a 235-grey shadow is kept', near(m.fillW, 50), `got ${m.fillW}, want 50`);
  }
  {
    // 248 is above the cutoff and is background, not shadow.
    const buf = await make({ W: 400, H: 400, bg: WHITE, x: 100, y: 100,
                             w: 200, h: 200, colour: { r: 248, g: 248, b: 248 } });
    const m = await analyse(buf);
    ok('a 248-grey wash is treated as background', m.err === 'blank image',
       `got ${JSON.stringify(m)}`);
  }

  console.log('\n--- off-centre is reported, and signed the right way ---');
  {
    const buf = await make({ W: 400, H: 400, bg: WHITE, x: 240, y: 20, w: 100, h: 100 });
    const m = await analyse(buf);
    ok('a right-of-centre product reports positive X', m.offCentreX > 10,
       `offCentreX=${m.offCentreX}`);
    ok('a high product reports negative Y', m.offCentreY < -10,
       `offCentreY=${m.offCentreY}`);
  }

  console.log('\n--- scaling does not move the percentage ---');
  {
    const big   = await make({ W: 1600, H: 1600, bg: OFFWHITE, x: 292, y: 420, w: 1012, h: 764 });
    const small = await sharp(big).resize(400).png().toBuffer();
    const a = await analyse(big), b = await analyse(small);
    ok('a 4x downscale agrees within a point',
       near(a.fillH, b.fillH) && near(a.fillW, b.fillW),
       `full ${a.fillW}/${a.fillH} vs 400px ${b.fillW}/${b.fillH}`);
  }

  console.log(fail ? `\n*** ${fail} TEST(S) FAILED ***` : '\nALL TESTS PASS');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
