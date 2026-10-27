#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# mutate_cart_recovery.sh — proves gate_cart_recovery.js can fail.
#
# Every mutation is something somebody would do believing it an
# improvement. Each one either mails a person who said no, mails somebody
# twice, mails somebody who already paid, or quietly drops a cart nobody
# then follows up. None produces an error.
#
# Restores from a /tmp copy, not git, so it runs on uncommitted work.
# python3 with `assert old in s`, never perl s{}{} — an unbalanced brace
# dies silently, applies nothing, and reads as a MISSED mutation.
# ─────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")/.." || exit 1

GATE="gates/gate_cart_recovery.js"
JOB="src/jobs/cartRecovery.js"
TPL="migrations/2026-10-27_cart_recovery_template_RUNME.sql"
SH="cart_recovery.sh"

BAK="$(mktemp -d)"
for f in "$JOB" "$TPL" "$SH"; do
  mkdir -p "$BAK/$(dirname "$f")"
  cp "$f" "$BAK/$f" || { echo "cannot back up $f — aborting"; exit 2; }
done
restore() { for f in "$JOB" "$TPL" "$SH"; do cp "$BAK/$f" "$f"; done; }
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
  if node "$GATE" >/tmp/mcr.out 2>&1; then
    echo "  MISSED  $1"; missed=$((missed+1))
  else
    echo "  caught  $1  ($(grep -c 'FAIL' /tmp/mcr.out) failing check(s))"
    caught=$((caught+1))
  fi
  restore
}

echo
echo "mutate_cart_recovery — planting the sends nobody would notice"
echo

# ── M1: the declined are emailed after all ───────────────────────────
# The order-23 defect: she ticked no one minute before abandoning.
patch_py "$JOB" "  declined:    false," "  declined:    true," \
  && run "M1 people who DECLINED marketing are emailed"

# ── M2: never-asked silently folded in with the consenting ───────────
# Defensible as a decision; not defensible as a silent one.
patch_py "$JOB" "  never_asked: false," "  never_asked: true," \
  && run "M2 never-asked emailed without the switch being read"

# ── M3: the consent distinction collapses ────────────────────────────
# "Declined" and "never asked" become one thing, so the fixable gap in
# the checkout becomes invisible.
patch_py "$JOB" \
  "    const why = row.marketing_consent_at ? 'declined' : 'never_asked';" \
  "    const why = 'declined';" \
  && run "M3 declined and never-asked collapsed into one reason"

# ── M4: a blocked address is emailed because it has consent ──────────
patch_py "$JOB" \
  "  if (Number(row.email_blocked) === 1) return 'blocked';" \
  "" \
  && run "M4 blocked addresses emailed when consent is present"

# ── M5: the payment filter goes ──────────────────────────────────────
# Now it emails "did you forget something?" to people who have paid.
patch_py "$JOB" \
  "        AND (o.payment_status IS NULL OR o.payment_status IN ('draft','pending'))" \
  "" \
  && run "M5 paid orders treated as abandoned carts"

# ── M6: the send-once guard goes ─────────────────────────────────────
patch_py "$JOB" "        AND o.recovery_emailed_at IS NULL" "" \
  && run "M6 send-once guard removed (hourly cron, hourly email)"

# ── M7: the upper age bound goes ─────────────────────────────────────
# First run after deploy mails every abandoned cart in history at once.
patch_py "$JOB" \
  "        AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)" "" \
  && run "M7 no upper age bound (first run mails the entire history)"

# ── M8: stamp before send ────────────────────────────────────────────
# A failed send is then never retried, and the customer is skipped
# forever with no trace.
patch_py "$JOB" \
  "      await brevo.sendTemplate(TEMPLATE_KEY, r.email, {" \
  "      await pool().query('UPDATE orders SET recovery_emailed_at = NOW() WHERE id = ?', [r.id]);
      await brevo.sendTemplate(TEMPLATE_KEY, r.email, {" \
  && run "M8 row stamped BEFORE the send resolves"

# ── M9: the offer link points at the sale page ───────────────────────
# Promises a 10% that offerClaim.js will refuse, because that page
# enrols nobody.
patch_py "$JOB" \
  "'https://www.bathroomvanitiesoutlet.com/account/login?offer=platinum&optin=1'," \
  "'https://www.bathroomvanitiesoutlet.com/collections/sale'," \
  && run "M9 offer link points at a page that enrols nobody"

# ── M10: the unsubscribe link is dropped ─────────────────────────────
patch_py "$JOB" "        unsubscribe_url:     unsubToken.url(r.email) || ''," "" \
  && run "M10 commercial email sent with no unsubscribe link"

# ── M11: the template arrives ACTIVE ─────────────────────────────────
# Live the instant it is inserted, before anybody reads it.
patch_py "$TPL" \
  "  ),
  0
);" \
  "  ),
  1
);" \
  && run "M11 template inserted already active"

