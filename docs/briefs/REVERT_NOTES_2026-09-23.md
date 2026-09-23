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

## Open, unresolved

**CLS 0.321.** Lighthouse attributes all of it to
`<div class="hero-content">`. It is bimodal — exactly `0.321` or exactly `0`,
never between — so it is one element shifting by one fixed amount, winning or
losing a race. Not noise.

Three hypotheses tested and **wrong**:

1. the hero image had no reserved box — fixed in `4ba4897`, CLS unchanged
2. the ten category cards are unsized — they sit at y=1617, below the 823px
   scoring viewport, so they cannot contribute
3. the centring rule applies after first paint — it is in the head at offset
   9301, render-blocking, so it cannot

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

1. **Lighthouse still calls the hero "Unsized image element"** despite
   `width="1160" height="927"` being present on the `<img>`. Suspected cause:
   the `<picture>`/`<source>` structure — when a `<source>` matches,
   the audit may read dimensions from it, and the `<source>` has none.
   Test: put `width`/`height` on the `<source>` too.
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
