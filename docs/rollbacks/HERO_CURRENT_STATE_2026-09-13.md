# Hero — state of play before the duplicate-`<h1>` fix

> State of the hero before the duplicate-h1 fix, so it can be restored exactly.

**Written 2026-09-13, before any edit.** Purpose: if the rebuild goes wrong,
this is enough to put everything back without archaeology, and enough to
understand *why* it was built this way before deciding to build it differently.

Revert point:

```
216415a066be1f7311e5a300506d5d9d83c83edb   "footer links: Menu Manager is the only source"
```

```bash
# Undo the hero work entirely, keep everything before it:
git revert --no-commit <hero-commit-sha>
# or, if it has not been pushed yet:
git checkout 216415a -- views/pages/index.ejs public/css/site2.css public/css/site4.css public/css/site-bundle.css
```

No database change is involved, so a revert is code-only. `hero_mobile` is not
present in `data/theme_settings.json` at all (see §5), so there is no stored
configuration that a revert could strand.

---

## 1. What renders today

The homepage emits **two** `<section class="hero">` elements, one after the
other, both inside the same `sectionKey === 'hero'` block:

| | Desktop hero | Mobile hero |
|---|---|---|
| `views/pages/index.ejs` | lines **128–231** | lines **233–338** |
| Section class | `hero hero--{layout} hero--desktop-version` | `hero hero--{layout} hero--mobile-version` |
| `data-section` | `hero` | `hero_mobile` |
| Guard | `sectionKey === 'hero'` (line 129) | `_hmEna` (line 293) |
| Heading tag | `_safeTag(hero.heading_level, 'h1')` → **h1** | `_safeTag(_hm.heading_level, 'h1')` → **h1** |
| Heading text | `hero.heading_line1` \|\| `'Premium Vanities.'` | `_hm.heading_line1` \|\| `hero.heading_line1` \|\| `'Premium Vanities.'` |

Both are always in the DOM. Neither is conditional on viewport — only CSS
hides one. **That is the bug**: two `<h1>` elements carrying the same string,
one of them `display:none`.

Line **340–358** is the value-prop bar, and line **359** closes the hero
block: `<% } /* end hero */ %>`.

## 2. Structural surprise worth knowing

`hero_mobile` **is** listed in `_DEFAULT_ORDER` (index.ejs line 65) and in
`_STATIC_KEYS` in the Theme Editor — but there is **no**
`if (sectionKey === 'hero_mobile')` branch anywhere in `index.ejs`. The only
`sectionKey === 'hero'` test is line 129.

So when the section loop reaches the `hero_mobile` slot it matches nothing and
renders an empty string. The mobile hero is emitted during the **`hero`** pass,
not its own.

Consequences, both live today:

- The `show_on` visibility wrapper (`sec--desktop-only` / `sec--mobile-only`,
  index.ejs lines 103–108) is applied to the `hero_mobile` slot, which renders
  nothing. Setting "Visible on" for the mobile hero does nothing at all.
- Drag-reordering the mobile hero in the Theme Editor does nothing. It is
  pinned directly after the desktop hero by markup order.

Neither is what the editor implies. Not in scope for this change; recorded so
the next person does not treat it as a new bug.

## 3. Visibility — four different breakpoints

This is the part most likely to bite during the rebuild. The switch is not one
breakpoint; it is four, and they do not line up.

| Rule | Breakpoint | File |
|---|---|---|
| `.hero--desktop-version{display:none}` | `max-width:480px` | site2.css, site-bundle.css |
| `.hero--mobile-version{display:none}` | `min-width:481px` | site2.css, site-bundle.css |
| `.hero--bg` mobile layout rules | `max-width:519px` | site2.css |
| `.hero--bg{min-height:70vh}`, content-box rules | `max-width:720px` | site2.css |
| `.hero--no-mobile-video`, `.sec--desktop-only` | `max-width:860px` | site4.css, site-bundle.css |
| `.hero-img-mobile{display:block}` | inside the `860px` block | site4.css, site-bundle.css |

The hero swap happens at **480/481**. The mobile *styling* starts at **519**.
So between **481px and 519px** the desktop hero is showing with desktop layout
rules, and between 481 and 720 it picks up some mobile content-box styling.
Any rebuild must preserve behaviour at **375, 479, 481, 519, 720, 860 and
1440** — testing only "phone and desktop" will miss the 481–519 band.

Both files carry the same rules because `site-bundle.css` is the concatenated
build. **Edit both, or the change lands only on pages using one of them.**

## 4. Layout is CSS, not markup — verified

`layout` is `split` or `bg`, per viewport. Both produce **identical DOM**:
`.hero-content` + `.hero-image` inside the section. Only the class and an
inline `grid-template-columns` differ:

```
@media (max-width:519px){
  .hero--bg              { grid-template-columns:1fr!important; grid-template-rows:1fr }
  .hero--bg .hero-content{ grid-row:1; grid-column:1; position:relative; z-index:2 }
  .hero--bg .hero-image  { grid-row:1; grid-column:1; position:absolute; inset:0; z-index:0 }
}
```

