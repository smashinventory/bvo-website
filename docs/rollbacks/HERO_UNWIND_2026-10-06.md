# Hero — unwind notes before the 2026-10-06 repair work

> Written BEFORE any change, at Sam's instruction: *"create a detailed set of
> notes for unwinding as the current state is excellent."* Everything below is
> the state as it stands at commit **e069f98**, verified against the live site,
> not read off the defaults file. Where the live value and the defaults file
> disagree, the live value is recorded and the disagreement is called out —
> because that disagreement is itself the thing most likely to bite during an
> unwind.

Companion to `HERO_CURRENT_STATE_2026-09-13.md`, which covers the earlier
rebuild. That document is still accurate for structure and breakpoints; this one
covers settings wiring and the repair work about to start.

---

## 0. The one-line undo

```bash
git revert --no-edit <the repair commit>
```

Nothing in the planned work touches the database, the filter pipeline, or any
other section. The blast radius is three files:
`src/services/themeSettings.js`, `views/pages/index.ejs`,
`views/pages/admin/theme.ejs`, plus CSS. A revert restores everything.

**The settings FILE is a separate matter.** `data/theme_settings.json` on the
server holds live values that are NOT in git. A code revert does not touch it,
which is correct — but see section 4 before changing any default, because since
2026-10-06 that file stores only values that DIFFER from the defaults.

---

## 1. Live rendered state, captured 2026-10-06

The hero as it actually renders on the homepage right now.

```
<section id="hero-main"
  class="hero hero--bg hero--no-mobile-video hero--has-mobile-img hero--text-shadow"
  style="--ov-clr:#ffffff;--ov-op:0.00;min-height:300px;max-height:620px;
         --hero-eyebrow:#5A7A5A;--hero-h1:#182840;--hero-h2:#926A21;
         --hero-sub:#182840;--hero-sub2:#926A21;
         --content-box-bg:rgba(255,255,255,0.70);--content-box-pad:12px;
         --content-box-radius:6px;--content-max-w:320px;
         --content-v-offset:4%;--content-h-offset:3%;">
```

Content, in DOM order inside `.hero-content-box`:

| element | text |
|---|---|
| `p.hero-eyebrow` | Curated for Your Bath Renovation |
| **`h1.hero-h1`** | Bathroom Vanities Outlet |
| `p.hero-h2` | Premium Quality at Outlet Prices |
| `div.hero-rule` | — |
| `p.hero-sub` | Top brands, delivered free to your door. |
| `p.hero-sub2` | James Martin · Huntington Brass · & more |

CTAs: `btn btn-navy` → `/collections/bathroom-vanities` "Shop Now", and
`btn btn-sage` → `/collections/sale` "See Deals".
Desktop image alt: `Bathroom Vanities Outlet- Premium Bath Vanity Cabinets`.

### THE LIVE VALUES ARE NOT THE DEFAULTS

This is the single most important fact in this document.

| setting | defaults file | **live** |
|---|---|---|
| `min_height_px` | 520 | **300** |
| `max_height_px` | 900 | **620** |
| `overlay_opacity` | (no default) | **0 — fully transparent** |
| `content_box_color` | `#0f1f35` navy | **#ffffff white** |
| `content_box_opacity` | 60 | **70** |
| `content_box_padding` | 36 | **12** |
| `content_max_width` | 520 | **320** |
| `content_v_offset` | 0 | **4%** |
| `content_h_offset` | 5 | **3%** |
| `heading_line1` | "Premium Vanities." | **"Bathroom Vanities Outlet"** |
| `heading_line2` | "Outlet Prices." | **"Premium Quality at Outlet Prices"** |
| `cta1_text` | "Shop Vanities" | **"Shop Now"** |
| `cta2_text` | "View Sale" | **"See Deals"** |

**If anyone "restores the hero to defaults" they will not get this hero.** They
will get a navy content box at 60% opacity, 36px padding, 520px wide, no
offsets, taller min-height, and different copy. The tuned state lives in
`data/theme_settings.json` on the server, nowhere else.

**Before touching any default, take a copy of that file.** It is the only record
of the values above.

---

## 2. Field wiring, verified with comments stripped

49 hero keys exist across the defaults, the editor and the template. **36 are
fully wired** — default + editor field + read by live code. Those are not
discussed further; they work.

### Dead control — the badge

`badge_text` has a default and an editor field and **is never read by live
code.** Type into it, save, nothing happens, no error.

* Read only by `views/pages/index-1.ejs` — a dead file, not referenced anywhere
  in `src/`.
