# BVO — DOCUMENT INDEX

> Generated file. Do not hand-edit — run `node docs/00-start/reindex.js`.

Every document for this project. Nothing lives outside `BVO Node.js/docs/`.

**New session:** you have a summary of ONE previous thread. This is all of
them. Read what the task touches BEFORE forming a view.

**The numbered Rules (8, 9, 10, 11, 13, 14) are in**
`docs/00-start/BVO_AUDIT_BRIEF.md` — not in CLAUDE.md.

Descriptions come from each file's own `> ` line, so they cannot drift
from the document. A row flagged in the Purpose column has no such
line — add one to the top of that file, under its H1, then reindex.

---

## START HERE — read before any work

| Document | Purpose |
|---|---|
| `CLAUDE.md` (repo root) | Working rules, brand canon, process. Auto-loaded by every session. |
| `docs/00-start/BVO_AUDIT_BRIEF.md` | The numbered Rules (8, 9, 10, 11, 13, 14), architecture, the category table and the live DB inventory. Open this before any structural work. |
| `docs/00-start/OPEN_ITEMS.md` | Outstanding work, numbered. Check here before starting anything — it may already be logged. |
| `docs/00-start/PROJECT_BRIEF.md` | What BVO is, its scope and history, and the owner preferences every session should follow. |

## ARCHITECTURE — how a thing is built and why

| Document | Purpose |
|---|---|
| `docs/architecture/BVO Cart Page Analysis.md` | Cart page conversion review against industry patterns, with the changes that came out of it. |
| `docs/architecture/BVO_MODEL_BRAND_KEY_BRIEF.md` | Model-group and model-card architecture; why a model card is keyed on (model, brand) and never model alone. |
| `docs/architecture/CARD_CHANGES_2026-09-05.md` | Product card structure — badges, pricing rows, swatches and size chips. |
| `docs/architecture/SEARCH_AND_ORDERING_2026-09-06.md` | Search relevance scoring and result ordering across the storefront and admin. |
| `docs/architecture/VANITY_SIDEBAR_FILTERS.md` | Vanity collection sidebar: which filters appear, in what order, on both the grid and model-group render paths. |

## DEFINITIONS — settled meanings. Do not re-derive.

| Document | Purpose |
|---|---|
| `docs/definitions/JMV_CATALOGUE_STRUCTURE.md` | Shape of the James Martin catalogue — combos, bases, tops and the component edges between them. |
| `docs/definitions/JMV_COMBO_DEMAND_DEFINITION.md` | Estimated Combo Demand: the estimator, its joins, its four rules, and what is in and out of scope. |
| `docs/definitions/JMV_REVENUE_DEFINITION.md` | MAP revenue basis and the warranty haircut. Signed off — do not re-derive. |

## BRIEFS — feature and integration specs

| Document | Purpose |
|---|---|
| `docs/briefs/BVO_BRAND_ONBOARDING_PLAYBOOK.md` | Step-by-step playbook for adding a new brand to the catalogue. |
| `docs/briefs/BVO_ISSUE1_BRIEF.md` | Rollout log for colorFamilies.js — the colour family buckets and normalisation. |
| `docs/briefs/BVO_RFLPOS_SYNC_BRIEF.md` | Design brief for the BVO to RFLpos inventory sync. |
| `docs/briefs/HOTLINKED_IMAGES_HANDOFF.md` | Which images are still served from hosts BVO does not control. The original list of 14 is mostly closed; the problem has recurred with new entries. Cutover blocker. |
| `docs/briefs/REVERT_NOTES_2026-09-23.md` | Everything shipped today, newest first, with the exact command to undo each |
| `docs/briefs/SHIPPING_GAP_ANALYSIS.md` | Field-by-field gap analysis between the BVO shipping form and the SpeedShip API. |
| `docs/briefs/SHIPPING_WWEX_BRIEF.md` | WWEX / SpeedShip V4 integration. Read before touching wwexService, shippingController or the shipping admin views. |
| `docs/briefs/SHOPIFY_IMPORT_BRIEF.md` | Standing rules for importing the Shopify catalogue. |
| `docs/briefs/WWEX_SUPPORT_REQUEST.md` | Open integration questions raised with WWEX, and their answers. |
| `docs/briefs/james-martin-feed-analysis.md` | The JM feed: its columns, its quirks, and how each maps into the BVO schema. |
| `docs/briefs/jmv-sync-interface-note.md` | Interface contract for the JMV sync — what each side sends and expects. |

## REFERENCE — policy, legal, launch

| Document | Purpose |
|---|---|
| `docs/reference/POLICY_ANSWERS.md` | Agreed answers to the store policy questions — returns, damage, freight. |
| `docs/reference/POLICY_INTAKE_QUESTIONNAIRE.md` | The questionnaire the policy answers came from. |
| `docs/reference/PRE_LAUNCH_CHECKLIST.md` | Everything that must be true before cutover. |
| `docs/reference/TRADE_PROGRAM_SPEC.md` | Trade program: eligibility, pricing visibility rules and the gating requirement. |
| `docs/reference/VENDOR_POLICY_CONSTRAINTS.md` | What each vendor permits and forbids — the constraints our policies must sit inside. |

## AUDITS

| Document | Purpose |
|---|---|
| `docs/audits/AUDIT_2026-09-11.md` | Site audit, 11 Sept 2026 — 404s, SEO, headers, responsive review. |
| `docs/audits/BVO_SECURITY_AUDIT.md` | Security and code-quality audit of the storefront, with findings and fixes. |

## ROLLBACKS — how to undo a specific change

| Document | Purpose |
|---|---|
| `docs/rollbacks/HERO_CURRENT_STATE_2026-09-13.md` | State of the hero before the duplicate-h1 fix, so it can be restored exactly. |
| `docs/rollbacks/ROLLBACK_hero_bg_video.md` | How to undo the hero background video. |
| `docs/rollbacks/ROLLBACK_jmv_rollup_env.md` | How to undo the jmv_rollup.sh credential conversion. |
| `docs/rollbacks/ROLLBACK_product_variant_selector.md` | How to undo the product page variant selector. |

## HISTORY — what changed, when, and why

| Document | Purpose |
|---|---|
| `docs/history/CHANGE_LOG_BRIEF.md` | The running log of every change, with dates and reasons. Search here first when asking when something broke. |
| `docs/history/JOURNAL_2026-08-29.md` | Work journal, 29 Aug 2026. |
| `docs/history/VANITY_MODELS_CUTOVER_NOTES.md` | Notes from the vanity models cutover. |

---

## WHERE NEW NOTES GO

Do not create a new top-level document. Add to the one that already
governs the area:

| If it is… | It goes in |
|---|---|
| a change that was made | `docs/history/CHANGE_LOG_BRIEF.md` |
| something still outstanding | `docs/00-start/OPEN_ITEMS.md` |
| a rule or architectural decision | `docs/00-start/BVO_AUDIT_BRIEF.md` |
| how a specific feature works | the matching file in `docs/architecture/` |
| a settled definition | the matching file in `docs/definitions/` |

A genuinely new area gets a file in the right subfolder, with a `> `
description line, then `node docs/00-start/reindex.js`. You cannot
forget to index it — the index is generated from what is on disk.

## NOT HERE ON PURPOSE

Different projects, in the parent folder. Do not pull them in:

    RFLPOS_BRIEF.md   RFLPOS_SECURITY_SWEEP.md   rflpos_roadmap.md
    WEBFLOW_BUILD_SPEC.md   PNC_Authorize_Net_*.md

