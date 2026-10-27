#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# mutate_account_links.sh — proves gate_account_links_resolve.js can fail.
#
# A gate that passes on correct code has proved nothing. These seven
# mutations are the actual production defects, plus the three ways this
# gate could be written so loosely that it never catches them.
#
# Every mutation uses python3 with `assert old in s`, NOT perl s{}{}.
# An unbalanced brace in a perl substitution dies silently, applies
# nothing, and reads as a MISSED mutation — a false green. The assert
# makes a failed patch loud.
#
# ⚠️ RESTORES FROM A /tmp COPY, NOT FROM GIT, AND THAT IS DELIBERATE.
# `git checkout --` would have made this script unrunnable at the exact
# moment it is most needed: on the uncommitted change that introduces the
# gate. It would also silently revert unrelated work in those files. The
# copy is taken before the first mutation and restored after each one,
# and the EXIT trap puts the files back even if the script is killed.
# ─────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")/.." || exit 1

GATE="gates/gate_account_links_resolve.js"
ROUTES="src/routes/account.js"
ORDERS="views/pages/account/orders.ejs"
TRACKVIEW="views/pages/account/order-tracking.ejs"
MODEL="src/models/Customer.js"
DETAIL="views/pages/account/order-detail.ejs"

BAK="$(mktemp -d)"
for f in "$ROUTES" "$ORDERS" "$TRACKVIEW" "$MODEL" "$DETAIL"; do
  mkdir -p "$BAK/$(dirname "$f")"
  cp "$f" "$BAK/$f" || { echo "cannot back up $f — aborting"; exit 2; }
done

restore() { for f in "$ROUTES" "$ORDERS" "$TRACKVIEW" "$MODEL" "$DETAIL"; do cp "$BAK/$f" "$f"; done; }
trap 'restore; rm -rf "$BAK"' EXIT

caught=0; missed=0

patch_py() {
  python3 - "$1" "$2" "$3" <<'PY'
import sys
f, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(f).read()
assert old in s, "PATCH TARGET NOT FOUND in %s: %r" % (f, old[:60])
open(f, 'w').write(s.replace(old, new, 1))
PY
}

run() {           # run <label>
  if node "$GATE" >/tmp/mal.out 2>&1; then
    echo "  MISSED  $1"; missed=$((missed+1))
  else
    echo "  caught  $1  ($(grep -c 'FAIL' /tmp/mal.out) failing check(s))"
    caught=$((caught+1))
  fi
  restore
}

echo
echo "mutate_account_links — planting the defects this gate exists to catch"
echo

# ── M1: the order detail route deleted, link left in place ───────────
# This IS the production defect: orders.ejs linked to /account/orders/:id
# and the route never existed.
patch_py "$ROUTES" \
  "router.get('/orders/:id',         requireAuth, controller.orderDetail);" \
  "" && run "M1 /orders/:id route removed (the 2026-10-26 defect)"

# ── M2: the tracking route deleted, Track button left in place ───────
patch_py "$ROUTES" \
  "router.get('/orders/:id/tracking', requireAuth, controller.orderTracking);" \
  "" && run "M2 /orders/:id/tracking route removed"

# ── M3: the addresses route deleted, nav item left in place ──────────
# The 2026-10-25 defect, in four views at once.
patch_py "$ROUTES" \
  "router.get('/addresses',          requireAuth, controller.addressesPage);" \
  "" && run "M3 /addresses route removed (the 2026-10-25 defect)"

# ── M4: the route deleted but QUOTED IN A COMMENT ────────────────────
# Comment-stripping is load bearing. Without it the regex finds the route
# path in the header prose and reports a deleted route as present — the
# same trap that let a mutation slip past gate_email_blocklist.
patch_py "$ROUTES" \
  "router.get('/orders/:id',         requireAuth, controller.orderDetail);" \
  "/* router.get('/orders/:id', requireAuth, controller.orderDetail); */" \
  && run "M4 /orders/:id route commented out (comment-stripping works)"

# ── M5: a brand-new dangling link in a view ──────────────────────────
patch_py "$ORDERS" \
  '<a href="/account/orders' \
  '<a href="/account/invoices"></a><a href="/account/orders' \
  && run "M5 new dangling link /account/invoices"

