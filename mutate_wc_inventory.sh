#!/usr/bin/env bash
# mutate_wc_inventory.sh — prove gate_wc_inventory.js actually catches things.
#
# A gate that has never failed is decoration. This breaks each invariant in
# turn, confirms the gate goes red, and restores the file. If any mutation
# leaves the gate GREEN, the gate is not protecting that invariant and this
# script exits non-zero.
#
# Safe: every file is backed up and restored, including on Ctrl-C.

set -uo pipefail
cd "$(dirname "$0")"

JOB=src/jobs/wcMovementRollup.js
CTRL=src/controllers/wcReportsController.js
VIEW=views/pages/admin/marketing/wc-inventory-analysis.ejs
MIG=database/migrations/030_wc_inventory_analysis.sql
CODEBOOK=src/data/wcCodebook.js
GATE="node gates/gate_wc_inventory.js"

FILES=("$JOB" "$CTRL" "$VIEW" "$MIG" "$CODEBOOK")

# ── CRASH RECOVERY ───────────────────────────────────────────────────
# The EXIT/INT/TERM trap below covers the normal ways this script ends.
# It does NOT cover SIGKILL — and on 2026-11-26 a 120-second command
# timeout killed a run mid-mutation and left DEFAULT_SCOPE = 'all' sitting
# in the committed controller. The gate caught it on the next run, but only
# because it happened to assert that exact constant; a mutation to anything
# ungated would have been committed silently.
#
# So the in-flight backup directory is recorded on disk. If this file still
# exists at startup, the previous run died without restoring, and we put the
# sources back BEFORE doing anything else. A mutation harness that can
# corrupt the tree it is testing is worse than no harness.
INFLIGHT=".mutate_wc_inflight"

if [ -f "$INFLIGHT" ]; then
  PREV=$(cat "$INFLIGHT")
  echo "  WARNING   previous run did not restore (killed?). Recovering from $PREV"
  for f in "${FILES[@]}"; do
    [ -f "$PREV/$(basename "$f")" ] && cp "$PREV/$(basename "$f")" "$f" && echo "            restored $f"
  done
  rm -rf "$PREV"; rm -f "$INFLIGHT"
  echo "            recovery done — re-check 'git diff' before trusting this run"
fi

BACKUP_DIR=$(mktemp -d)
restore() {
  for f in "${FILES[@]}"; do
    [ -f "$BACKUP_DIR/$(basename "$f")" ] && cp "$BACKUP_DIR/$(basename "$f")" "$f"
  done
  rm -rf "$BACKUP_DIR"; rm -f "$INFLIGHT"
}
trap restore EXIT INT TERM
for f in "${FILES[@]}"; do cp "$f" "$BACKUP_DIR/$(basename "$f")"; done
echo "$BACKUP_DIR" > "$INFLIGHT"

FAILED=0
pass() { echo "  CAUGHT    $1"; }
miss() { echo "  NOT CAUGHT $1"; FAILED=1; }

# mutate <label> <file> <sed-expression>
mutate() {
  local label="$1" file="$2" expr="$3"
  cp "$BACKUP_DIR/$(basename "$file")" "$file"
  # A mutation that does not apply tests NOTHING, and a harness that shrugs
  # at that reports success while protecting nothing. Treat it as a failure:
  # the pattern has drifted from the source and must be re-aimed.
  if ! perl -0pi -e "$expr" "$file" 2>/dev/null; then
    echo "  BROKEN    $label (mutation errored — re-aim the pattern)"; FAILED=1; return
  fi
  if cmp -s "$file" "$BACKUP_DIR/$(basename "$file")"; then
    echo "  BROKEN    $label (file unchanged — pattern no longer matches the source)"
    FAILED=1
    cp "$BACKUP_DIR/$(basename "$file")" "$file"; return
  fi
  if $GATE >/dev/null 2>&1; then miss "$label"; else pass "$label"; fi
  cp "$BACKUP_DIR/$(basename "$file")" "$file"
}

echo "Baseline — gate must be GREEN before mutating:"
if $GATE >/dev/null 2>&1; then
  echo "  OK        baseline green"
else
  echo "  ABORT     baseline is already red; fix the gate or the code first"
  $GATE
  exit 1
fi

echo ""
echo "Mutations:"

# 1. The 4–6x hazard: swap MAX for SUM in the dedupe.
mutate "dedupe weakened to SUM(m.demand_min)" "$CTRL" \
  's/MAX\(m\.demand_min\)/SUM(m.demand_min)/'

