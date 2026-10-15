# Mobile homepage performance — what was actually done

*Written 2026-10-14. Sources: the commit record, the measurements quoted in
those commits, and `REVERT_NOTES_2026-09-23.md`.*

> ## PageSpeed Insights — mobile, 2026-10-14
>
> | Performance | Accessibility | Best Practices | SEO |
> |---|---|---|---|
> | **98** | 97 | **100** | **100** |
>
> Previous recorded lab run: **90**, 2026-09-23. A large share of the work
> below landed between those two dates — fonts removed, four stylesheets
> consolidated, the srcset ladder capped, the 1×1 placeholders dropped, the
> forced reflows replaced.
>
> Two things this run settles, recorded here so they are not re-litigated:
>
> **The PSI CLS 0.321 did not appear.** CLS is a quarter of the performance
> score; 0.321 is well outside the "good" threshold and could not coexist with
> 98. The conclusion reached on 2026-09-23 — harness artifact, not a real
> shift — holds.
>
> **The gtag question is answered at the score level.** This 98 was measured
> with `gtag.js` loading *with the page*, not deferred. Whatever the deferral
> was buying in September is not needed to sit in the high 90s now. See the
> analytics section below; the remaining question is only whether the LCP
> millisecond cost is still there, which is a finer measurement than the score.

---

## The method, which mattered more than any single fix

Every change below was made against a measured number, then re-measured. The
commit messages carry the figures — "LCP median 2756 → 2540ms, 5 runs each",
"44KB → 0KB, 4/4 requests → 0/4" — rather than a claim that something ought to
be faster.

This is the part worth keeping. Two of the biggest time sinks in this work were
caused by *reasoning* about performance instead of measuring it, and both are
written up below as warnings rather than quietly dropped.

---

## 1. LCP — stop the hero competing for bandwidth

The homepage's Largest Contentful Paint is the hero image. Almost all the real
gains came from getting it requested earlier and getting everything else out of
its way on a Slow 4G connection.

**Preload the hero** — `9c79b2e`. Production traces showed the browser doing
nothing for ~490ms after TTFB, then requesting the hero at ~677ms, with LCP at
1032ms. Nothing on the path was slow: Bunny was preconnected, gzip on, fonts
async, `fetchpriority="high"` already set. The browser simply did not know the
image existed until the parser reached the `<picture>` behind 264KB of HTML. A
preload hint closed that discovery gap.

**Phones stopped downloading the desktop hero** — `facec55`. The desktop layer
is `display:none` below 480px, but its eager `<img>` still fetched 44KB on
every phone, landing mid-LCP. Both images moved into a `<picture>` gated on
`(min-width: 481px)`, so phones resolve to a 1×1 GIF. Measured: phone requests
for the desktop hero 4/4 → 0/4, 44KB → 0KB, LCP median ~2650 → ~2450ms, desktop
unchanged.

**Capped the hero srcset ladder** and kept it working when the URL carries a
query string — `26052e4` and the srcset work around it. A ladder that offers
sizes nobody uses just gives the browser more ways to pick wrong.

**Right-sized the logo** — `c0e8c66`. A 512px logo was being served into a 150px
slot: 12.5KB to show 150px. 1× now takes a resized copy at 5.7KB. 2× points at
the original deliberately — the resizer's 300px output measured *16KB* against
the original's 11.4KB, so the obvious change would have made it worse. Only
measuring caught that.

**Resized and deferred the before/after pair** — `2177dcf`. These two were
emitting raw `<img src>` with no `?width=`, no srcset and no `loading`
attribute — bypassing the image resizer entirely and shipping full masters,
eagerly, from below the fold. GTmetrix had them flagged under both "properly
size images" and "defer offscreen images".

## 2. Render path — fewer blocking bytes

**Google Fonts removed entirely** — `4f7da63`, `117afb9`. The site was serving
Lora + Lato from Google while the owner believed it was on system fonts. Now
Georgia + system-ui: no stylesheet fetch, no font files, no `font-display`
swap, and no third-party host on the critical path. The CSP was tightened to
match, so the policy no longer advertises a capability the site does not use.
The decision is written down in `BVO_TYPOGRAPHY_DECISION.md` — it had been made
before and came undone precisely because it never was.

**Four blocking CSS files consolidated** into `site-bundle.css`, with
`site4.css` deliberately kept out of it as admin-only.

**CSS and JS minified**, and the stylesheet cache-bust gated so a stale bundle
can't ship silently (`fbd2468`).

**Cache headers** added for CSS/JS/images via `.htaccess`.

**Two template defects that were inflating every page** — `e1a7fc2` and
`811efc8`. An HTML comment in `main.ejs` contained a live EJS tag, doubling
every page; and 19 banner comments in `index.ejs` were rendering 23 times each.
Pure byte bloat on every single request, invisible until someone read the
output rather than the source.

