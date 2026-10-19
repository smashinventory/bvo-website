#!/usr/bin/env bash
# mutate_customer_outreach.sh
#
# Proves gate_customer_outreach.js can FAIL. A gate only ever observed
# passing has not been shown to detect anything — and this project has
# already shipped two gates with blind spots (gate_no_inline_handlers
# scanned markup only; its comment-stripping ran in the wrong order).
#
# For each mutation: back the file up, break it in one specific way, assert
# the gate goes RED, restore, and verify the restore is byte-identical.
#
# ⚠️ It edits real source files. It restores them in a trap, so a Ctrl-C or
# a crash mid-run cannot leave a mutation behind. If it ever does, the
# checksum report at the end will say so loudly.

set -uo pipefail
cd "$(dirname "$0")"

GATE="node gates/gate_customer_outreach.js"

OE="src/services/orderEmails.js"
OUT="src/controllers/customerOutreachController.js"
CHK="src/controllers/checkoutController.js"
CUST="src/models/Customer.js"
ROUTES="src/routes/admin.js"
DET="views/pages/admin/orders/detail.ejs"
MIG="migrations/2026-10-19_customer_outreach_RUNME.sql"

FILES=("$OE" "$OUT" "$CHK" "$CUST" "$ROUTES" "$DET" "$MIG")
BK=".mutate_outreach_backup"

rm -rf "$BK"; mkdir -p "$BK"
for f in "${FILES[@]}"; do
  mkdir -p "$BK/$(dirname "$f")"
  cp "$f" "$BK/$f"
done

restore_all() {
  for f in "${FILES[@]}"; do cp "$BK/$f" "$f"; done
}
trap 'echo; echo "  !! interrupted — restoring"; restore_all; exit 130' INT TERM

PASSED=0; MISSED=0; N=0

# Baseline. If the gate is not green to begin with, every "the gate went
# red" below is meaningless.
echo
echo "mutate_customer_outreach — can the gate fail?"
echo
if ! $GATE >/dev/null 2>&1; then
  echo "  ✗ BASELINE IS RED. Fix the gate before mutation-testing it:"
  $GATE 2>&1 | grep -E "^  FAIL" | head -20
  restore_all; rm -rf "$BK"; exit 1
fi
echo "  baseline: gate is green"
echo

# mutate <file> <description> <python-expression-pairs...>
# Uses python for exact literal replacement — sed would need every regex
# metacharacter in the JS escaped, and one missed backslash is a mutation
# that silently does nothing, which reports as a MISS and sends someone
# hunting a gate bug that is not there.
mutate() {
  local file="$1" desc="$2" from="$3" to="$4"
  N=$((N+1))

  python3 - "$file" "$from" "$to" <<'PY'
import sys
path, frm, to = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(path, encoding='utf-8').read()
if frm not in s:
    sys.stderr.write('ANCHOR-NOT-FOUND\n'); sys.exit(2)
open(path, 'w', encoding='utf-8').write(s.replace(frm, to, 1))
PY
  local rc=$?

  if [ $rc -ne 0 ]; then
    # An anchor that no longer exists is a BROKEN TEST, not a passing one.
    # This is the failure mode that produced a false "miss" on mutation 7
    # of the inline-handler harness.
    echo "  ⚠ $N. $desc — ANCHOR NOT FOUND, mutation did not apply (fix this test)"
    MISSED=$((MISSED+1))
    cp "$BK/$file" "$file"
    return
  fi

  if $GATE >/dev/null 2>&1; then
    echo "  ✗ $N. MISSED: $desc"
    MISSED=$((MISSED+1))
  else
    echo "  ✓ $N. caught: $desc"
    PASSED=$((PASSED+1))
  fi
  cp "$BK/$file" "$file"
}

# ── 1. the no-op proof ─────────────────────────────────────────────────
# One word of the receipt copy. This is the whole point of the extraction
# check: the email the customer reads must not change by accident.
mutate "$OE" "receipt copy reworded (one word)" \
  "Want delivery updates and tracking?" \
  "Want delivery updates and shipping?"

# The money formatter. A silent change here mis-states totals.
mutate "$OE" "money formatter loses its decimals" \
  "minimumFractionDigits: 2, maximumFractionDigits: 2" \
  "minimumFractionDigits: 0, maximumFractionDigits: 2"

# HTML escaping. Dropping it is an injection, and the no-op check sees it
# because the fixture carries < > & " in a product name.
mutate "$OE" "HTML escaping dropped from item names" \
  ".replace(/&/g, '&amp;').replace(/</g, '&lt;')" \
  ".replace(/&/g, '\&amp;')"

# The TTL require path — the mistake actually made while writing this.
mutate "$OE" "emailVerify required from the wrong path" \
  "require('./emailVerificationService')" \
  "require('../utils/emailVerify')"

# ── 2. resend() must read the result ──────────────────────────────────
# THE defect this gate exists for: awaiting a call that resolves
# { ok:false } and reporting success anyway.
mutate "$OE" "resend reports ok without reading the result" \
  "if (r && r.ok) return { ok: true, to, messageId: r.messageId || null };" \
  "return { ok: true, to, messageId: null };"

mutate "$OE" "blocklist check removed" \
  "if (await brevo.isBlocked(to)) {" \
  "if (false) {"

mutate "$OE" "a skipped send counts as sent" \
  "if (r && r.skipped) {" \
  "if (r && r.skipped && false) {"