# ── M12: the call list is dropped ────────────────────────────────────
# The excluded simply vanish — no error, no list, no follow-up, and the
# $2,195 cart is never called.
patch_py "$JOB" \
  "    else call.push({ ...r, excluded_because: why });" \
  "    else continue;" \
  && run "M12 excluded carts silently dropped instead of listed"

# ── M13: the curbside paragraph comes back ───────────────────────────
# Removed by owner decision 2026-10-27. Somebody re-adding it "because
# it is honest" should fail the gate and have the conversation again,
# not ship it quietly.
patch_py "$TPL" \
  "    '<p><strong>One more thing.</strong> Our free Platinum Member program takes '," \
  "    '<div>A note on delivery: your vanity arrives curbside on a liftgate.</div>',
    '<p><strong>One more thing.</strong> Our free Platinum Member program takes '," \
  && run "M13 curbside paragraph re-added to the template body"

# ── M14: the specialist block removed ────────────────────────────────
# Leaves the email with no human offer of help at all — a button, a
# discount, and nobody to ask.
patch_py "$TPL" \
  "      '<p style=\"margin:0 0 8px\"><strong>Not sure? Talk to a bathroom specialist.</strong></p>'," \
  "" \
  && run "M14 the specialist block removed"

# ── M15: an unsubstantiated volume claim added ───────────────────────
# BVO had four orders when this was written.
patch_py "$TPL" \
  "      '<p style=\"margin:0\">Choosing a vanity is easier with someone who sees them every day. '," \
  "      '<p style=\"margin:0\">We have helped thousands of customers. '," \
  && run "M15 'thousands of customers' claim added back"

# ── M16: hour 24, which cron can never match ─────────────────────────
# Reads as "until midnight" and is a real off-by-one somebody would
# make. date +%-H never returns 24, so with FROM=24 the job silently
# never sends again — and the log fills with plausible skip lines.
patch_py "$SH" "SEND_FROM_HOUR=12" "SEND_FROM_HOUR=24" \
  && run "M16 window starts at hour 24 (can never match)"

# ── M17: the window is computed and then ignored ─────────────────────
# The assignments stay, the comments stay, the guard goes. Reads
# entirely correct to anybody skimming the top of the file.
patch_py "$SH" \
  'if [ "$IN_WINDOW" -eq 0 ]; then' \
  'if false; then' \
  && run "M17 IN_WINDOW computed but never acted on"

# ── M18: the skip goes silent ────────────────────────────────────────
# Defensible as "stop spamming the log 12 times a day". It also makes a
# job that has been dead for a month look exactly like a quiet month.
patch_py "$SH" \
  '  echo "$(stamp) ── outside sending window (${SEND_FROM_HOUR}-${SEND_TO_HOUR} UTC), skipping ──" >> "$LOG"' \
  '  :' \
  && run "M18 out-of-window skip not logged"

# ── M19: --dry-run subjected to the window ───────────────────────────
# Tidier-looking, and it makes the dry run — the only safe way to test
# this job — unusable for half the day.
patch_py "$SH" \
  '  *" --dry-run "*) IN_WINDOW=1 ;;' \
  '' \
  && run "M19 --dry-run no longer exempt from the window"

# ── M20: the hourly cron line replaced with a daily one ──────────────
# The header is the only place the schedule is written down. Documenting
# `0 14 * * *` while the file narrows 12-23 means whoever sets the cron
# up next creates a job that fires once, inside a window, and looks fine.
patch_py "$SH" \
  "#   0 * * * *  /bin/bash" \
  "#   0 14 * * *  /bin/bash" \
  && run "M20 header documents a daily cron, not the hourly one"

echo
echo "caught $caught / $((caught+missed))"
[ "$missed" -eq 0 ] || exit 1
