#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# mutate_manual_tracking.sh — proves gate_manual_tracking.js can fail.
#
# Every mutation below is a defect that was REAL in this codebase on
# 2026-10-26 or 2026-10-27, or the specific way the gate could have been
# written so loosely that it would never have caught them.
#
# Restores from a /tmp copy, not from git, so it runs on uncommitted work
# and cannot revert unrelated changes. The EXIT trap restores even if the
# script is killed.
#
# python3 with `assert old in s`, never perl s{}{} — an unbalanced brace
# in a perl substitution dies silently, applies nothing, and reads as a
# MISSED mutation. A false green is worse than no test.
# ─────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")/.." || exit 1

GATE="gates/gate_manual_tracking.js"
UTIL="src/utils/shipMode.js"
CTRL="src/controllers/ordersController.js"
VIEW="views/pages/admin/orders/detail.ejs"
POLL="src/jobs/shipmentStatusPoll.js"
MODEL="src/models/Customer.js"

BAK="$(mktemp -d)"
for f in "$UTIL" "$CTRL" "$VIEW" "$POLL" "$MODEL"; do
  mkdir -p "$BAK/$(dirname "$f")"
  cp "$f" "$BAK/$f" || { echo "cannot back up $f — aborting"; exit 2; }
done
restore() { for f in "$UTIL" "$CTRL" "$VIEW" "$POLL" "$MODEL"; do cp "$BAK/$f" "$f"; done; }
trap 'restore; rm -rf "$BAK"' EXIT

caught=0; missed=0

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
  if node "$GATE" >/tmp/mmt.out 2>&1; then
    echo "  MISSED  $1"; missed=$((missed+1))
  else
    echo "  caught  $1  ($(grep -c 'FAIL' /tmp/mmt.out) failing check(s))"
    caught=$((caught+1))
  fi
  restore
}

echo
echo "mutate_manual_tracking — planting the defects this gate exists to catch"
echo

# ── M1: mode keyed on the carrier name ───────────────────────────────
# Looks entirely reasonable. Wrong for FedEx, which runs an LTL network
# and a parcel network under one name.
patch_py "$UTIL" \
  "  return String(shipment.product_type || '').trim().toUpperCase() === 'SMALLPACK';" \
  "  return /ups|fedex/i.test(String(shipment.carrier || ''));" \
  && run "M1 mode keyed on the carrier name (FedEx is both)"

# ── M2: unknown product_type treated as parcel ───────────────────────
# The unsafe direction: tells someone a pallet will be left at the door.
patch_py "$UTIL" \
  "  if (!shipment) return false;
  return String(shipment.product_type || '').trim().toUpperCase() === 'SMALLPACK';" \
  "  if (!shipment) return false;
  return String(shipment.product_type || '').trim().toUpperCase() !== 'LTL';" \
  && run "M2 anything-not-LTL treated as parcel (unsafe direction)"

# ── M3: tracking_number no longer read ───────────────────────────────
# The live defect: every order-page booking lost its Track button.
patch_py "$UTIL" \
  "  const tn = String(shipment.tracking_number || '').trim();
  return tn || null;" \
  "  return null;" \
  && run "M3 tracking_number column ignored (the no-Track-button defect)"

# ── M4: a guessed fallback URL ───────────────────────────────────────
# The original bug, restored: one tracker for every carrier.
patch_py "$UTIL" \
  "  const hit = URL_TEMPLATES.find(t => t.test.test(carrier));
  return hit ? hit.url(num) : null;" \
  "  const hit = URL_TEMPLATES.find(t => t.test.test(carrier));
  return hit ? hit.url(num) : 'https://wwex.com/track/' + num;" \
  && run "M4 unknown carrier falls back to a guessed wwex.com link"

# ── M5: javascript: URL allowed through ──────────────────────────────
# The value is rendered into an href on a customer-facing page.
patch_py "$UTIL" \
  "  if (manual && /^https?:\/\//i.test(manual)) return manual;" \
  "  if (manual) return manual;" \
  && run "M5 unvalidated tracking_url rendered into an href"

# ── M6: the mode radio loses `required` ──────────────────────────────
# Falls back to the schema default 'LTL' — which is precisely how every
# parcel came to be labelled freight.
patch_py "$VIEW" \
  '<input type="radio" name="product_type" value="LTL" required' \
  '<input type="radio" name="product_type" value="LTL"' \
  && run "M6 mode no longer required on the entry form"

# ── M7: the handler stops validating against the ENUM ────────────────
# MySQL in non-strict mode stores '' for an out-of-ENUM value; the row
# then falls outside every status filter and vanishes from the UI.
patch_py "$CTRL" \
  "  if (productType !== 'LTL' && productType !== 'SMALLPACK') {" \
  "  if (false) {" \
  && run "M7 product_type no longer validated against the ENUM"

# ── M8: saving also emails the customer ──────────────────────────────
# Removes the chance to catch a typo before it reaches an inbox.
patch_py "$CTRL" \
  "    await conn.commit();
    return res.redirect(\`/admin/orders/\${id}?saved=tracking\`);" \
  "    await conn.commit();
    await brevo.sendTemplate('order_shipped', 'x@example.com', {});
    return res.redirect(\`/admin/orders/\${id}?saved=tracking\`);" \
  && run "M8 saving tracking also fires the customer email"

# ── M9: manual rows no longer excluded from the WWEX poll ────────────
# The poll would overwrite a hand-entered status with a lookup failure.
patch_py "$POLL" \
  "        AND entry_source = 'wwex'
" \
  "" \
  && run "M9 the WWEX poll no longer skips hand-entered shipments"

# ── M10: the customer query goes back to pro_number only ─────────────
patch_py "$MODEL" \
  "         AND (COALESCE(NULLIF(s.pro_number, ''), NULLIF(s.tracking_number, '')) IS NOT NULL)" \
  "         AND (s.pro_number IS NOT NULL AND s.pro_number <> '')" \
  && run "M10 getOrderTracking requires pro_number again"

# ── M11: the WWEX-booking guard removed ──────────────────────────────
# Stamping 'manual' over a real booking strands it at the carrier with
# no product_transaction_id left to void it.
patch_py "$CTRL" \
  "    if (existing && existing.entry_source !== 'manual') {" \
  "    if (false) {" \
  && run "M11 manual entry allowed to overwrite a real WWEX booking"

echo
echo "caught $caught / $((caught+missed))"
[ "$missed" -eq 0 ] || exit 1
