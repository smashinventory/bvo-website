#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   surveyHeroFill.js — how much of each hero image is actually product?

   Run:   node scripts/surveyHeroFill.js
          node scripts/surveyHeroFill.js --limit 200      (quick sample)
          node scripts/surveyHeroFill.js --concurrency 16
   Out:   scripts/out/hero-fill-survey.csv  + a histogram on stdout
   Exit:  0 = surveyed, 2 = could not connect / no decoder

   READ ONLY. This writes one CSV to disk. It does not touch the database,
   the CDN, or any image. Nothing it does is visible to a shopper.

   ─────────────────────────────────────────────────────────────────────────
   WHY

   Owner, 2026-09-29, looking at a filtered collection page: "The two on the
   bottom are significantly different than the other 4 out of six... It seems
   the James Martin team did not standardize the image crop/size."

   Correct, and measured. Eight heroes sampled by hand on
   /collections/bathroom-vanities?size_in=48&color_family=green:

       330-V48-M-SC     2048x2048    product fills 47.7% of the height
       330-V48-SC-3WZ   2048x2048                  47.7%
       503-V48-M-SC     3000x3000                  60.0%
       650-V48-SC-1WZ   3000x3000                  67.1%
       650-V48-SC-3WZ   3500x3500                  68.6%
       650-V48-M-SC     2048x2048                  68.7%
       330-V48-SC-1WZ   3000x3000                  70.0%
       650-V48-M-SGR    6134x4094                  78.4%

   Same card, same rendered box, product drawn anywhere from 48% to 78% of
   the frame. The source files are not standardised either: 2048 square,
   3000 square, 3500 square, and one 6134x4094 at 3:2.

   This script measures that for the WHOLE catalogue so the acceptable band
   is chosen from the distribution rather than from eight examples.

   ─────────────────────────────────────────────────────────────────────────
   WHAT "FILL" MEANS HERE, AND THE TWO WAYS IT LIES

   Fill = the bounding box of every pixel that is neither near-white nor
   transparent, as a percentage of the canvas.

   It lies in two directions, so both are recorded rather than assumed:

   1. LIFESTYLE SHOTS. A room scene has no white background, so its bounding
      box is the whole canvas and it scores ~100%. Cropping one would cut the
      room away. bgWhite=0 marks these — they are not candidates, however
      they score.

   2. SOFT SHADOWS AND REFLECTIONS. A vanity photographed on white often has
      a grey contact shadow that is genuinely part of the image. The
      threshold below (243) keeps shadows INSIDE the box on purpose. A
      tighter threshold would report a smaller product and over-crop.

   The corner sample that sets bgWhite is deliberately crude — four corners,
   all four must be near-white. A product that touches a corner therefore
   reads as bgWhite=0 and is excluded. That is the safe direction to be
   wrong in: it under-selects candidates rather than proposing a crop on an
   image nobody checked.

   ─────────────────────────────────────────────────────────────────────────
   WHY IT MEASURES A 400px COPY AND NOT THE MASTER

   The masters are 2048-6134px. Decoding 5,000 of those is slow and buys
   nothing: measured on 330-V48-M-SC, fill at width=400 and fill at full
   resolution agree to within one percentage point (48.0/64.3 vs 47.7/63.3).
   The number wanted here is a PERCENTAGE, and percentages survive scaling.

   The exact crop rectangle, if one is ever cut, must still be computed from
   the master — a rectangle derived from a 400px preview would be off by up
   to 15 real pixels. This script does not emit rectangles for that reason.
   ───────────────────────────────────────────────────────────────────────── */

const path = require('path');
const fs   = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/* sharp is not a project dependency — this is a one-off survey and the
   catalogue does not process images at runtime. Installed on demand rather
   than added to package.json, so a native build is not forced on every
   deploy of a storefront that never decodes an image. */
/* sharp is pinned BELOW the current release on purpose. 0.35.x requires
   Node >= 20.9.0; this project runs Node 20.3.0, where npm installs it
   with only a warning and then the require fails at run time. 0.33.5
   needs >= 18.17.0 and works here. Raise this only after the runtime
   Node version moves. */
const SHARP_VERSION = '0.33.5';

let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  /* PRINT THE REAL ERROR. The first two versions of this block swallowed
     it and printed only the install instruction — so when the install
     "succeeded" but the engine was too old, the owner ran the same
     command twice and got the same unhelpful message twice. A catch that
     hides why it failed turns one round trip into three. */
  console.error(
    'This survey needs an image decoder, and loading it failed.\n\n' +
    '  ' + err.message.split('\n')[0] + '\n\n' +
    'Install the pinned version:\n\n' +
    '  npm install --no-save sharp@' + SHARP_VERSION + '\n\n' +
    'Pinned, not latest: sharp 0.35.x requires Node >= 20.9.0 and this\n' +
    'project runs ' + process.version + '. npm installs the newer one with only a\n' +
    'warning, then it fails to load here.\n\n' +
    'Kept out of package.json on purpose — the storefront never decodes\n' +
    'an image at runtime, and sharp is a native build.');
  process.exit(2);
}

