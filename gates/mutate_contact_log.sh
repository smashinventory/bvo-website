#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# mutate_contact_log.sh — proves gate_contact_log.js can fail.
#
# Every mutation is something somebody would do believing it an
# improvement or a simplification. Each one either rings a customer who
# was called an hour ago, mails somebody who declined marketing, or loses
# a cart off the list entirely. None produces an error.
#
# Restores from a /tmp copy, not git, so it runs on uncommitted work.
# python3 with `assert old in s`, never perl s{}{} — an unbalanced brace
# dies silently, applies nothing, and reads as a MISSED mutation.
# ─────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")/.." || exit 1

GATE="gates/gate_contact_log.js"
UTIL="src/utils/contactLog.js"
JOB="src/jobs/cartRecovery.js"
CTL="src/controllers/customerOutreachController.js"
ORD="src/controllers/ordersController.js"
VIEW="views/pages/admin/orders/detail.ejs"
SQL="migrations/2026-10-27_contact_log_RUNME.sql"

FILES=("$UTIL" "$JOB" "$CTL" "$ORD" "$VIEW" "$SQL")

BAK="$(mktemp -d)"
for f in "${FILES[@]}"; do
  mkdir -p "$BAK/$(dirname "$f")"
  cp "$f" "$BAK/$f" || { echo "cannot back up $f — aborting"; exit 2; }
done
restore() { for f in "${FILES[@]}"; do cp "$BAK/$f" "$f"; done; }
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
  if node "$GATE" >/tmp/mcl.out 2>&1; then
    echo "  MISSED  $1"; missed=$((missed+1))
  else
    echo "  caught  $1  ($(grep -c 'FAIL' /tmp/mcl.out) failing check(s))"
    caught=$((caught+1))
  fi
  restore
}

echo
echo "mutate_contact_log — planting the second phone call"
echo

# ── M1: the window boundary slips by a day ───────────────────────────
# >= instead of <. Reads identical; the window silently lasts a day
# longer than the constant says it does.
patch_py "$UTIL" "  if (ageDays < days) {" "  if (ageDays <= days) {" \
  && run "M1 window boundary uses <= (silently one day longer)"

# ── M2: suppression fails CLOSED on a bad date ───────────────────────
# Looks defensive. Means an unparseable timestamp silently drops a cart
# off the call list with no trace anywhere.
patch_py "$UTIL" \
  "  if (Number.isNaN(then.getTime())) return { skip: false, reason: null };" \
  "  if (Number.isNaN(then.getTime())) return { skip: true, reason: 'bad date' };" \
  && run "M2 unreadable date fails CLOSED (cart silently dropped)"

# ── M3: a bad number expires like any other outcome ──────────────────
# Three days later the dead number is dialled again, forever.
patch_py "$UTIL" "const PERMANENT_OUTCOMES = ['bad_number'];" \
  "const PERMANENT_OUTCOMES = [];" \
  && run "M3 bad_number no longer suppresses permanently"

# ── M4: the lookup takes the id match unconditionally ────────────────
# "Simpler." Reports a stale call when a newer one exists under the
# email, and under-suppresses.
patch_py "$UTIL" \
  "  if (byId && byEm) {
    return new Date(byId.created_at) >= new Date(byEm.created_at) ? byId : byEm;
  }
  return byId || byEm || null;" \
  "  return byId || byEm || null;" \
  && run "M4 lookup ignores which match is more recent"

# ── M5: the bulk read keys on customer_id only ───────────────────────
# ⚠️ THE BIG ONE. Every guest order has customer_id NULL, so this
# reports "never contacted" for most of the call list while the feature
# appears to work for signed-in customers.
patch_py "$UTIL" \
  "    if (r.to_email)    out.set(\`em:\${String(r.to_email).toLowerCase()}\`, r);" \
  "" \
  && run "M5 bulk lookup drops the email key (guest orders never match)"

# ── M6: held rows are discarded instead of returned ──────────────────
# The list gets shorter and nothing says why. Indistinguishable from a
# cart that was never found.
patch_py "$JOB" "    if (s.skip) held.push({ ...row, held_because: s.reason });" \
  "    if (s.skip) { /* nothing */ }" \
  && run "M6 suppressed rows silently discarded, not held"

