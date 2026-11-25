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
GATE="node gates/gate_wc_inventory.js"

BACKUP_DIR=$(mktemp -d)
restore() {
  for f in "$JOB" "$CTRL" "$VIEW" "$MIG"; do
    [ -f "$BACKUP_DIR/$(basename "$f")" ] && cp "$BACKUP_DIR/$(basename "$f")" "$f"
  done
  rm -rf "$BACKUP_DIR"
}
trap restore EXIT INT TERM
for f in "$JOB" "$CTRL" "$VIEW" "$MIG"; do cp "$f" "$BACKUP_DIR/$(basename "$f")"; done

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

echo ""
echo "Restoring originals and re-running the gate:"
restore_check() {
  for f in "$JOB" "$CTRL" "$VIEW" "$MIG"; do cp "$BACKUP_DIR/$(basename "$f")" "$f"; done
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