* `badge_size` IS read by the live template (`index.ejs:479`) — a font-size for
  an element that is not rendered.
* Residual CSS survives in `site-bundle.css` and `site2.css`:

```css
.hero-badge{position:absolute;top:28px;left:28px;background:var(--sage);
  color:#fff;font-size:10px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;padding:6px 14px;border-radius:3px}
.hero-badge{top:20px;left:20px}   /* narrower breakpoint */
```

**Why it was pulled, per Sam:** alignment. The CSS above shows it — absolutely
positioned at a FIXED pixel offset from the hero's top-left corner. The hero has
two layouts, a variable height with min/max bounds, a content box with its own
v/h offsets, and a separate mobile image with its own aspect ratio. A hardcoded
`top:28px` lands somewhere different in every combination. **Any rebuild that
restores absolute positioning at fixed pixels will reproduce the original bug.**

### Eight live editor fields with NO default

All eight are read by live code and work via inline fallbacks. The editor cannot
show a true current value for them, and the defaults file does not describe the
section honestly.

| field | what the template falls back to | where |
|---|---|---|
| `heading_level` | `_safeTag(…, 'h1')` | index.ejs:456 |
| `heading_size` | no inline style → CSS `.hero-h1{font-size:2.6rem}` | index.ejs:474 |
| `subtext_size` | no inline style → CSS `.hero-sub{font-size:1rem}` | index.ejs:475 |
| `sub2_color` | no var written → CSS `--hero-sub2: rgba(255,255,255,.65)` | index.ejs:~500 |
| `overlay_color` | `'#0f1f35'` | index.ejs:485 |
| `overlay_opacity` | `'0.55'` | index.ejs:486 |
| `cta1_url` | `/collections/bathroom-vanities` | index.ejs:549 |
| `cta2_url` | `/collections/sale` | index.ejs:551 |

**Seeding these defaults must use SENTINELS, not resolved values.** The
distinction matters and is the whole risk:

* `heading_size` is read as `hero.heading_size ? 'font-size:'+x+'px' : ''`.
  Seed it `0` and it stays falsy, so the CSS rule still wins. Seed it with the
  *resolved* 2.6rem as 42px and you have REPLACED a responsive CSS rule with a
  fixed pixel size. Same for `subtext_size`.
* `heading_level` seeds `'h1'`, `cta1_url` / `cta2_url` seed the paths already
  rendering. Identical output either way.

### CORRECTION — these fields are NOT all absent from the settings file

An earlier draft of this document said the eight are absent from
`data/theme_settings.json`. That was read off the LOCAL copy of that file,
which is stale. The same mistake was made with `og_image_alt` earlier the same
day. **The local settings file is not the server's.**

The live render disproves it. From the inline style captured in section 1:

```
--ov-clr:#ffffff    --ov-op:0.00    --hero-sub2:#926A21
```

So `overlay_color`, `overlay_opacity` and `sub2_color` ARE set on the server —
to white, zero and gold respectively. Whatever default is added for those three
is irrelevant; the stored value wins and the page cannot move.

| field | live evidence | stored on server? | safe default |
|---|---|---|---|
| `overlay_color` | `--ov-clr:#ffffff` | yes | `'#0f1f35'` (overridden) |
| `overlay_opacity` | `--ov-op:0.00` | yes | `55` (overridden) |
| `sub2_color` | `--hero-sub2:#926A21` | yes | `''` (overridden) |
| `heading_size` | no inline font-size | no | **`0`** sentinel |
| `subtext_size` | no inline font-size | no | **`0`** sentinel |
| `heading_level` | renders `<h1>` | unknown, same either way | `'h1'` |
| `cta1_url` | `/collections/bathroom-vanities` | unknown, same either way | that path |
| `cta2_url` | `/collections/sale` | unknown, same either way | that path |

**Derive from the live render, never from the local settings file.**

### RULE — enabling a read publishes whatever is stored

Raised by Sam before any code was written, and it is a real hazard here.
`badge_text` is stored as `'Free Shipping'`. It has been dormant only because
nothing reads it. The moment the badge renders, that value publishes itself to
the live homepage unasked.

> **Before wiring a field that nothing currently reads, check what is stored for
> it.** An orphaned field is not an empty field — it may carry a value from
> before it was orphaned. Enabling the read publishes that value.
> **New output ships OFF.**

Hence `badge_enabled: false`. The capability exists, the stored text is
preserved, nothing renders until it is deliberately switched on. Enabling a
capability and enabling its output are two different decisions.

