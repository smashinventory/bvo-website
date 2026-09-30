'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   cardFraming.js — make every product card show its product at the same
   size, in the same place, without touching a single image file.

   ── WHY THIS EXISTS ────────────────────────────────────────────────────

   Owner, 2026-09-29, on a filtered collection page: "The two on the
   bottom are significantly different than the other 4 out of six. It
   seems the James Martin team did not standardize the image crop/size."

   Correct. Measured across all 6,065 hero images (scripts/surveyHeroFill
   .js) there are THREE independent faults, all in the source photography:

     1. WHITESPACE. The product occupies 20% to 100% of its canvas.
     2. CANVAS SHAPE. Square, 3:2 landscape and 2:3 portrait all appear.
        A 2:3 portrait in a landscape card box letterboxes by height and
        throws away 40% of the available width, so a WELL-framed portrait
        hero renders SMALLER than a badly-framed square one. 650-V48-SGR-
        FEJP is 83.5% filled and rendered 80px wide; 650-V48-M-SC is 82%
        filled and rendered 172px.
     3. CENTRING. Once rendered, products sit up to 50px above or below
        the middle of a 210px-tall box. 537 of 4,566 are more than 10px
        out. That is the stagger.

   ── WHY CSS AND NOT NEW IMAGE FILES ────────────────────────────────────

   Three approaches were measured before this one:

     CDN crop parameters. Dead. Bunny's crop can only REMOVE pixels, and
     76.4% of these need white space ADDED to reach a common framing.
     Cropping every image to the card's shape was measured and made the
     spread WORSE - 84px to 155px - because 34% cannot be cropped to that
     shape at all without slicing the vanity, so they stay small while
     the rest leap ahead.

     Regenerated files on a new Bunny storage zone. Works, but costs a
     second image hostname: an extra DNS lookup and TLS handshake on
     every page, and hover images would still come from the old host so
     you would pay both. It also breaks 13 srcset guards written as
     `indexOf('images.bathroomvanitiesoutlet.com')`, which would silently
     drop the measured 320-800 ladder and make pages slower. Three days
     of image-performance work sits behind those guards.

     THIS. The browser already has the pixels. Position them.

   What ships is a style attribute. Same URL, same bytes, same srcset,
   same CDN, one hostname, nothing uploaded, nothing regenerated. Delete
   the attribute and the card is exactly what it is today - no purge, no
   rebuild, no migration to undo.

   ── WHY THE NUMBERS COME OUT VIEWPORT-INDEPENDENT ──────────────────────

   .product-img is `height:210px` with a fluid width (site-bundle.css).
   Height is fixed at every breakpoint; width is not. So the framing is
   anchored to the HEIGHT and the horizontal position uses calc(50% - X):

       height   fixed px   - derived from the fixed 210px box
       width    fixed px   - height x the source's own aspect
       top      fixed px   - fixed box height, so this is stable
       left     calc(50% - Npx)  - correct at any card width

   One set of numbers per image, correct on a 4-column desktop grid and a
   1-column phone alike. No media queries, no per-breakpoint variants.
   ═══════════════════════════════════════════════════════════════════════ */

/* The card image box. Height is the load-bearing one — see above. */
const BOX_H = 210;

/* The narrowest the box gets in practice: a 4-across desktop grid. The
   width cap below is applied against THIS rather than the live width,
   because the numbers are computed once and must hold everywhere. Using
   a wider assumption would let a product overflow the narrowest layout. */
const MIN_BOX_W = 299;

/* Product height as a share of the box. 0.90 reproduces the framing the
   owner approved in the mockup on 2026-09-29: a Brittany 48 landed at
   ~222px wide in a 299x210 box, which is 189px tall, which is 90% of 210.

   It is expressed as a height share rather than a width share ON PURPOSE.
   Box height is fixed and box width is not, so anchoring to width would
   make a phone (wider box, same height) scale the product up until it
   ran out of vertical room. */
const TARGET_H = 0.90;

/* And a width ceiling so a very wide, shallow product (a 84" double
   vanity, a linen tower laid down) cannot run out of the sides of the
   narrowest card. */
const MAX_W_SHARE = 0.94;

/* Below this, an image is left completely alone. A product already
   within a few pixels of target gains nothing from a transform, and
   every transformed card is one more thing that can look wrong. */
const MIN_GAIN_PX = 6;

/* Sampling floor. Under 1.0 the browser is upscaling and the product can
   look soft. Measured per image against the real srcset ladder; where it
   falls short the card is served one rung up rather than the whole
   catalogue being pushed to bigger files. */
const LADDER = [320, 400, 480, 640, 800];
const MIN_SAMPLING = 1.0;

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

/**
 * Work out how to place one hero image inside the card box.
 *
 * m: the measurements from the survey —
 *    src_w, src_h      source pixel dimensions
 *    fill_w, fill_h    product bounding box as a % of those
 *    off_x, off_y      bbox centre offset from canvas centre, % of each axis
 *
 * Returns null when the image should be left exactly as it is. Callers
 * MUST treat null as "render today's markup unchanged" — that is the
 * fallback for unmeasured products, lifestyle shots, and anything the
 * maths cannot improve.
 */