# ── M7: suppression applied to the EMAIL list too ────────────────────
# A phone call would then block the recovery email, which has its own
# send-once guard and a different consent basis entirely.
patch_py "$JOB" \
  "    if (why === 'ok') { email.push(r); continue; }" \
  "    if (why === 'ok') {
      const le = lastMap ? contactLog.lookup(lastMap, r) : null;
      if (!contactLog.suppression(le, now).skip) email.push(r);
      continue;
    }" \
  && run "M7 a logged call suppresses the recovery EMAIL as well"

# ── M8: logging a call also sends a 'we missed you' email ────────────
# ⚠️ THE WORST ONE. Mails exactly the people who declined marketing.
patch_py "$CTL" \
  "    return res.redirect(\`\${back}?cl_ok=\${encodeURIComponent(" \
  "    await brevo.sendTemplate('cart_recovery', order.email, {});
    return res.redirect(\`\${back}?cl_ok=\${encodeURIComponent(" \
  && run "M8 logging a call also fires an email"

# ── M9: a call is recorded as a failed send ──────────────────────────
# Every call then renders as a failure in the timeline and in the
# analytics counts.
patch_py "$CTL" "      sentOk:      true," "      sentOk:      false," \
  && run "M9 a logged call stored as sent_ok = 0"

# ── M10: the outcome list is re-typed inline ─────────────────────────
# A second copy of the list, which drifts from the shared one.
patch_py "$CTL" \
  "    if (kind === 'call' && !contactLog.isValidOutcome(outcome))" \
  "    if (kind === 'call' && !['spoke','left_voicemail'].includes(outcome))" \
  && run "M10 outcome validated against a re-typed inline list"

# ── M11: the address is not stored on a call ─────────────────────────
# Breaks the join between a call and an email for every guest order.
patch_py "$CTL" "      toEmail:    clean(order.email) || null," \
  "      toEmail:    null," \
  && run "M11 call logged with no address (guest timeline breaks)"

# ── M12: outcome dropped from the INSERT ─────────────────────────────
# Every call logs with a NULL outcome, so suppression never fires and
# the timeline shows no result for any call.
patch_py "$CTL" \
  "       fields.outcome      || null,
       fields.contactPhone || null," \
  "       fields.contactPhone || null," \
  && run "M12 outcome dropped from the INSERT (placeholder mismatch)"

# ── M13: the timeline is scoped to this order ────────────────────────
# ⚠️ THE OBVIOUS THING, AND IT DEFEATS THE FEATURE. A repeat customer
# called about their other order reads as "never contacted".
patch_py "$ORD" \
  "          email:      order.customer_email || order.guest_email || null," \
  "          email:      order.customer_email || order.guest_email || null,
          order_id:   order.id," \
  && run "M13 timeline filtered to this order only"

# ── M14: order.email, the ship_name-shaped bug ───────────────────────
# Not an error, not null — undefined. Silently degrades to customer_id
# only and reports "never contacted" for every guest order.
patch_py "$ORD" \
  "          email:      order.customer_email || order.guest_email || null," \
  "          email:      order.email || null," \
  && run "M14 reads order.email, which does not exist"

# ── M15: the empty state renders nothing ─────────────────────────────
# Blank space reads as a broken panel and gets ignored.
patch_py "$VIEW" \
  "          No contact recorded for this customer." \
  "          &nbsp;" \
  && run "M15 empty timeline renders blank instead of saying so"

# ── M16: the dropdown hardcodes its options ──────────────────────────
patch_py "$VIEW" \
  "            <% Object.keys(contactOutcomes).forEach(function (k) { %>
              <option value=\"<%= k %>\"><%= contactOutcomes[k] %></option>
            <% }); %>" \
  "            <option value=\"spoke\">Spoke</option>" \
  && run "M16 outcome dropdown hardcoded instead of shared"

# ── M17: the migration clears the table ──────────────────────────────
# "Start clean." Destroys three rows of real outreach history.
patch_py "$SQL" \
  "-- ── STEP 3: THE TWO NEW COLUMNS ────────────────────────────────────────" \
  "DELETE FROM customer_messages;
-- ── STEP 3: THE TWO NEW COLUMNS ────────────────────────────────────────" \
  && run "M17 migration deletes existing outreach history"

echo
echo "caught $caught / $((caught+missed))"
[ "$missed" -eq 0 ] || exit 1