const args = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const LIMIT       = parseInt(argOf('limit', '0'), 10);        // 0 = all
const CONCURRENCY = parseInt(argOf('concurrency', '10'), 10);
const PROBE_W     = parseInt(argOf('width', '400'), 10);

/* Near-white cutoff. 243, not 255: JPEG-sourced "white" backgrounds are
   rarely pure, and 255 would report a full-canvas box on almost everything.
   Shadows stay inside the box by design — see the header. */
const WHITE_MIN = 243;
const ALPHA_MIN = 12;

const OUT_DIR = path.join(__dirname, 'out');
const OUT_CSV = path.join(OUT_DIR, 'hero-fill-survey.csv');

/* ── measure one image ─────────────────────────────────────────────────
   Split into fetch and analyse so the pixel maths can be tested against
   synthetic images of known geometry without a network or a database.
   See scripts/surveyHeroFill.test.js — the bounding box is the one claim
   this whole exercise rests on, and "it looked right on eight examples"
   is not a test. */
async function measure(url) {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(url + sep + 'width=' + PROBE_W);
  if (!res.ok) return { err: 'HTTP ' + res.status };
  return analyse(Buffer.from(await res.arrayBuffer()));
}

async function analyse(buf) {
  const img = sharp(buf).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  if (!W || !H) return { err: 'undecodable' };

  const at = (x, y) => {
    const i = (y * W + x) * C;
    return { r: data[i], g: data[i + 1], b: data[i + 2], a: C > 3 ? data[i + 3] : 255 };
  };
  const isBg = (p) =>
    p.a < ALPHA_MIN || (p.r >= WHITE_MIN && p.g >= WHITE_MIN && p.b >= WHITE_MIN);

  /* Four corners must ALL read as background, or this is not a cutout.
     Under-selects rather than over-selects — see the header. */
  const bgWhite = [at(0, 0), at(W - 1, 0), at(0, H - 1), at(W - 1, H - 1)].every(isBg);

  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isBg(at(x, y))) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return { err: 'blank image' };

  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  return {
    probeW: W, probeH: H,
    fillW: +(cw / W * 100).toFixed(1),
    fillH: +(ch / H * 100).toFixed(1),
    /* The larger of the two is what the eye reads as "how big is it",
       because the card letterboxes on whichever axis binds first. */
    fillMax: +(Math.max(cw / W, ch / H) * 100).toFixed(1),
    bgWhite: bgWhite ? 1 : 0,
    offCentreX: +(((minX + maxX) / 2 / W - 0.5) * 100).toFixed(1),
    offCentreY: +(((minY + maxY) / 2 / H - 0.5) * 100).toFixed(1),
  };
}

/* Exported for the test. Running this file directly still surveys. */
module.exports = { analyse, WHITE_MIN, ALPHA_MIN };
if (require.main !== module) return;