The distinction Sam drew is worth keeping: something *appearing* is additive
and obvious; something *replacing* existing content is silent and far worse.
The seeding rules above exist to make sure nothing in this work replaces
anything.

### One orphan

`hero.max_width` — in the defaults, no editor field, never read. Dead in all
three directions.

### A ghost that is NOT a bug — do not "fix" it

`hero.text_align_mobile` appears in both `index.ejs` and `theme.ejs`, but **only
inside comments.** It was retired on 2026-09-23 and replaced by
`hero_mobile.text_align`. The retirement comment at `index.ejs:~945` explains
why, and it is worth reading before anyone reinstates it:

> `.hero-content` carries an INLINE `style="text-align:left"`, and an inline
> declaration beats any stylesheet rule that is not `!important` — so the copy
> stayed left while `.hero-ctas`, which has no inline style, centred. Text left,
> buttons centred, on every phone.

An earlier pass of this audit counted it as a live field missing a default,
because the regex matched the comment. It is correctly retired. **Adding a
default for it would resurrect a known-broken control.**

---

## 3. The auto/manual model agreed before any code

Agreed with Sam 2026-10-06, to govern this and every later section:

1. **Toggle, don't replace.** A new control gets an auto/manual switch. Auto
   keeps the existing tuned behavior; manual is opt-in.
2. **Preload with reality.** A new field opens showing what the site renders
   today, never blank, never a generic default.
3. **Lossless round trip.** Auto shows the computed reality, greyed and
   disabled. Manual shows the stored manual value, editable. Toggling back to
   auto KEEPS that value — remembered, ignored. Sale settings survive from one
   season to the next.
4. **Disabled inputs do not post.** The server owns the stored value and must
   never infer "absent from the form" as "cleared." Getting this wrong wipes the
   remembered values on every save while in auto.
5. **Toggles govern groups**, and the group's contents are listed beside the
   toggle so flipping has no surprises.

Groups agreed for the hero: Layout & Sizing, Typography, Image & Media, Content
Box, and Badge once rebuilt.

**Substitutable vs not.** For colors, sizes, text and box geometry, manual
preloads with the real value and the round trip is exact. For `height_vh`,
`min_height_px`, `max_height_px`, `text_col_pct` and `layout`, the current
behavior is a responsive ladder with breakpoint-dependent clamps — no single
number represents it. Manual there is a deliberate downgrade for a period, and
the UI must say so rather than display a fake number.

**The existing sentinel pattern already implements rule 1 implicitly:**
`'' = CSS default`, `0 = no override`. New work extends that pattern; it does
not introduce a second mechanism.

---

## 4. Interaction with the settings-storage change from earlier today

Commit `dcb2d15` changed `themeSettings.save()` to write only values that DIFFER
from the defaults. That has a direct consequence for this work:

**Changing a default now changes the live site for any key the server file does
not explicitly carry.** Before that commit a fat settings file shadowed every
default, so editing a default was inert. It is no longer inert.

So for the eight fields above: they are absent from the server file, so they will
pick up whatever default is added. That is exactly why section 2 records the real
fallback values — seed them with those and the page does not move.

---

## 5. Verification — what must be identical after the repair

Re-capture and diff against section 1:

1. `#hero-main` class list, unchanged.
2. The inline `style` string on `#hero-main`, unchanged — every custom property
   and both height bounds.
3. The six copy elements, same tags, same classes, same order, same text.
4. `h1` is still the heading tag, and there is still exactly ONE `h1` on the page.
5. Both CTAs: same classes, same hrefs, same labels.
6. Desktop and mobile image `src` and `alt`, unchanged.
7. At 375px: copy and buttons both aligned the same way — the failure the
   retired `text_align_mobile` caused.

Gates that must stay green: the full suite, currently 52, with the three known
reds (`gate_canonical_host_live`, `gate_model_card_scope_live` — both network —
and `gate_consent_checkboxes`, pre-existing).

---

## 6. If it goes wrong

1. `git revert` the commit. Three files, no migration, no data change.
2. If the settings file was touched, restore the copy taken in section 1.
3. If only the badge is wrong, the badge is self-contained: remove its render
   block from `index.ejs` and its panel from `theme.ejs`; nothing else reads it.
4. The nuclear option is unchanged from the 2026-09-13 notes: the hero is one
   `<section id="hero-main">` in `index.ejs` plus `.hero*` rules in the CSS. It
   does not share markup with any other section.
