# Revert Notes — 2026-09-23

> Everything shipped today, newest first, with the exact command to undo each
> one. Written so a revert needs no context.

**All of today's commits touch templates only.** No migrations, no schema, no
data. A revert is always safe to run and never loses anything but the change
itself.

---

## The stack, newest first

| # | Commit | What it did | Files |
|---|---|---|---|
| 8 | *(this one)* | Restores these notes, which #7's revert deleted | `docs/` |
| 7 | `77e467c` → reverted by `6184921` | Font diagnostic — result below | `main.ejs` |
| 6 | `26052e4` | `_heroSrcset` keeps the ladder on a query string | `index.ejs` |
| 5 | `4ba4897` | Hero image reserves its box (CLS) | `index.ejs`, `theme.ejs`, `themeSettings.js` |
| 4 | `811efc8` | 19 banner comments → EJS comments | `index.ejs` |
| 3 | `e1a7fc2` | HTML comment held a live EJS tag | `main.ejs` |
| 2 | `f7f3ac1` | Stacked copy block stretches full width | `index.ejs` |
| 1 | `6f21c8f` | Stacked hero image rendered 0px tall | `index.ejs` |
| 0 | `54574bb` | `stacked` mobile hero layout added | `index.ejs`, `theme.ejs`, `themeSettings.js` |
| — | `cb8c24c` | One mobile alignment setting, not two | 6 files inc. 2 stylesheets |

## Undo one commit

```bash
cd "/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js"
git revert --no-edit <sha>
git push origin main
```
Then redeploy. Safe for any of the above.

## Undo everything from today

```bash
git revert --no-edit cb8c24c..HEAD
git push origin main
```

## Undo without touching git — Theme Editor only

Most of today's *visible* change is settings, not code. Admin → Theme →
Mobile Hero:

| Setting | Today | Was |
|---|---|---|
| Layout mode | Stacked | Background |
| Mobile Hero Image | `…with-towers.webp?crop=1160,927,342,0&width=750` | `…emmeline-36-pebble-oak…webp` |
| Text shadow | off | on |

Setting Layout mode back to **Background** needs no deploy at all.
That is the fastest rollback available and should be the first thing
tried if the homepage looks wrong.

---

## Current production values — recorded 2026-09-23, before the `hero.text_align` change

> **Why this section exists.** The next change gives `hero.text_align` a real
> default in `themeSettings.js`. Settings live in `data/theme_settings.json` and
> the DB, NOT in git — so `git revert` cannot restore a settings value that gets
> overwritten. These are the values to type back by hand if that happens.
>
> **Every value below was read from the live rendered HTML**, not from the local
> settings file. `data/theme_settings.json` in this repo is STALE — it has no
> `hero_mobile.layout` at all, while production renders `stacked`. Do not treat
> the local file as a record of production.

### Hero settings, as production currently renders them

| Setting | Current value | Where it shows in the HTML |
|---|---|---|
| `hero.text_align` | `left` | `#hero-main .hero-content{text-align:left}` |
| `hero_mobile.text_align` | `center` | `…{text-align:center!important}` in `@media (max-width:860px)` |
| `hero_mobile.layout` | `stacked` | the stacked override block is present |
| `hero_mobile.min_height_px` | `450` | `min-height:450px !important` (≤480) |
| `hero_mobile.max_height_px` | **`40`** | `max-height:40px !important` (≤480) — see warning below |
| Overlay colour / opacity | `#ffffff` / `0.40` | `--ov-clr` / `--ov-op` (≤480) |
| Text shadow | off | `text-shadow:none` on all five text classes |

### Image URLs

```
desktop   https://images.bathroomvanitiesoutlet.com/site/hero/homepage-hero-vanity-with-towers.webp
mobile    https://images.bathroomvanitiesoutlet.com/site/hero/homepage-hero-vanity-with-towers.webp?crop=1160,927,342,0
```

The mobile crop `1160,927,342,0` is the **D2** selection — 5:4, full height,
symmetric about the vanity axis at x=922. Ladder rungs: 480, 768, 1024, 1160.

