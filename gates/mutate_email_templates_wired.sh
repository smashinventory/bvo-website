#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# mutate_email_templates_wired.sh — proves gate_email_templates_wired can fail.
#
# The gate exists because four templates sat active with no sender and
# nothing noticed for months. These mutations are the ways that state could
# come back, including the way it would come back most easily: somebody
# deleting an inconvenient entry from the accepted-orphan list.
#
# Restores from a /tmp copy, not git, so it runs on uncommitted work.
# Every call site carries `|| skip` so a mutation whose target has been
# refactored away is reported loudly instead of vanishing from the score —
# see mutate_cart_recovery.sh M12 for why that rule exists.
# ─────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")/.." || exit 1

GATE="gates/gate_email_templates_wired.js"
POLL="src/jobs/shipmentStatusPoll.js"

FILES=("$GATE" "$POLL")

BAK="$(mktemp -d)"
for f in "${FILES[@]}"; do
  mkdir -p "$BAK/$(dirname "$f")"
  cp "$f" "$BAK/$f" || { echo "cannot back up $f — aborting"; exit 2; }
done
restore() { for f in "${FILES[@]}"; do cp "$BAK/$f" "$f"; done; }
trap 'restore; rm -rf "$BAK"' EXIT

caught=0; missed=0; skipped=0

skip() {
  echo "  SKIPPED $1"
  echo "          patch target not found — this mutation did NOT run."
  skipped=$((skipped+1))
}

patch_py() {
  python3 - "$1" "$2" "$3" <<'PY'
import sys
f, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(f).read()
assert old in s, "PATCH TARGET NOT FOUND in %s: %r" % (f, old[:70])
open(f, 'w').write(s.replace(old, new, 1))
PY
}

run() {
  if node "$GATE" >/tmp/metw.out 2>&1; then
    echo "  MISSED  $1"; missed=$((missed+1))
  else
    echo "  caught  $1  ($(grep -c 'FAIL' /tmp/metw.out) failing check(s))"
    caught=$((caught+1))
  fi
  restore
}

echo
echo "mutate_email_templates_wired — planting the email nobody sends"
echo

# ── M1: the inconvenient exemption is simply deleted ─────────────────
# ⚠️ THE MOST LIKELY ONE. Somebody tidying the list removes an entry
# without wiring the template. The orphan becomes invisible again —
# exactly the state the gate was written to end.
patch_py "$GATE" \
  "  review_request:   'GAP-01 — needs a delayed send after delivery; subject wording also still open'," \
  "" \
  && run "M1 an accepted orphan deleted from the list, not wired" \
  || skip "M1 an accepted orphan deleted from the list, not wired"

# ── M2: a NEW template arrives with no sender ────────────────────────
# The GAP-01 scenario replaying: a template is added and nobody wires it.
patch_py "$GATE" \
  "  'vanity_in_preparation'," \
  "  'vanity_in_preparation',
  'winback_90_day'," \
  && run "M2 a new template added with no sender and no exemption" \
  || skip "M2 a new template added with no sender and no exemption"

# ── M3: an exemption with no real reason ─────────────────────────────
# "TODO" or "" makes the list a dumping ground instead of a decision log.
patch_py "$GATE" \
  "  cross_sell:       'GAP-01 — needs a delayed send after delivery'," \
  "  cross_sell:       'TODO'," \
  && run "M3 an exemption carrying no real reason" \
  || skip "M3 an exemption carrying no real reason"

# ── M4: a stale exemption after the template IS wired ────────────────
# The template gets a sender but stays on the orphan list, so the gate
# keeps exempting something it should now be protecting.
patch_py "$POLL" \
  "const { bvoPool } = require('../config/database');" \
  "const { bvoPool } = require('../config/database');
const _b = require('../services/brevoService');
async function _notify(e){ await _b.sendTemplate('order_delivered', e, {}); }" \
  && run "M4 template wired but left on the accepted-orphan list" \
  || skip "M4 template wired but left on the accepted-orphan list"

# ── M5: comment-stripping disabled, and a comment planted ────────────
# ⚠️ THE TRAP THAT CAUSED THE ORIGINAL MISS, and it needs TWO edits to
# test honestly. out_for_delivery had three references in src/ and all
# three were ENUM commentary; a gate that greps without stripping
# comments would have scored it "wired" and passed while the customer
# got no email.
#
# The first version of this mutation planted only the comment and was
# MISSED — correctly, because the gate strips comments, so the planted
# comment changed nothing and there was no defect to catch. A mutation
# that leaves behaviour unchanged tests nothing. Disabling the strip is
# what actually plants the defect.
patch_py "$GATE" \
  "  const src = strip(fs.readFileSync(f, 'utf8'));" \
  "  const src = (fs.readFileSync(f, 'utf8'));" \
  && patch_py "$POLL" \
  "const { bvoPool } = require('../config/database');" \
  "/* someday: sendTemplate('review_request', email, {}) */
const { bvoPool } = require('../config/database');" \
  && run "M5 comments counted as senders (strip disabled)" \
  || skip "M5 comments counted as senders (strip disabled)"

# ── M6: the manifest loses a template a migration inserts ────────────
# The manifest rots, the template drops out of scope, and the gate stops
# checking it without saying so.
patch_py "$GATE" \
  "  'cart_recovery'," \
  "" \
  && run "M6 manifest missing a migration-inserted template" \
  || skip "M6 manifest missing a migration-inserted template"

echo
echo "caught $caught / $((caught+missed))"
if [ "$skipped" -gt 0 ]; then
  echo
  echo "*** $skipped MUTATION(S) DID NOT RUN — retarget or delete them. ***"
fi
[ "$missed" -eq 0 ] && [ "$skipped" -eq 0 ] || exit 1
