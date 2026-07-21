# BVO Node.js — Session Rules (Auto-loaded by Claude)

> **READ THIS FIRST every session.** Also read:
> - `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO_AUDIT_BRIEF.md` — full rules & architecture
> - `/Users/user/Desktop/ShopPro Project/OnlineSmartPOS/BVO Node.js/CHANGE_LOG_BRIEF.md` — recent changes

---

## ⛔ NON-NEGOTIABLE PROCESS RULES

1. **Never make a code change before the user approves it.** Present what you plan to do and wait for explicit "go ahead / yes / proceed."
2. **Never assume what the user wants.** Ask. Do not infer intent from prior sessions or partial context.
3. **Always provide git push commands** in a copyable code block. Never push silently.
4. **Scope discipline** — only touch files required by the current task. Do not "improve" adjacent code while fixing something else.
5. **Bump `?v=N`** on `/css/site2.css` in `views/layouts/main.ejs` every time any CSS changes. Hostinger CDN caches aggressively. Current version: `v13`.

---

## ⛔ PERMANENT DESIGN RULES

### Rule 13 — Size Chips & Color Swatches (Universal)

Size chips and color swatches are **identical on ALL card types**:
- Collection product cards
- Model-group / vanity-model cards
- Homepage featured product cards
- Homepage carousel cards

**Layout (required everywhere):**
```
[FINISHES: label]  [● swatch] [● swatch] …
[SIZES: label]     [30] [36] [42] …
                   [ CTA button ]
```

**Locked CSS values (site2.css):**

| Rule | Value |
|---|---|
| Both labels font-size | `.68rem` |
| Both labels font-weight | `600` |
| Both labels min-width | `5rem` |
| Both labels color | `#9CA3AF` |
| Both labels text-transform | `uppercase` |
| Swatches row gap | `.35rem` |
| Swatches row margin-bottom | `.5rem` |
| First swatch margin-left | `-.5rem` (shifts swatches toward label) |
| Sizes row gap | `.35rem` |
| Sizes row margin-bottom | `.5rem` (space before CTA) |
| Size chip container margin-left | `-.55rem` (shifts chips toward label) |
| Size chip padding | `.13rem` (all sides) |
| Size chip font-size | `.68rem` |
| Size chip border-radius | `3px` |

**EJS rules:**
- `FINISHES:` and `SIZES:` labels are **always present** — never remove them
- Size chip button visible text: **no `"` inch mark**. Inch mark goes in `aria-label`/`title` only. **Exception: mega-menu nav size chips (`header.ejs` line 64) intentionally keep the `"` in visible text.**
- **No chip cap** — show all sizes, no `+N more` overflow
- Size values must be `{label, key}` objects from `SIZE_BUCKETS` — never render raw `width_in`

---

## Architecture Quick Reference

| Concern | Location |
|---|---|
| Category slug canon | `BVO_AUDIT_BRIEF.md` Rule 12 |
| SIZE_BUCKETS | `src/config/sizeBuckets.js` |
| Color families + normalize() | `src/config/colorFamilies.js` |
| Collections controller | `src/controllers/collectionsController.js` |
| Home controller | `src/controllers/homeController.js` |
| Category model (findBySlug) | `src/models/Category.js` |
| CSS (all new rules go here) | `public/css/site2.css` |
| CSS cache bust link | `views/layouts/main.ejs` (bump `?v=N`) |
| rflposSync CAT_MAP | `src/services/rflposSync.js` lines 50-53 — maps to `bathroom-vanities` NOT `vanities` |

## Known Pending Issues (as of 2026-07-21)

- **rflposSync CAT_MAP** still maps vanity product types to slug `'vanities'` (retired). Must change to `'bathroom-vanities'`. See `src/services/rflposSync.js` lines 50–53.
- **vanity-models collection shows 0 results** — model-group query filters by `category.id` (vanity-models ID) but products live in `bathroom-vanities`. Fix pending user decision: remove category filter (Option A) or look up bathroom-vanities by slug (Option B).
- **header.ejs mega menu size chips** — still render `"` inch mark in visible text (line 64). Separate fix needed.
- **Task #12** — nested form bug on category-edit admin page. Committed as `e2840b6`, push verification pending.