# ── 3. send() must stay fire-and-forget ───────────────────────────────
mutate "$OE" "send() becomes awaitable (returns the promise)" \
  "  brevo.sendTemplate('order_confirmed', order.guest_email, vars, toName)
    .catch(err => console.error('[checkout] confirmation email failed for'," \
  "  return brevo.sendTemplate('order_confirmed', order.guest_email, vars, toName)
    .catch(err => console.error('[checkout] confirmation email failed for',"

# ── 4. the merge must re-point every table ────────────────────────────
# The FKs cascade, so this is silent data loss: fixing a typo in someone's
# email address would quietly wipe their saved products.
mutate "$OUT" "merge forgets favorites (cascade would delete them)" \
  "await conn.query('UPDATE favorites          SET customer_id = ? WHERE customer_id = ?', [keepId, mergeId]);" \
  "/* removed */"

mutate "$OUT" "merge forgets the customer's own messages" \
  "await conn.query('UPDATE customer_messages  SET customer_id = ? WHERE customer_id = ?', [keepId, mergeId]);" \
  "/* removed */"

mutate "$OUT" "merge audit trail removed" \
  "INSERT INTO customer_merges" \
  "INSERT INTO nothing_at_all"

mutate "$OUT" "order row no longer locked during the correction" \
  "WHERE id = ? FOR UPDATE" \
  "WHERE id = ?"

# ── 5. nothing sends without logging ─────────────────────────────────
# ⚠️ A SHORT ANCHOR, on purpose. The first version of this test pasted the
# whole logMessage call in as the anchor — and it contained BACKTICKS, which
# bash ate inside the double-quoted argument before python ever saw them.
# The anchor never matched, the mutation never applied, and it reported as
# ANCHOR-NOT-FOUND rather than as a silent pass. Anchors here stay short and
# backtick-free.
mutate "$OUT" "the resend send path stops logging" \
  "  await logMessage({
    customerId:  order.customer_id || null," \
  "  if (false) await logMessage({
    customerId:  order.customer_id || null,"

# ── the checkbox trap ────────────────────────────────────────────────
mutate "$OUT" "resend opt-out tests for !== '0' (an absent checkbox)" \
  "if (String(req.body.resend) !== '1')" \
  "if (String(req.body.resend) === '0')"

# ── 6. single source for the receipt ─────────────────────────────────
mutate "$CHK" "the receipt HTML reappears in checkoutController" \
  "function sendConfirmation(order, items, confirmToken) {" \
  "function sendConfirmation(order, items, confirmToken) {
  /* Want delivery updates and tracking? */"

# ── 7. wiring ────────────────────────────────────────────────────────
mutate "$ROUTES" "resend-receipt route unregistered" \
  "router.post('/orders/:id/resend-receipt',           outreachCtrl.resendReceipt);" \
  "/* removed */"

mutate "$ROUTES" "merge-preview route unregistered" \
  "router.get ('/marketing/customers/:id/merge-preview', outreachCtrl.mergePreview);" \
  "/* removed */"

# The CSP trap: a submit handler on a BUTTON never fires, because the
# submit event targets the form. Silently unguarded POST.
mutate "$DET" "data-on=submit moved onto the button" \
  "          <button class=\"btn btn-outline btn-sm\" type=\"submit\"" \
  "          <button class=\"btn btn-outline btn-sm\" type=\"submit\" data-act=\"noop\" data-on=\"submit\""

# ── 8. the phone copy — the gap that started all this ────────────────
# ⚠️ COMMENTED OUT, not deleted — which is how a real regression arrives,
# and which the first version of the gate did not catch: the call it was
# grepping for was sitting right there inside the comment.
mutate "$CHK" "phone copy commented out (not deleted)" \
  "    Customer.setPhoneIfMissing(orderCustomerId, phone)" \
  "    void 0; // Customer.setPhoneIfMissing(orderCustomerId, phone)"

mutate "$CUST" "setPhoneIfMissing loses its WHERE-clause guard" \
  "          AND (phone IS NULL OR phone = '')" \
  "          /* unguarded */"

# ── 9. the migration ─────────────────────────────────────────────────
mutate "$MIG" "customer_messages cascades away with its order" \
  "REFERENCES \`orders\` (\`id\`) ON DELETE SET NULL" \
  "REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE"

mutate "$MIG" "the backfill concatenates the phone extension" \
  "         SELECT MIN(o.\`ship_phone\`)" \
  "         SELECT MIN(CONCAT(o.\`ship_phone\`, ' x', o.\`ship_phone_ext\`))"

mutate "$MIG" "customer_messages table not created" \
  "CREATE TABLE IF NOT EXISTS \`customer_messages\`" \
  "CREATE TABLE IF NOT EXISTS \`customer_messages_renamed\`"

# ── restore and verify ───────────────────────────────────────────────
restore_all
trap - INT TERM

echo
DIRTY=0
for f in "${FILES[@]}"; do
  if ! cmp -s "$f" "$BK/$f"; then
    echo "  ✗ NOT RESTORED: $f"
    DIRTY=1
  fi
done
[ $DIRTY -eq 0 ] && echo "  ✓ all ${#FILES[@]} files restored byte-identical"

# And the gate must be green again, which is the real proof the restore
# worked — a byte-identical file that somehow fails the gate would mean the
# gate depends on something this harness did not back up.
if $GATE >/dev/null 2>&1; then
  echo "  ✓ gate green again after restore"
else
  echo "  ✗ GATE STILL RED AFTER RESTORE — something was not backed up"
  DIRTY=1
fi

rm -rf "$BK"

echo
echo "  $N mutations — $PASSED caught, $MISSED missed"
echo
if [ $MISSED -gt 0 ] || [ $DIRTY -ne 0 ]; then exit 1; fi
exit 0