**Homepage queries parallelised** — `ce0c88c`. The per-slot section queries ran
in a chain; they now start together. Server time, not browser time, but it is
in front of TTFB and therefore in front of everything above.

## 3. CLS — reserve the space

**The hero box is reserved** across every breakpoint — `4ba4897`, `45ff9c9`,
`bfde140`, `248e048`, `50b9325`. Aspect-ratio on the wrapper, plus an explicit
row height in the stacked and tablet bands.

**The 1×1 GIF placeholder was removed from hero `<img>`s** — and this is the
one genuine layout shift the whole investigation found. A 1×1 placeholder gives
the element a true 1:1 *intrinsic* ratio, which outranks the `width`/`height`
attributes. Measured as a 412×412 → 412×329 jump, an 83px shift. A CSS
`aspect-ratio` fixes it; verified at 0.

**Forced reflows removed from `site.js`** — the `offsetWidth` + `resize`
pattern replaced with a `ResizeObserver`.

---

## The two things that cost the most and produced the least

### PSI's CLS 0.321 was a harness artifact

Most of 2026-09-23 went into a CLS score that was not real. Seven tools were
run against the same deployed code:

| Tool | Device | CLS |
|---|---|---|
| GTmetrix | Pixel 8/9 mobile | **0** |
| DebugBear-style | mobile | **0** |
| five others | — | **0** |
| **PSI / Lightrider** | Moto G Power, Slow 4G | **0.321** |
| **CrUX — real users** | — | **98% passing** |

Only PSI reported it, always as *exactly* `0.321`, in roughly three runs of
four. A genuine instability varies continuously with timing; a fixed value that
either appears or doesn't is deterministic to that harness. It was also
independent of load — one run had TBT 190ms with 2,004ms of Style & Layout,
another TBT 0ms on a light main thread, both `0.321`.

Five hypotheses were tested and eliminated by direct experiment, not argument,
including one deliberate diagnostic commit that was reverted the same day
(`77e467c` → `6184921`).

**The lesson, recorded in the notes as a rule:** PSI's "culprit" list is loose
attribution, not a bill of materials. It changed between runs while the score
stayed identical. Treating it as a parts list cost most of a day.

**What matters for ranking is CrUX field data, not the lab score.** Ours
passes. Do not re-open this on the strength of a PSI number alone.

### The analytics deferral was deliberately given back

`e527ee7` deferred `gtag.js` to first interaction or 3s, on a real measurement:
162KB of async script competing with the hero for bandwidth cost ~250ms of LCP
(2744 vs 2492ms median, 5 runs) plus the page's only long main-thread task
(86ms).

On 2026-09-30 that was **reverted** (`9eeebef`) — gtag loads with the page
again. Not an accident, and not a regression to fix blindly: the 250ms
described a page that no longer exists. Since that measurement the CSS was
consolidated, the srcset ladder capped, the placeholders dropped, the fonts
removed and the reflows fixed — several of which attacked the same bandwidth
contention the deferral was routing around.

**Largely settled by the 2026-10-14 run.** Performance scored **98 with gtag
loading eagerly**, so the deferral is not required to stay in the high 90s —
the bandwidth contention it was routing around was substantially removed by
the other work rather than by the loader.

What is *not* settled is the finer question: whether the ~250ms of LCP is
still individually measurable. The score is too coarse to answer that, and it
no longer matters much at 98. If LCP ever becomes the binding constraint, the
loader is in git history (`e527ee7`) and can return.

---

## Guardrails now in place

- **`gate_vendor_assets.js`** — no runtime asset may come from a third-party
  CDN. Added after cdnjs started returning 503 and blanked every analytics
  dashboard; it also keeps third-party hosts off the critical path by default.
- **Stylesheet cache-bust is gated**, so a version bump can't be forgotten.
- **An image-host gate** warns when a URL points at a host we don't control.
- **The typography decision is written down**, so it cannot quietly come undone
  a second time.

## If you want the number higher

In rough order of likely return:

At 98 the remaining headroom is small and the risk of chasing it is real — the
CLS investigation is the cautionary tale. In rough order of return:

1. **Accessibility 97** is now the lowest of the four. Likely the cheapest
   real gain on the page, and unlike performance it does not trade against
   anything.
2. **Hero image fill %** across the catalogue is still open in
   `OPEN_ITEMS.md`. Oversized heroes on *other* templates are the same class
   of defect already fixed here — this is about the rest of the site reaching
   the homepage's standard, not about pushing the homepage past 98.
3. **Re-measure after any change to the critical path**, and record it here.
   The score sat unrecorded for three weeks; that is how the typography
   decision got lost the first time.