function frame(m) {
  if (!m) return null;
  const W = num(m.src_w), H = num(m.src_h);
  const fw = num(m.fill_w), fh = num(m.fill_h);
  const ox = num(m.off_x) ?? 0, oy = num(m.off_y) ?? 0;
  if (!W || !H || !fw || !fh) return null;
  if (W <= 0 || H <= 0 || fw <= 0 || fh <= 0) return null;

  const bw = (fw / 100) * W;          // product width, source px
  const bh = (fh / 100) * H;          // product height, source px
  if (bw <= 0 || bh <= 0) return null;

  const cx = W / 2 + (ox / 100) * W;  // product centre, source px
  const cy = H / 2 + (oy / 100) * H;

  /* Scale to put the product at TARGET_H of the box height, then pull it
     back if that would make it wider than the narrowest card allows. */
  let s = (TARGET_H * BOX_H) / bh;
  const wCap = (MAX_W_SHARE * MIN_BOX_W) / bw;
  if (s > wCap) s = wCap;

  /* What it does today: object-fit: contain inside the box, at the
     narrowest card width. Compared against, so a no-op is detectable. */
  const s0 = Math.min(MIN_BOX_W / W, BOX_H / H);
  if (bw * s <= bw * s0 + MIN_GAIN_PX && Math.abs((cy - H / 2) * s0) < 5) {
    return null;                       // already fine — leave it alone
  }

  const imgW = W * s, imgH = H * s;

  /* ── THE WIDTH CAP IS A PERCENTAGE, NOT PIXELS ──────────────────────
     The first version capped the product at MAX_W_SHARE x MIN_BOX_W and
     assumed MIN_BOX_W was 299 — the 4-across desktop grid. It is not the
     minimum. A 3-across grid with the filter sidebar gives roughly 238px
     cards, so a product capped at 281px overhung a 238px box by 43px and
     72" vanities were sliced down both sides. The owner caught it on the
     live page.

     A px cap cannot be right, because the box width is fluid and this is
     computed once, server-side. So the cap is expressed as a percentage
     of the box: CSS resolves it against whatever the card actually is,
     at every breakpoint, including ones that do not exist yet.

       width: min(<px from the height rule>, <% from the width cap>)

     The px term normalises product HEIGHT, which is what makes the grid
     even. The % term is a guarantee it can never overhang. Whichever
     binds, binds. */
  const capPct = +((MAX_W_SHARE * 100 * W) / bw).toFixed(2);

  /* ── POSITIONING IS ALSO SCALE-INDEPENDENT ──────────────────────────
     Once width can be decided by the browser, a px top/left computed
     here would be wrong whenever the % term wins. Percentages in
     `translate` resolve against the ELEMENT'S OWN size, so shifting by
     the product centre's position within the image puts that centre on
     the box centre at any scale, without knowing the scale.

     The standalone `translate` property, not `transform`: the hover zoom
     (.product-card:hover .product-img-pri{transform:scale(1.04)}) lives
     in transform, and an inline transform here would silently kill it. */
  const cxPct = +((cx / W) * 100).toFixed(2);
  const cyPct = +((cy / H) * 100).toFixed(2);

  const top  = BOX_H / 2 - cy * s;     // reported for tests/diagnostics
  const dx   = cx * s;

  /* Smallest ladder rung that still has ~1 source pixel per drawn pixel
     across the product. Under-sampling shows as softness, and the whole
     point of the existing ladder is that it was measured, not guessed —
     so this bumps only the cards that need it. */
  const drawnW = bw * s;
  let rung = LADDER[LADDER.length - 1];
  for (const w of LADDER) {
    if (((fw / 100) * w) / drawnW >= MIN_SAMPLING) { rung = w; break; }
  }
  const sampling = {};
  for (const w of LADDER) sampling[w] = +(((fw / 100) * w) / drawnW).toFixed(2);

  const r2 = (n) => Math.round(n * 10) / 10;
  return {
    width: r2(imgW), height: r2(imgH), top: r2(top), dx: r2(dx),
    capPct, cxPct, cyPct,
    productW: Math.round(drawnW),
    productWBefore: Math.round(bw * s0),
    zoom: +(s / s0).toFixed(2),
    minRung: rung,
    sampling,
    /* position and max-width are IN THE INLINE STYLE, not in a stylesheet.
       site-bundle.css is the only stylesheet the storefront loads, and
       views/layouts/main.ejs documents at length that the bundle does not
       reproduce from its own recipe — site4.css is admin-only, and rules
       added to the wrong file have silently never reached a shopper
       before. Two extra declarations per framed card (~34 bytes) buys
       immunity from that entire class of failure.

       .product-img is position:relative with overflow:hidden already, so
       an absolutely positioned child is clipped to the card box. The base
       class keeps object-fit:contain, which is a no-op here because width
       and height preserve the source's own aspect ratio. */
    style: `position:absolute;max-width:none;left:50%;top:50%;` +
           `width:min(${r2(imgW)}px,${capPct}%);height:auto;` +
           `translate:-${cxPct}% -${cyPct}%`,
  };
}

/** Convenience for templates: the style string, or '' to change nothing. */
function frameStyle(m) {
  const f = frame(m);
  return f ? f.style : '';
}

module.exports = {
  frame, frameStyle,
  BOX_H, MIN_BOX_W, TARGET_H, MAX_W_SHARE, MIN_GAIN_PX, LADDER, MIN_SAMPLING,
};
