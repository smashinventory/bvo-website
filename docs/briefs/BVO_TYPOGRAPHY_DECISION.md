# BVO Typography — the decision, and why it keeps coming undone

**Decided 2026-09-24 by Sam. Status: settled.**

    Headings   Georgia
    Body       System UI

**The storefront downloads no font files, and no option exists that would
make it.** That is the point of the decision, not a side effect of it.

## The rule, in Sam's words

> "I do not want to leave the ability for a future admin to unknowingly add
> fonts that negatively impact loading speed and LCP/FCP. I want only fast
> loading ubiquitous font options to be presented as font options in the
> theme editor. We should have good options available, but not have access
> to heavy destructive ones."

This is stronger than a default. The first pass at this change kept Google
Fonts selectable on the reasoning that removing a Theme Editor control would
be a hardcoded override — that was **my inference and it was wrong**. The
rule is about the *options*, not the default: a future admin should not be
able to make a bad choice, so bad choices are not offered.

There are nine faces available, all instant. Nothing is taken away except
the ability to slow the site down by accident.

---

## Read this before changing a font anywhere

This decision had been made before — Sam remembered making it — and it came
undone anyway, because **it was never written down**. On 2026-09-24 a search
of the whole `docs/` tree found no typography decision of any kind. Every
`Georgia` in the docs was the US state, in the policy files.

So the site was serving Lora + Lato from Google while the owner believed it
was serving system fonts. Nobody did anything wrong; there was simply nothing
to check against. That is what this file is for.

If you are about to change `heading_font` or `body_font`, or add a webfont,
or "optimise" the font loading — read the next section first. The reasoning
is not obvious, and the obvious reasoning is out of date.

---

## Why not Google Fonts

The original argument for Google Fonts was sound when it was made: popular
families are used by so many sites that a visitor would already hold the
files in cache, so the download was usually free.

**That stopped being true in 2020.** Browsers partitioned the HTTP cache by
origin — Chrome, Safari and Firefox all did it, to close a privacy leak where
a site could detect what you had cached and infer where you had been. A font
fetched on some other site is now stored under *that site's* key and is
invisible to ours.

The practical consequence: **every first-time visitor pays the full DNS + TLS
+ download**, no matter how popular the family is elsewhere. The strategy did
not stop working gradually. It stopped working, and the reasoning behind it
quietly became false while the configuration stayed the same.

What it was costing BVO, measured on the live site 2026-09-24, mobile 375x812:

| | |
|---|---|
| Font faces downloaded | 6 — Lato 400/700/400i, Lora 400/600/700 |
| Third-party origins | 2 — `fonts.googleapis.com`, `fonts.gstatic.com` |
| Font CSS fetch | 146 ms |
| Priority | **high** — by design, so it competes with the hero LCP image |

One correction worth recording, because it was stated wrongly during the
session and acted on: **the font CSS was never render-blocking.** It used
`rel=preload` plus a nonced swap, and there is a documented A/B in
`views/layouts/main.ejs` showing that was deliberately chosen over
`media=print` (font CSS arrived ~310 ms vs ~1,280 ms). The claim that it
blocked first paint came from a regex that matched a `<link rel=stylesheet>`
inside a `<noscript>` fallback. The real cost is bandwidth contention with
the LCP image on slow connections, plus the third-party round trips — an LCP
cost, not an FCP one, and smaller than first claimed.

---

## Why Georgia + system-ui specifically

Because they are already on the device, and because Sam compared them
directly against Lora + Lato rendered at the real hero sizes and judged the
difference acceptable.

Measured width at the actual hero type sizes:

| line | Lora / Lato | Georgia / system-ui | change |
|---|---|---|---|
| "Premium Bath Vanities." (23px) | 259.5px | 284.2px | +9.5% |
| "Outlet Prices." (41px) | 259.7px | 244.9px | −5.7% |
| body line (16px) | 272.3px | 285.5px | +4.8% |

Notes that matter if the design is revisited:

- The body change is small. Lato and system-ui are close enough that the swap
  is hard to spot, and that is most of the words on the site.
- The headings are where it shows, and **not uniformly**. The h1 gets ~10%
  wider while the h2 gets narrower, because Georgia's lowercase is shorter
  relative to its caps. The two headline lines used to be near-identical in
  width, which gave the stacked hero a deliberate look; in Georgia that
  balance shifts.
