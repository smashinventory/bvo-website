# One-off patterns in the homepage sections

Catalogue, 2026-10-05. Written because the owner asked why each new
section arrives with its own way of doing a thing that already has a
shared helper — and he was right to ask. This is the inventory.

Scope: `views/pages/index.ejs`, the 17 homepage sections. Nothing here is
changed by writing it down; the Fix column is a proposal, not a record.

**The pattern in the pattern:** in every case below a shared helper
*exists and works*. The duplication is not from an absent abstraction.
It is from the sections having been built one at a time, with each new
one copied from whichever section was nearest rather than from the
helper. That is a process failure, and it is why a gate — not a tidy-up —
is the thing that actually stops it.

---

## 1. Alignment is handled TWICE, ten different ways

`_sectionFrame(d)` already emits `text-align` onto a wrapper div around
**every** section, from `d.text_align`. That is the shared mechanism and
it has worked since `bcd2863`.

Ten sections *also* read `text_align` themselves, each with its own
default and its own validation idiom:

| Section | Reads | Default | Validation |
|---|---|---|---|
| `hero` | `hero.text_align` | settings | `_safeAlign()` |
| `categories_section` | `_d.text_align` | `'center'` | none |
| `featured_section` | `_d.text_align` | `'center'` | none |
| `featured_models` | `_d.text_align` | `'center'` | none |
| `image_with_text` | `_d.text_align` | `'left'` | none |
| `before_after` | `_d.text_align` | `'center'` | none |
| `parallax` | `_d.text_align` | `'center'` | none |
| `testimonials` | `_d.text_align` | `'center'` | none |
| `newsletter` | `news.text_align` | `'center'` | none |
| `sample_banner` | `sb_.text_align` | `'center'` | `_SB_ALIGN{}` |

So: **four** validation idioms (`_SEC_ALIGN` in the frame, `_safeAlign`,
`_SB_ALIGN`, and none at all) and **two** defaults for the same control.
A section with no own handling inherits the frame's; a section with both
gets the frame's on the wrapper and its own inside, which is why the
`sample_banner` alignment appeared half-broken for three attempts.

**Fix:** one `_align(d)` helper returning a validated keyword, called by
the frame and by any section needing the value inline. Delete the ten
locals. Gate: no section may read `.text_align` directly.

**Risk:** touches every section. The defaults genuinely differ
(`image_with_text` is `left`, the rest `center`), so this cannot be done
without deciding whether that difference is intentional. Not a tidy-up —
schedule it on its own.

---

## 2. `_btnClass` exists and ONE section uses it

`_btnClass(v)` validates a button style and falls back to the hero's
primary. It was added when the samples banner shipped an amber button
under two navy hero buttons.

Seven sections still hardcode `class="btn btn-navy"` / `btn-amber`:
`hero`, `featured_section`, `featured_models`, `image_with_text`,
`video_text`, `parallax`, `bundle_teaser`.

So the helper's promise — that the hero's primary is the single source of
the default — is false in practice. Change the hero's button and seven
sections ignore it.

**Fix:** route all seven through `_btnClass`. Low risk: the helper
returns the same class each currently hardcodes, so it is a provable
no-op per section. Gate: no `class="btn btn-…"` literal in a section
block.

---

## 3. Colour validation reaches 3 of 17 sections

`_cssColor(v)` whitelists hex / rgb / hsl / keyword and returns `''` for
anything else. It exists because `trust_band`'s colour controls were
silently broken in production (built with `<%=`, so quotes became
`&#34;`), and because the fix — the raw tag — is attribute injection
without a validator.

Used by: `value_bar`, `trust_band`, `sample_banner`.
**Not** used by, and concatenating owner input into a style attribute raw:

- `scrolling_ticker` — `'background:' + tick.bg_color`
- `hero` — `'--hero-sub:' + hero.subtext_color`, and the same for `_hm`

These are admin-only inputs, so the exposure is low — but it is the exact
shape of the bug that already shipped once, and the fix is three lines.

**Fix:** wrap both in `_cssColor`. Gate: extend the existing
`gate_section_controls` injection cases to every colour field.
**Priority: highest in this document** — smallest change, known-real bug class.