### Colours

| Token | ≤480px | Desktop |
|---|---|---|
| `--hero-eyebrow` | `#486854` | `#5A7A5A` |
| `--hero-h1` | `#182840` | — |
| `--hero-sub` | `#182840` | `#182840` |
| `--hero-bg` | — | `#FAF7F2` |

### Font sizes, ≤480px

```
eyebrow 11px   h1 23px   h2 42px   sub 16px   sub2 15px
```

### Content box

| Var | ≤480px | Desktop |
|---|---|---|
| `--content-box-bg` | `rgba(255,255,255,0.60)` | `rgba(255,255,255,0.70)` |
| `--content-box-radius` | `10px` | `6px` |
| `--content-box-pad` | — | `16px` |
| `--content-max-w` | `320px` | `320px` |
| `--content-v-offset` | `0%` | `4%` |
| `--content-h-offset` | `4%` | `3%` |

### ⚠ `max_height_px: 40` is a landmine

`min-height:450px` and `max-height:40px` are set on the same element in the same
≤480 block. It is harmless **only** because the stacked layout's
`max-height:none!important` overrides it at ≤860.

Switching Layout mode back to **Background** — which this very file recommends as
the fastest rollback — removes that override and squashes the hero to 40px. Fix
the value before ever using that rollback path.

---

## What is NOT reverted by any of the above

`cb8c24c` also edited `public/css/site4.css` and `site-bundle.css` and bumped
the cache key to `?v=14`. Reverting it reverts the CSS too, but the cache key
goes back to `v=13` — which visitors may already have cached from *before*
today. If a revert of `cb8c24c` looks wrong in a browser, hard-refresh before
concluding anything.

---

## Known-good reference points

| | |
|---|---|
| Last state before any hero work | `86d13046` |
| Last state before the CLS work | `811efc8` |
| Best measured PageSpeed mobile today | **90** (1:37 PM) |
| Worst measured, same code | **72** (1:40 PM) |

Those last two are the same deployed code three minutes apart. Do not judge a
revert on a single PageSpeed run — see below.

---

## CLOSED — CLS 0.321 is a PageSpeed Insights artifact

> Resolved end of day 2026-09-23, after the whole investigation below.
> **Do not re-open this on the strength of a PSI number alone.**

Seven independent tools were run against the same deployed code:

| Tool | Device | Connection | CLS |
|---|---|---|---|
| GTmetrix | Pixel 8/9 mobile | 4G, 9/5 Mbps, 125 ms | **0** |
| DebugBear-style | mobile | 12 Mbps, 70 ms | **0** |
| five others | — | — | **0** |
| **PSI / Lightrider** | Moto G Power | Slow 4G | **0.321** |
| **CrUX — real users** | — | — | **98% passing** |

Only PSI reports it, always as *exactly* `0.321`, in roughly three runs of
four. A genuine layout instability varies continuously with timing; a fixed
value that either appears or doesn't is deterministic to that harness
(headless Chromium 153 under Lightrider). It is also independent of load —
one run measured TBT 190 ms with 2,004 ms of Style & Layout, another TBT
0 ms with a light main thread, both `0.321`.

**The number that matters for Google is CrUX, not the lab score.** Core Web
Vitals for ranking come from field data. Ours passes. The PSI lab CLS is a
diagnostic and is not used for ranking.

Also ruled out by direct test, not reasoning:

- the HTML is **not cached or varied** — the bare URL and a cache-busted URL
  return byte-identical bodies (208,591 both), `cache-control: no-store`
- the PSI "culprit" list is **loose attribution**: it changed between runs
  (image alone, then image + three fonts) while the score stayed identical.
  It is not a bill of materials, and treating it as one cost most of a day.

### Five hypotheses tested and eliminated

1. hero image had no reserved box — `4ba4897`, CLS unchanged
2. category cards unsized — they sit at y=1617, below the 823px viewport
3. centring rule applies after paint — it is in the head, render-blocking
4. `site3.css` applied late — it IS applied post-paint, but toggling it
   `print`/`all` on the live page moved **nine hero elements by zero pixels**;
   its `hero-eyebrow`/`hero-sub` matches were substrings of `.lb-hero-*` and
   `.blog-hero-*`