# 2. Dedupe key dropped — groups by date only, collapsing every model together.
mutate "base_sku removed from GROUP BY" "$CTRL" \
  's/GROUP BY m\.movement_date, d\.base_sku/GROUP BY m.movement_date/'

# 3. Feed-gap exclusion removed — invalid days counted as real zero-demand days.
mutate "is_valid filter removed" "$CTRL" \
  's/WHERE m\.is_valid = 1/WHERE 1=1/'

# 4. Pricing creeps back in.
mutate "msrp column added to the controller" "$CTRL" \
  's/MAX\(d\.product_name\)  AS product_name,/MAX(d.product_name) AS product_name, MAX(d.msrp) AS msrp,/'

# 5. Legacy parser re-keyed onto Original Sku — splits history at 2024-07-09.
mutate "legacy schema keyed on col 0 (Original Sku)" "$JOB" \
  's/legacy: \{ sku: 1,/legacy: { sku: 0,/'

# 6. Unknown headers silently treated as modern instead of rejected.
mutate "unknown header no longer returns null" "$JOB" \
  's/return null;\n\}\n\nconst SCHEMA_COLS/return \x27modern\x27;\n}\n\nconst SCHEMA_COLS/'

# 7. Source note removed — page stops saying it is not our sales.
#    Case-insensitive: the view renders it as "Not BVO sales. Not RFL sales."
#    inside <strong>. A case-sensitive pattern silently SKIPPED here, which
#    reported success while testing nothing — the exact failure mode this
#    harness exists to prevent.
mutate "\"Not BVO sales\" source note removed" "$VIEW" \
  's/Not BVO sales\.//gi'

# 8. Inline handler added — breaks under the admin CSP.
mutate "inline onclick added to the view" "$VIEW" \
  's/id="wc-run-rollup"/id="wc-run-rollup" onclick="run()"/'

# 9. COLLATE dropped from a table — the MariaDB trap.
mutate "COLLATE dropped from wc_dimensions" "$MIG" \
  's/(CREATE TABLE IF NOT EXISTS wc_dimensions.*?)COLLATE=utf8mb4_unicode_ci;/$1;/s'

# 10a. Default scope widened to everything — faucets and kitchen sinks
#      silently counted as vanity demand.
mutate "default scope changed from vanity to all" "$CTRL" \
  "s/const DEFAULT_SCOPE = 'vanity';/const DEFAULT_SCOPE = 'all';/"

# 10b. Scope computed but not applied — the quietest failure of all.
mutate "scope fragment dropped from a DEDUPED_BASE call" "$CTRL" \
  's/\$\{DEDUPED_BASE\(W, SC\.sql\)\}/\${DEDUPED_BASE(W)}/'

# 10c. Classifier guesses instead of returning null for an unknown shape.
mutate "unknown SKU guessed as vanity instead of null" "$JOB" \
  "s/  return null;   \/\/ unclassified — surfaced, never guessed/  return 'vanity';/"

# 10d. Kitchen sinks fall through to the vanity rule.
mutate "kitchen_sink rule removed — sinks fall through to vanity" "$JOB" \
  "s/\['kitchen_sink', \/\^\(CF\\\\d\+\|SS\[A-Z\]\*\)-\[A-Z\]\{1,2\}-\\\\d\{4\}\[A-Z\]\?\(-\\\\d\+\)\?\\\$\/\],//"

# 10. Migration made destructive.
mutate "DROP TABLE added to the migration" "$MIG" \
  's/^CREATE TABLE IF NOT EXISTS wc_snapshots \(/DROP TABLE IF EXISTS wc_snapshots;\nCREATE TABLE IF NOT EXISTS wc_snapshots (/m'

# ── 11. THE VALIDITY ONE-WAY DOOR ──────────────────────────────────────
#   This is the bug that shipped. It discarded 400 of 1,628 days — every
#   snapshot after 2025-10-08 — and the only symptom was one card reading
#   "No movement in this window". These three mutations reintroduce it by
#   each of the routes it could come back by.

# 11a. The original bug, exactly: baseline computed over valid days only.
#      WC steps its catalogue down, every later day deviates from a frozen
#      median, and being invalid none of them can ever move it.
mutate "trailing median filtered back down to valid days only" "$JOB" \
  's/WHERE snapshot_date < \? ORDER BY snapshot_date DESC LIMIT 7/WHERE snapshot_date < ? AND is_valid = 1 ORDER BY snapshot_date DESC LIMIT 7/'