/* ── main ────────────────────────────────────────────────────────────── */
(async () => {
  let pool;
  try {
    pool = require('../src/config/database').bvoPool;
  } catch (err) {
    console.error('Could not open the database. Is .env present?\n ', err.message);
    process.exit(2);
  }

  /* is_primary = 1 is exactly what the cards render — collectionsController
     joins on it in six places. Surveying anything else would measure images
     no shopper sees on a card. */
  const sql = `
    SELECT p.id, p.sku, p.name, p.brand, pi.url
      FROM products p
      JOIN product_images pi
        ON pi.product_id = p.id AND pi.is_primary = 1
     WHERE pi.url IS NOT NULL AND pi.url <> ''
     ORDER BY p.brand, p.sku
     ${LIMIT ? 'LIMIT ' + LIMIT : ''}`;

  let rows;
  try {
    [rows] = await pool.query(sql);
  } catch (err) {
    /* PRINT EVERY FIELD THAT COULD SAY WHY. mysql2 puts the server's own
       words in err.sqlMessage and leaves err.message empty for some
       connection failures — the first version of this printed only
       err.message and produced "Could not read the catalogue." followed
       by a blank line, which told the owner nothing at all. That is the
       third time in this script that a handler hid its own cause. */
    console.error('Could not read the catalogue.\n');
    for (const k of ['message', 'sqlMessage', 'code', 'errno', 'sqlState', 'fatal']) {
      if (err[k] !== undefined && err[k] !== '') console.error(`  ${k}: ${err[k]}`);
    }
    console.error(
      `\n  trying: ${process.env.DB_USER || 'bvo_user'}@` +
      `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}` +
      `/${process.env.DB_NAME || 'bvo_website'}`);
    console.error(
      '\nIf DB_HOST is localhost, this machine is not where the database\n' +
      'lives — the catalogue is on the Hostinger host. Either run this on\n' +
      'the server, or point DB_HOST at it if remote access is allowed.');
    if (!err.code && !err.sqlMessage) console.error('\n  raw: ' + require('util').inspect(err).slice(0, 400));
    process.exit(2);
  }
  if (!rows.length) {
    console.error('No primary images found. Nothing to survey.');
    process.exit(2);
  }
  console.log(`Surveying ${rows.length} hero images at ${PROBE_W}px, ` +
              `${CONCURRENCY} at a time.\n`);

  /* Many SKUs share one image. Measure each distinct URL once and fan the
     result back out — on a catalogue this shape that is most of the work. */
  const byUrl = new Map();
  for (const r of rows) {
    if (!byUrl.has(r.url)) byUrl.set(r.url, []);
    byUrl.get(r.url).push(r);
  }
  const urls = [...byUrl.keys()];
  console.log(`${urls.length} distinct images (${rows.length - urls.length} shared).\n`);

  const results = new Map();
  let done = 0, failed = 0;
  const t0 = Date.now();

  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const url = urls.pop();
      if (!url) return;
      let m;
      try { m = await measure(url); }
      catch (e) { m = { err: e.message.slice(0, 60) }; }
      if (m.err) failed++;
      results.set(url, m);
      if (++done % 100 === 0 || done === byUrl.size) {
        const rate = done / ((Date.now() - t0) / 1000);
        process.stdout.write(
          `\r  ${done}/${byUrl.size}  ${rate.toFixed(1)}/s  ` +
          `${failed} failed   `);
      }
    }
  }));
  console.log('\n');

  /* ── CSV ──────────────────────────────────────────────────────────── */
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const lines = ['product_id,sku,brand,name,url,probe,fill_w_pct,fill_h_pct,fill_max_pct,bg_white,off_centre_x_pct,off_centre_y_pct,error'];
  for (const r of rows) {
    const m = results.get(r.url) || {};
    lines.push([r.id, r.sku, r.brand, r.name, r.url,
                m.probeW ? `${m.probeW}x${m.probeH}` : '',
                m.fillW ?? '', m.fillH ?? '', m.fillMax ?? '', m.bgWhite ?? '',
                m.offCentreX ?? '', m.offCentreY ?? '', m.err || ''].map(esc).join(','));
  }
  fs.writeFileSync(OUT_CSV, lines.join('\n'));

  /* ── histogram, cutouts only ──────────────────────────────────────── */
  const cutouts = rows
    .map(r => results.get(r.url))
    .filter(m => m && !m.err && m.bgWhite === 1);
  const scenes = rows.filter(r => { const m = results.get(r.url); return m && !m.err && m.bgWhite === 0; });
  const errs   = rows.filter(r => { const m = results.get(r.url); return m && m.err; });

  console.log(`White-background cutouts : ${cutouts.length}`);
  console.log(`Not cutouts (lifestyle)  : ${scenes.length}   <- excluded, never crop these`);
  console.log(`Failed to measure        : ${errs.length}\n`);

  if (cutouts.length) {
    const vals = cutouts.map(m => m.fillMax).sort((a, b) => a - b);
    const pct = q => vals[Math.min(vals.length - 1, Math.floor(q * vals.length))];
    console.log('Product fill (larger axis), white-background heroes only');
    console.log('───────────────────────────────────────────────────────');
    const buckets = new Map();
    for (const v of vals) {
      const b = Math.floor(v / 5) * 5;
      buckets.set(b, (buckets.get(b) || 0) + 1);
    }
    const max = Math.max(...buckets.values());
    for (const b of [...buckets.keys()].sort((a, b2) => a - b2)) {
      const n = buckets.get(b);
      const bar = '█'.repeat(Math.max(1, Math.round(n / max * 44)));
      console.log(
        `  ${String(b).padStart(3)}-${String(b + 4).padStart(3)}%  ` +
        `${String(n).padStart(5)}  ${bar}`);
    }
    console.log('\n  p05 ' + pct(0.05) + '%   p25 ' + pct(0.25) +
                '%   median ' + pct(0.50) + '%   p75 ' + pct(0.75) +
                '%   p95 ' + pct(0.95) + '%');
    console.log('\nHow many would need normalising, by where you draw the line:');
    for (const line of [50, 55, 60, 65, 70, 75]) {
      const below = vals.filter(v => v < line).length;
      console.log(`  keep >= ${line}%  ->  ${String(below).padStart(5)} ` +
                  `images to normalise  (${(below / vals.length * 100).toFixed(1)}%)`);
    }
  }

  console.log('\nCSV: ' + OUT_CSV);
  await pool.end();
})().catch(e => { console.error(e); process.exit(2); });