5. desktop/mobile alignment race — tested by setting both to `center` in the
   Theme Editor; **two runs, both still 0.321**

GTM was eliminated too: gtag starts at 4180 ms, after FCP and LCP, 0 ms main
thread. And there is no GTM *container* at all — `G-PLBNP2YD9K` is a GA4
Measurement ID loaded via `gtag/js`, which is merely served from the
googletagmanager.com domain. Container-level advice (server-side tagging,
trigger delays, tag audits) has nothing to act on here.

### One real shift was found, and is fixed

Not the 0.321, but genuine. See the hero aspect-ratio note in `index.ejs`:
the 1x1 GIF placeholder gave the `<img>` a true 1:1 intrinsic ratio, which
outranks `width`/`height` attributes. Measured 412x412 → 412x329, an 83px
jump; a CSS `aspect-ratio` fixes it, verified 0.

---

## Historical — the investigation, kept for its eliminations

**CLS 0.321.** Lighthouse attributes all of it to
`<div class="hero-content">`. It is bimodal — exactly `0.321` or exactly `0`,
never between — so it is one element shifting by one fixed amount, winning or
losing a race. Not noise.

### `hero.text_align` has no default — a separate defect, found 2026-09-23

Not a CLS cause. A Rule 10 violation, recorded so it is not lost.

`themeSettings.js` has **no `text_align` key in the `hero:` block**, though every
other section has one. The desktop value is invented twice, independently:

```
index.ejs:245   var _heroAlign = hero.text_align || 'left';
theme.ejs:887   teAlignment('hero.text_align', h.text_align)   ← no fallback passed
theme.ejs       teAlignment():  var v = value || 'left';
```

The editor *does* post a `hero.text_align` field, and `save()` writes any posted
key via `setDotPath`, so production most likely holds a saved value with no
default behind it. A fresh install and a saved install therefore disagree.

Note the asymmetry: every other section defaults to `'center'`
(theme.ejs:233, 1372, 1409, 1423, 1505). Only the hero defaults to `'left'`,
in two hardcoded places.

Three hypotheses tested and **wrong**:

1. the hero image had no reserved box — fixed in `4ba4897`, CLS unchanged
2. the ten category cards are unsized — they sit at y=1617, below the 823px
   scoring viewport, so they cannot contribute
3. the centring rule applies after first paint — it is in the head at offset
   9301, render-blocking, so it cannot
4. **late-applied `site3.css`** — it genuinely IS applied after first paint
   (loaded `media="print"`, flipped to `all` by an onload script,
   `index.ejs:15,19`). Eliminated by direct test: toggled `site3-css` between
   `print` and `all` on the live page at 412px while measuring the hero box,
   content, content-box, h1, h2, eyebrow, sub, CTAs and value bar. **Zero delta
   on every element.** Its `hero-eyebrow`/`hero-sub` matches are substrings of
   `.lb-hero-eyebrow`, `.blog-hero-sub`, `.lb-hero-sub` — lookbook and blog
   classes, not the homepage's.
5. **GTM or a slow third party** — gtag starts at 4180 ms, after both FCP and
   LCP, and reports 0 ms main-thread time. Nor is there any script-driven
   repositioning: no `matchMedia`, `ResizeObserver`, `offsetWidth`,
   `clientWidth` or `getBoundingClientRect` anywhere in `public/js/*.js` or
   `index.ejs`. Nothing reflows the hero after viewport detection.

### The font hypothesis was tested and is NOT the whole answer

`77e467c` made the Google Fonts stylesheet render-blocking so `@font-face`
would be known before first paint. Five PageSpeed mobile runs:

```
0.321   0   0   0.321
```

Still bimodal, still shifting. Reverted in `6184921`.

**But the run with the blocking stylesheet exposed the root causes**, which
Lighthouse had not previously listed:

```
Layout shift culprits
Total                                       0.321
<div class="hero-content">                  0.321
  ├─ <img class="hero-poster" …>            Unsized image element
  ├─ …S6uyw4BMU….woff2                      Web font
  ├─ …0QIvMX1D_….woff2                      Web font
  └─ …S6u9w4BMU….woff2                      Web font
```

**Four contributors, one shift.** That is why fixing the image alone
(`4ba4897`) moved nothing, and why blocking the font CSS alone moved nothing.
Any single remaining contributor triggers the same 0.321.

Two leads worth taking next, one at a time, five runs after each:

1. **Lighthouse calls the hero "Unsized image element" — and it is RIGHT.**
   Corrected 2026-09-23 by reading the live markup. `#hero-main` contains
   **three** `<img>` elements, and only one of them carries dimensions:

   ```
   <img class="hero-poster hero-img-desktop" …>          NO width/height
   <img class="hero-img-mobile" …>                       NO width/height
   <img class="hero-poster" width="1160" height="927" …> has them
   ```

   `4ba4897` added `width`/`height` to the third one only. The other two were
   never touched, which is why that commit moved nothing.

   Compounding it: **all three have `src="data:image/gif;base64,R0lGODlh…"`**
   — a 1×1 transparent GIF. The real images live only in `<source srcset>`.
   So until a `<source>` resolves, an `<img>` with no width/height has an
   intrinsic ratio of **1:1** from that 1px placeholder. On a 412px viewport
   that is a 412×412 box that then snaps to the true height.

   This is the most specific, best-evidenced CLS lead so far — but it is
   still a LEAD, not a proven cause. Four hypotheses have already been wrong.
   Test: add `width`/`height` to the two bare `<img>` tags, then five runs.
2. **85 KiB of woff2 across four files**, arriving 494–1025 ms. With
   `display=optional` they should never be applied that late, yet Lighthouse
   names them as shift causes — so `optional` is not behaving as intended.
   Self-hosting removes the third-party round trip and makes it controllable.

Also seen once: the LCP element became `<p class="hero-h2"
style="font-size:41px">` with 610 ms of *element render delay* and no resource
load. That inline 41px is the DESKTOP size; the mobile override is a scoped
`!important` rule. Worth checking whether that override lands after paint.

### Original hypothesis, now superseded `main.ejs:99-101` loads Google
Fonts as `rel="preload"` flipped to `rel="stylesheet"` on load, so `@font-face`
is not known until after first paint. `display=optional`'s block period is
measured from when the font face is *created*, so a late-applied stylesheet can
defeat it and reflow the text.

**Do not simply make that stylesheet render-blocking.** The preload pattern is
a measured optimisation — 7 runs each, worth 0.3–0.6s of LCP against
`media=print`. See the comment at `main.ejs:92-98`.

**Could not reproduce locally.** Three attempts: warm cache gives 0 shifts; a
blob-iframe with cache-busted subresources is blocked cross-origin; the
postMessage variant is blocked by the site's own CSP, correctly, since the
injected script has no nonce.

---

## A lesson from this file's own history

`77e467c` shipped the font diagnostic **and these notes in the same commit**.
Reverting the diagnostic therefore deleted the notes — the one document whose
whole purpose was surviving a revert.

Keep disposable experiments and durable documentation in separate commits.
Recovered with:

```bash
git checkout 77e467c -- docs/briefs/REVERT_NOTES_2026-09-23.md
```

---

## Reading PageSpeed at all

Four runs of identical code today: **74, 83, 90, 72**. FCP swung 1.2s to 2.7s.
It runs on shared infrastructure with simulated throttling; the server is
shared hosting. One run tells you nothing. Run 5 and take the median, or use
CrUX field data.

One exception: the CLS value is bimodal and discrete, so *that* number is
signal even from a single run.

---

## Also open, unrelated

`main.ejs` documents a rebuild recipe for `site-bundle.css` that does not
reproduce the file on disk — 4,917 bytes unaccounted for. Logged as OPEN_ITEMS
item 11. Patch `site4.css` and `site-bundle.css` by hand, in lockstep; do not
run the recipe.