# 11b. Same door, other hinge: the whole-series recompute stops following
#      the counts and only ever ratchets one way.
mutate "recomputeValidity window stops updating after an invalid day" "$JOB" \
  's/    window\.push\(r\.row_count\);\n    if \(window\.length > 7\) window\.shift\(\);/    if (isValid) { window.push(r.row_count); if (window.length > 7) window.shift(); }/s'

# 11c. Validity rescued but deltas never rebuilt — days marked valid that
#      contain nothing, which reads on the dashboard as "no demand".
mutate "rebuild step removed — rescued days stay empty" "$JOB" \
  's/const unbuilt = await findUnbuiltValidDays\(conn\);/const unbuilt = [];/'

# 11d. The two gate paths given different minimum baselines, so they
#      disagree on the earliest days and flip them on alternate runs.
mutate "validity paths given divergent minimum baselines" "$JOB" \
  's/if \(window\.length >= VALIDITY_MIN_BASELINE\)/if (window.length >= 3)/'

# ── 12. THE SKU CODEBOOK ───────────────────────────────────────────────
#   The decode is now the source of ~100% of attribute coverage, so a wrong
#   codebook is a wrong dashboard with no outward sign of trouble.

# 12a. A code mapped to the wrong name. This is the quietest possible
#      failure: every card still populates, just with the wrong labels.
mutate "colour code NJ remapped to the wrong name" "$CODEBOOK" \
  "s/NJ: 'Noir Juglans'/NJ: 'Monarch Blue'/"

# 12b. An unknown code guessed instead of left null — a new WC collection
#      would be silently misfiled under an existing one.
mutate "unknown collection code falls back to a guess" "$CODEBOOK" \
  "s/collection:      COLLECTION\[coll\]       \|\| null,/collection: COLLECTION[coll] || 'Palace',/"

# 12c. top_finish derived from the code. QZ is Whitebrook on Sequoia and
#      Carrara on Palace, so this fills a card with confident nonsense.
mutate "top_finish derived from the top code" "$CODEBOOK" \
  "s/    top_material:    TOP_MATERIAL\[top\]      \|\| null,/    top_material: TOP_MATERIAL[top] || null,\n    top_finish: 'Carrara White',/"

# 12d. Precedence inverted — a rule applied to a code would overwrite a
#      per-SKU statement from the supplier.
mutate "decode allowed to overwrite the supplier catalogue" "$JOB" \
  's/\{\s*\n?\s*\.\.\.dec,/{\n      ...cat,/'

# 12e. Non-grammar SKUs decoded anyway, dragging washstands and
#      accessories into the vanity attribute cuts.
mutate "non-grammar SKUs no longer rejected" "$CODEBOOK" \
  's/if \(!m\) return null;/if (!m) return { collection: null, size_nominal: null, top_material: null, cabinet_color: null, sinks: null, codes: {} };/'

# 12g/12h. The two unsourceable cards creep back. Easy to do by reflex
#      ("there's a column for it"), and the result is a report with dead
#      blocks that make the working parts look broken too.
mutate "Top finish card re-added to the view" "$VIEW" \
  "s/  \['bySinks',       'Sink count',       'sink count',     coverage.top_pct\],/  ['byTopFinish',   'Top finish',       'top finish',     coverage.top_pct],\n  ['bySinks',       'Sink count',       'sink count',     coverage.top_pct],/"

mutate "Mounting card re-added to the controller" "$CTRL" \
  "s/    cards.bySinks      = await card\('bySinks',      \(\) => byDim\('sinks'\)\);/    cards.byMounting   = await card('byMounting',   () => byDim('mounting'));\n    cards.bySinks      = await card('bySinks',      () => byDim('sinks'));/"

# ── 13. THE TREND CHART ────────────────────────────────────────────────
#   The expensive mistake here is plotting raw units instead of a rate.
#   It looks completely normal and is wrong by ~10 points on the YoY read.

# 13a. The chart stops dividing by observed days.
mutate "chart plots raw units instead of units/observed-day" "$VIEW" \
  's/e\.rate = e\.days \? e\.units \/ e\.days : 0;/e.rate = e.units;/'