- Nothing rewraps. The mobile content box is 320px and the widest line lands
  at 284px.
- Character: Lora is more contemporary and slightly condensed. Georgia is
  warmer, more traditional, chunkier serifs, old-style numerals.

---

## The options

All nine live in **`src/utils/fontStacks.js`** — one list, no duplicates.
The stored setting is a *key*; the CSS stack is looked up. That matters
because the good cross-platform choices are not single families: Palatino
ships under three different names across macOS, Windows and Linux, and
naming only one of them silently falls back to Times on the other two.

| | Serif | Sans-serif |
|---|---|---|
| | Georgia *(default)* | System UI *(default)* |
| | Palatino | Helvetica / Arial |
| | Times New Roman | Verdana |
| | System serif | Tahoma |
| | | Trebuchet MS |

Either list can be used for either role — a sans heading is a legitimate
design choice; `kind` only groups the dropdown.

## How it is enforced in code

| Where | What it does |
|---|---|
| `src/utils/fontStacks.js` | **the allow-list and the resolver.** The single source of truth |
| `src/server.js` | exposes it as `res.locals.fontStacks`, the same pattern as `ownedImageHosts` |
| `src/services/themeSettings.js` | `design.heading_font` / `design.body_font` defaults |
| `data/theme_settings.json` | the live saved value — **gitignored** (`.gitignore` line 12), so it is not in the repo and no deploy can change it. The copy on the server still says `Lora`/`Lato` and will keep saying so until someone saves the Theme Editor. That is harmless *only* because `resolve()` neutralises it |
| `views/layouts/main.ejs` | calls `resolve()`. No Google Fonts URL, no preconnects, no preload, no swap script — all removed |
| `views/pages/admin/theme.ejs` | builds both dropdowns from `CHOICES`, each option previewed in its own face |
| `public/css/brand.css`, `site-bundle.css` | `--font-serif` / `--font-sans` |
| `views/layouts/admin.ejs` | previously loaded Lora + Lato as a render-blocking stylesheet; removed |

**The resolver is the enforcement point, not the dropdown.** Restricting the
`<select>` alone would be theatre: settings also arrive from
`data/theme_settings.json` and the `app_settings` DB row, neither of which
goes through the form. `resolve()` maps anything unrecognised to the default,
so a stale `'Lora'` in saved settings renders as Georgia and *cannot* produce
a Google request. That is not hypothetical — it is exactly the state the site
was found in on 2026-09-24.

Verified:

    "Georgia"        -> Georgia, Cambria, "Times New Roman", serif
    "Palatino"       -> "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif
    "Lora"           -> Georgia, Cambria, "Times New Roman", serif     (legacy, neutralised)
    "Comic Sans MS"  -> Georgia, ...                                    (not on the list)
    "<script>"       -> Georgia, ...                                    (nothing reaches <style> verbatim)

One subtlety worth keeping, from the version of this change that kept the
family name in settings: the stack used to emit the chosen family
single-quoted, and once the body font became `system-ui`, `'system-ui'`
quoted is a family *name*, not the CSS generic keyword — it matched nothing,
and only resolved because an unquoted `system-ui` sat behind it as a
fallback. Correct by luck. Storing a key and looking up a hand-written stack
removes that whole class of problem.

---

## Adding a face

**Adding a system face** is easy and safe: one entry in `CHOICES` in
`src/utils/fontStacks.js`, with a complete stack and a one-line note. It
appears in both dropdowns automatically. Check it is genuinely ubiquitous —
name every platform variant in the stack, and end with a generic keyword.

**Adding a webfont is a deliberate act, and the Theme Editor is not where it
starts.** There is no option for it by design. If one is ever genuinely
needed:

1. Read this file, then say out loud what the download buys that nine
   instant faces do not.
2. Measure on mobile, cold cache, throttled. Warm-cache numbers are
   worthless here — that lesson cost most of 2026-09-23.
3. **Self-host it.** Same look, no third-party DNS/TLS, no cache
   partitioning problem, and the font actually arrives instead of being
   dropped by `display=optional` on a slow connection. Do not reintroduce
   `fonts.googleapis.com`.
4. Reserve the layout for it. A face that swaps in late moves text, which is
   the CLS family of bug that ate 2026-09-23.
5. Update this file with what changed and why. If the next person cannot
   find the reasoning, the decision comes undone again — which is exactly
   how we got here the first time.