---

## 4. Mobile alignment has no shared answer at all

Three mechanisms exist for "this should look different on a phone":

1. **`hero`** — a scoped `<style>` block, `@media (max-width:860px)`,
   `text-align:…!important`. The `!important` is load-bearing: it exists
   to beat the *inline* `text-align` on `.hero-content`.
2. **`hero_mobile`** — an entire duplicate section with its own settings.
3. **`sample_banner`** (added today) — alignment carried as `--sb-*`
   custom properties read only inside `@media (min-width:861px)`, with no
   inline styles so no `!important` is needed.

Mechanism 3 is a near-relative of `hero.text_align_mobile`, which wrote
`--hero-mobile-align` and **was retired on 2026-09-23** for losing to an
inline style. It is worth being precise about why today's version is not
the same mistake: the retired one left the inline styles in place and
tried to override them, which cannot work. Today's removes them, which is
the part that makes a media query possible at all. Same tool, opposite
situation.

What was still wrong with it, and is now fixed: it used a 769px
breakpoint. **The site's band edge is 860/861px** — every other
responsive rule in `site.css` uses it, and the hero's mobile alignment
specifically widened from 480 to 860 to cover tablets. A banner switching
at 769 would have disagreed with the hero on every iPad.

**Fix:** none proposed yet — this needs a decision, not a refactor.
Either every section gets a mobile alignment variant, or the rule becomes
"stacked layouts centre, full stop" and lives in the shared frame. Worth
settling before the next section is built.

---

## 5. `_safeTag` — 11 of 17, and the gaps are mostly fine

`featured_models`, `brand_logos`, `inspiration`, `scrolling_ticker`,
`value_bar`, `trust_band` do not call it. Most have no owner-editable
heading, so there is nothing to validate. `featured_models` does and
should be checked.

**Fix:** audit `featured_models` only.

---

## Order of work, if this gets scheduled

1. **§3 colour validation** — 3 lines, closes a bug class that already shipped.
2. **§2 `_btnClass`** — provable no-op per section, makes the helper's promise true.
3. **§4 mobile alignment** — needs a product decision first.
4. **§1 alignment** — the big one. Touches all 17; do it alone, with the
   defaults question settled up front.

None of this is urgent and none of it is user-visible today. It is listed
so the next section gets built from the helpers instead of from its
neighbour.


---

## Heading levels on homepage sections — reversed 2026-10-05

`heading_level` was set to `'p'` on four homepage sections on 2026-10-03,
with the stated reasoning: *"a heading should name a topic the page can
rank for; a section label does not."*

**Reversed to `h2` on 2026-10-05**, owner's decision, for a reason the
original note did not weigh.

**The SEO argument is close to a non-factor in either direction.** Google
does not rank a homepage because its section labels are `h2`, and does not
penalise them for being `h2`. The original reasoning conflates two jobs:
headings mark **document structure**; keyword targeting is what the title,
`h1` and body copy do. A section heading that targets no keyword is still
doing its own job.

**The argument that decided it is accessibility.** Screen-reader users
navigate by heading — jumping `h2` to `h2` is the primary way they skim a
page. A homepage with one `h1` and no `h2`s gives them nothing to jump
between; they arrow through every element in order. That is a real cost to
real users, and it outweighs a negligible ranking difference.

Changed: `bundle_teaser`, `before_after`, `video_text`, `sample_banner`.
Not changed: the value bar and trust band, which are decorative strips
with no real heading.

**One inconsistency fixed at the same time.** `video_text` defaulted to
`'p'` while `video_text_2` — a duplicate of the same section — defaulted
to `'h2'`. Duplicating that section silently changed its heading level.
Both are `h2` now, and `gate_author_byline` asserts they agree.

It stays a per-section Theme Editor control, so this is a default, not a
rule. It looks identical on screen either way.

**Why this is written down at all:** the typography decision came undone
because it was made and never recorded. This one reverses a decision that
*was* recorded, which means the note has to say what changed and why —
otherwise the next person flips it back on the original reasoning.