# 13b. span_days dropped from the bucket accumulator, so the denominator
#      silently becomes a count of observations rather than days covered.
mutate "span_days no longer accumulated into the bucket" "$VIEW" \
  's/map\[k\]\.days  \+= r\[2\];/map[k].days += 1;/'

# 13c. A granularity removed.
mutate "quarterly granularity dropped from the control" "$VIEW" \
  's/<button type="button" data-g="Q">Quarterly<\/button>\n//'

# 13d. An inline handler sneaks in — the admin CSP would silently kill it.
mutate "inline onchange handler added to the range select" "$VIEW" \
  's/<select id="wc-from" class="adm-input"><\/select>/<select id="wc-from" class="adm-input" onchange="render()"><\/select>/'

# 13f. THE BUG THAT ACTUALLY SHIPPED: the scopeClause OBJECT passed to
#      DEDUPED_BASE instead of SC.sql. Stringifies to "[object Object]",
#      the query dies at parse time, card() swallows it, and the section
#      shows its empty state. Invisible without a gate.
#      Pattern deliberately avoids the \${...} template braces — escaping
#      them through bash into perl is what broke the first attempt here.
mutate "scopeClause object passed to DEDUPED_BASE instead of SC.sql" "$CTRL" \
  "s/DEDUPED_BASE\('', SC\.sql\)/DEDUPED_BASE('', scopeClause(scopeKey))/"

# 13g. Scope params not bound, so SC.sql's ? placeholders dangle.
mutate "daily series stops binding SC.params" "$CTRL" \
  "s/ORDER BY g\.movement_date ASC\`, \[\.\.\.SC\.params\]/ORDER BY g.movement_date ASC\`/"

# 13e. span_days dropped from the server payload entirely.
mutate "daily series stops selecting span_days" "$CTRL" \
  's/GREATEST\(COALESCE\(MAX\(g\.span_days\),1\),1\) AS span/1 AS span/'

# ─── 14. THE RFL OVERLAY ──────────────────────────────────────────────
# Each of these is a way the overlay could flatter the data instead of
# reporting it. The gate has to bite on every one.

# 14a. The proxy put ahead of a real unit count, so a true figure from an
#      export is thrown away in favour of dollars ÷ an assumed price.
mutate "dollar proxy overrides a real unit count" "$CTRL" \
  's/COALESCE\(units, net_sales \/ \?\)/net_sales \/ ?/'

# 14b. Month length left in, so February reads as a slump and July as a boom.
#      Aimed at the SELECT line via its "AS span" alias, not at the bare
#      expression: perl -0 replaces the FIRST match, and the first mention of
#      DAY(LAST_DAY(month)) in the controller is the comment explaining it.
#      The first version of this mutation edited that comment and left the
#      query untouched, then reported the gate as holed. It wasn't.
mutate "RFL month length no longer divided out" "$CTRL" \
  's/DAY\(LAST_DAY\(month\)\)(\s+)AS span/30$1AS span/'

# 14c. A SECOND Y-AXIS. The one that matters most: with two scales either
#      line can be stretched until the pair appears to move together, and
#      nothing on the page says it happened.
mutate "second y-axis added to the trend chart" "$VIEW" \
  "s/scales: \{ y: \{ beginAtZero: true,/scales: { y1: { position: 'right' }, y: { beginAtZero: true,/"

# 14d. The overlay plotted as a bucket total rather than a per-day rate,
#      putting two different metrics on one axis.
mutate "RFL overlay plots bucket totals instead of a rate" "$VIEW" \
  's/m\.units \/ m\.cal \* 10/m.units * 10/'

# 14e. The GVS seam erased — pre-2024 and post-2024 drawn as one line, so a
#      2.5x system-migration step reads as growth.
mutate "GVS Shopify months merged into the RFLPOS line" "$VIEW" \
  's/low confidence/same thing really/'

# 14f. The monthly-grain restriction dropped, so Daily and Weekly offer an
#      overlay that has no data behind it.
#      Aimed at the PLOTTING path only, on purpose. The first version of this
#      mutation exposed a real hole: the M/Q/Y test was written out twice, so
#      breaking the plotting copy left the control-label copy satisfying the
#      gate while the chart drew RFL at Daily grain. The rule now lives in
#      rflGrainOk() and the gate requires every caller to route through it.
mutate "plotting path bypasses the grain restriction" "$VIEW" \
  's/rflBox\.checked && rflGrainOk\(\)/rflBox.checked/'