`split` places the two children side by side via
`grid-template-columns:{text}% {img}%` (index.ejs line 148); `bg` stacks them
in one cell. Same elements, different placement.

**This is what makes the fix possible.** A single section can be `split` at
desktop width and `bg` at phone width by media query alone. If layout had
needed different markup the whole approach would have failed — that was the
open question, and the answer is no.

Both layouts auto-switch to `bg` when a video is set (lines 141 and 280).

### CORRECTION, added after the rebuild — layout is not cosmetic at phone width

While building I claimed the two layouts render identically below 860px and
that the phone `layout` value could therefore be dropped. **That was wrong**,
and it would have shipped a visible regression.

It is true of `.hero-image`. It is false of `.hero-content`, which is the half
I did not look at:

```
@media (max-width:519px)   .hero--bg .hero-content   { display:flex; align-items:center;
                             justify-content:flex-start; padding:0 5% 0 var(--content-h-offset,5%) }
@media (max-width:860px)   .hero--split .hero-content{ justify-content:flex-end!important;
                             padding-bottom:56px!important }
```

`bg` centres the copy over the image; `split` pushes it to the bottom with
56px of padding. The live site is desktop-`split` / phone-`bg`, so dropping
the phone layout would have dumped the phone hero copy at the bottom of the
image.

Caught by rendering both versions and diffing the output. Reading the CSS
produced the wrong answer twice. The rebuild emits an explicit layout
emulation block for this, guarded by
`_hmLayout === 'bg' && _heroLayout !== 'bg'`.

## 5. Settings — what exists, what the editor can reach

`hero_mobile` **is absent from `data/theme_settings.json`**. It runs entirely
on the defaults in `src/services/themeSettings.js` line 147. Nobody has ever
configured it.

### Fields the mobile panel actually exposes
`views/pages/admin/theme.ejs`, panel `#panel-hero_mobile` (line 997):

```
enabled · image_url · image_alt · video_url · layout · text_align
height_vh · min_height_px · max_height_px
overlay_color · overlay_opacity
content_box_color · content_box_opacity · content_max_width
```

**All fourteen are styling. None is text.**

### Fields in the defaults that no editor field can set
`heading_level · heading_line1 · heading_line2 · heading_size · eyebrow ·
eyebrow_size · subtext · subtext_size · sub2_text · sub2_size · badge_text ·
badge_size · cta1_text · cta1_url · cta2_text · cta2_url ·
eyebrow_color · heading_color · h2_color · subtext_color · sub2_color ·
text_col_pct · content_box_padding · content_box_radius ·
content_v_offset · content_h_offset · text_shadow`

These are reachable only by hand-editing JSON. This is the same shape as the
footer `col_*_links` removed earlier today: config that exists, that nothing
can set, that a reader would mistake for live capability.

### Text fallback chain (index.ejs 281–291)
Every mobile text value falls back to its desktop counterpart when blank:

```js
var _hmH1 = _hm.heading_line1 || hero.heading_line1 || 'Premium Vanities.';
```

With nothing configured, **every text field on the mobile hero resolves to the
desktop value**. The two `<h1>`s are identical by construction, not by
accident.

## 6. The desktop hero already does per-viewport images

Independently of `hero_mobile`, the **desktop** hero supports a separate phone
image (index.ejs 191–205):

```
hero.image_url        → <img class="hero-poster hero-img-desktop">
hero.mobile_image_url → <img class="hero-img-mobile">
```

`.hero-img-mobile` is `display:none` until the `max-width:860px` block flips it
to `display:block`. The `hero--has-mobile-img` class on the section drives the
swap.

So "a different image on small screens" is available in **two** places. That
redundancy is the root of the duplication.

## 7. What the rebuild must preserve

Acceptance criteria. Anything here that regresses means revert.

1. Separate **desktop and mobile background images** — still settable, still
   swap at the same width.
2. Separate **desktop and mobile video**, including the `video_on_mobile`
   suppression at 860px.
3. Per-viewport **overlay colour and opacity**.
4. Per-viewport **height** — `height_vh`, `min_height_px`, `max_height_px`.
5. Per-viewport **text alignment** and **content-box** colour, opacity and
   max-width.
6. Per-viewport **layout** — `split` or `bg`.
7. The Theme Editor panels **unchanged**. Same fields, same places.
8. Exactly **one `<h1>`** in the rendered HTML, and it must **not** be inside
   anything hidden at the viewport being rendered.
9. No visual change at **375, 479, 481, 519, 720, 860, 1440**.

## 8. What changes

The text is written to the page once instead of twice. Since no editor field
can set mobile text, and every mobile text value currently resolves to the
desktop one, **no capability is lost** — but per-viewport hero copy becomes
impossible rather than merely unreachable. If that is ever wanted it needs a
deliberate design, not the accidental half-support that exists now.

## 9. Verification plan

- Count `<h1>` in the raw HTML at each of the seven widths — expect exactly 1.
- Confirm the surviving `<h1>` is not inside a `display:none` subtree.
- Screenshot all seven widths, before and after, and compare.
- Confirm the Theme Editor hero and hero-mobile panels still save and reload.