# ── M6: a link that is a PREFIX EXTENSION of a real route ────────────
# /account/orders/:id/tracking exists; /account/orders/:id/tracking/pdf
# does not. A matcher that compared prefixes, or used .includes(), or
# forgot to compare segment counts, would pass this. That is the single
# most likely way for this gate to be quietly useless.
patch_py "$ORDERS" \
  '<a href="/account/orders' \
  '<a href="/account/orders/14/tracking/pdf"></a><a href="/account/orders' \
  && run "M6 prefix-extension link (segment-exact matching works)"

# ── M7: the tracking view deleted while the route still renders it ───
# The failure mode is a 500 at request time, not at boot: a missing
# template is only discovered when someone asks for the page.
rm -f "$TRACKVIEW" && run "M7 order-tracking.ejs deleted"

# ── M8: the actual 2026-10-27 defect — a column that does not exist ──
# ER_BAD_FIELD_ERROR, swallowed, rendered as "that order does not exist"
# to a customer looking at an order they had paid for.
patch_py "$MODEL" \
  "             NULLIF(TRIM(CONCAT(COALESCE(o.ship_first_name,''),' '," \
  "             o.ship_name, NULLIF(TRIM(CONCAT(COALESCE(o.ship_first_name,''),' '," \
  && run "M8 o.ship_name reintroduced (the 2026-10-27 defect)"

# ── M9: the catch comes back ─────────────────────────────────────────
# The column fix alone is not the fix. Without this, the NEXT bad column
# is silently a 404 again.
# The anchor is getOrderTracking's own ORDER BY, which no other method
# has. An anchor shared with getOrder would patch whichever came first and
# the mutation would land somewhere other than where this claims — the
# same trap that made M7 patch the wrong login render in an earlier
# harness.
patch_py "$MODEL" \
  "       ORDER BY s.created_at DESC
       LIMIT 1
    \`, [orderId]);
    return (rows && rows[0]) || null;
  }," \
  "       ORDER BY s.created_at DESC
       LIMIT 1
    \`, [orderId]).catch(() => [[]]);
    try { return (rows && rows[0]) || null; } catch (e) { return null; }
  }," \
  && run "M9 a swallowing catch reintroduced in getOrderTracking"

# ── M10: the CONCAT deleted outright ─────────────────────────────────
# Removing the address block passes M8's check by having no ship_name at
# all. The page would silently lose its delivery address.
patch_py "$MODEL" \
  "COALESCE(o.ship_last_name,''))),'') AS ship_name," \
  "COALESCE(o.ship_last_name,''))),'') AS ship_nom," \
  && run "M10 ship_name alias removed (the replacement is asserted present)"

# ── M11: the parcel branch deleted, everyone gets freight copy ───────
# The defect as originally shipped: one copy set, written for LTL, shown
# to a UPS customer who then waits in for a phone call.
patch_py "$TRACKVIEW" "        SMALLPACK: {" "        SMALLPACK_DISABLED: {" \
  && run "M11 the parcel copy set removed"

# ── M12: freight wording pasted into the parcel branch ───────────────
# This is what passes a check that only asks "does a SMALLPACK key
# exist". The promise is the thing that must not be there.
patch_py "$TRACKVIEW" \
  "            next: 'No appointment is needed" \
  "            next: 'The carrier will call you to arrange a delivery appointment. No appointment is needed" \
  && run "M12 the appointment promise pasted into the parcel copy"

# ── M13: copy keyed on the carrier name instead of product_type ──────
# Looks entirely reasonable and is wrong for FedEx, which runs both an
# LTL and a parcel network under one name.
patch_py "$TRACKVIEW" \
  "var isParcel = String(tracking.product_type).toUpperCase() === 'SMALLPACK';" \
  "var isParcel = tracking.carrier.toLowerCase().includes('ups');" \
  && run "M13 copy keyed on the carrier name (FedEx is both)"

echo
echo "caught $caught / $((caught+missed))"
[ "$missed" -eq 0 ] || exit 1