# 14g. The grain rule written out a second time instead of called — the
#      duplication that caused 14f's hole in the first place.
mutate "grain rule duplicated instead of calling rflGrainOk()" "$VIEW" \
  "s/var ok = rflGrainOk\(\);/var ok = (SEL_G === 'M' || SEL_G === 'Q' || SEL_G === 'Y');/"

# 14h. A second hard-coded divisor, which is how the constant drifts out of
#      sync with the number people believe it to be.
mutate "second hard-coded RFL divisor introduced" "$CTRL" \
  's/net_sales \/ \?/net_sales \/ 1430/'

# 14j. Indexing applied to ONLY the RFL line — a second y-axis implemented
#      in JavaScript. The small line gets stretched until it tracks the big
#      one, and nothing on the page says so.
mutate "indexing cherry-picks one series instead of all" "$VIEW" \
  's/sets\.forEach\(function \(d\) \{/[sets[2]].forEach(function (d) {/'

# 14k. Axis title frozen on units while the data is an index, so a reader
#      sees "units / observed day" above numbers that are not units.
mutate "y-axis still says units when indexed" "$VIEW" \
  "s/\? 'index \(100 = each line\\\\u2019s own mean over the range\)'/? 'units \/ observed day'/"

# 14l. THE BUG SAM CAUGHT: index base reverted to a single bucket. GVS's
#      first month was 0.48 units/day (a ramp-up month), so dividing by it
#      sent that line to 779, stretched the axis to 0-800, and flattened
#      WC's real 23% decline into the bottom eighth of the plot.
mutate "index base reverted to a single bucket instead of the mean" "$VIEW" \
  's/var base = vals\.reduce\(function \(s2, v\) \{ return s2 \+ v; \}, 0\) \/ vals\.length;/var base = vals[0];/'

# 14m. From/To range collapsed back to a single-value filter, so "2023 to
#      now" becomes inexpressible again.
mutate "range filter reduced to one endpoint" "$VIEW" \
  's/return k >= f && k <= t;/return k >= f;/'

# 14n. Caps triggered on the day's TOTAL units instead of units-per-model,
#      which also silently removes ordinary busy days (2025-08-29: 279 units
#      but only 2.7 per model across 103 models).
mutate "event cap triggers on total units, not per-model" "$CTRL" \
  's/const perModel = units \/ models;/const perModel = units;/'

# 14o. Capped days no longer surfaced - the chart is adjusted and says nothing.
mutate "capped days hidden from the view" "$VIEW" \
  's/capped as non-retail:/adjusted:/'

# 14i. The product scope removed from the chart series CLEANLY — valid SQL,
#      no error, no empty card. The WC line quietly starts summing faucets,
#      kitchen sinks, wash stands and accessories alongside vanities and is
#      no longer comparable to RFL. §12's scope checks catch a MALFORMED
#      scope; only this catches a removed one, which is the mistake the stale
#      "NOT scope-filtered on purpose" comment actively invited.
mutate "product scope dropped from the WC chart series" "$CTRL" \
  "s/DEDUPED_BASE\('', SC\.sql\)/DEDUPED_BASE('')/"

# 12f. The codebook made to read from disk — the hbuilds trap, which would
#      break it on the next deploy and only the next deploy.
#      /m is required: perl -0 slurps the file, so ^ only anchors per-line
#      with the m flag. Without it the pattern silently never matches and the
#      harness reports BROKEN rather than testing anything.
mutate "codebook reads its data from disk" "$CODEBOOK" \
  "s/^'use strict';/'use strict';\nconst fs = require('fs');\nconst DATA = __dirname + '\/..\/..\/codebook.json';/m"

echo ""
echo "Restoring originals and re-running the gate:"
restore_check() {
  for f in "$JOB" "$CTRL" "$VIEW" "$MIG" "$CODEBOOK"; do cp "$BACKUP_DIR/$(basename "$f")" "$f"; done
}
restore_check
if $GATE >/dev/null 2>&1; then
  echo "  OK        gate green again after restore"
else
  echo "  PROBLEM   gate is red after restore — files may not have been restored cleanly"
  FAILED=1
fi

echo ""
if [ "$FAILED" -ne 0 ]; then
  echo "mutate_wc_inventory: at least one mutation went UNDETECTED — the gate has a hole."
  exit 1
fi
echo "mutate_wc_inventory: every mutation was caught."
exit 0
