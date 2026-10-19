#!/usr/bin/env bash
# mutate_newsletter_signups.sh — proves gate_newsletter_signups can fail.
#
# The bug being guarded went unnoticed for three months behind a catch, and
# for seven more weeks behind a log line nobody read. A gate for it that has
# only ever been seen passing would be the third layer of the same problem.

set -uo pipefail
cd "$(dirname "$0")"

GATE="gates/gate_newsletter_signups.js"

CTRL="src/controllers/accountController.js"
BREVO="src/services/brevoService.js"
MIG="migrations/2026-10-19_newsletter_signups_RUNME.sql"
REC="scripts/recoverNewsletterSignups.js"
FILES=("$CTRL" "$BREVO" "$MIG" "$REC")

TMP=$(mktemp -d)
for f in "${FILES[@]}"; do
  cp "$f" "$TMP/$(echo "$f" | tr '/' '_')" || { echo "BACKUP FAILED: $f"; exit 1; }
done
restore() {
  for f in "${FILES[@]}"; do cp "$TMP/$(echo "$f" | tr '/' '_')" "$f"; done
}

# ⚠️ RESTORE ON INTERRUPTION. mutate_order_delete.sh had no trap and a
# timeout left a deliberately-broken file in the working tree — twice, on
# 2026-10-19. Never again by default.
trap 'echo; echo "  !! INTERRUPTED — restoring"; restore; rm -rf "$TMP"; exit 130' INT TERM

PASS=0; MISS=0

if ! node "$GATE" >/dev/null 2>&1; then
  echo "BASELINE IS RED — fix the gate before mutation-testing it."
  node "$GATE" 2>&1 | grep FAIL | head
  restore; rm -rf "$TMP"; exit 1
fi
echo
echo "mutate_newsletter_signups — can the gate fail?"
echo
echo "  baseline: green"
echo

mutate() {
  local label="$1" file="$2" py="$3"
  python3 -I -c "
import io,sys
p=r'''$file'''
s=io.open(p,encoding='utf-8').read()
before=s
$py
if s==before:
    sys.stderr.write('ANCHOR NOT FOUND\n'); sys.exit(2)
io.open(p,'w',encoding='utf-8').write(s)
" 2>/tmp/mut_nl.err
  if [ $? -ne 0 ]; then
    echo "  SETUP-FAIL  $label (the anchor has drifted — fix this test)"
    MISS=$((MISS+1)); restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    echo "  MISSED      $label"; MISS=$((MISS+1))
  else
    echo "  caught      $label"; PASS=$((PASS+1))
  fi
  restore
}

echo "──── the table ────"
mutate "the unique index on email is dropped" "$MIG" \
  "s=s.replace('UNIQUE KEY \`uniq_email\` (\`email\`),', 'KEY \`uniq_email\` (\`email\`),')"

mutate "brevo_synced_at is never created" "$MIG" \
  "s=s.replace('\`brevo_synced_at\` DATETIME      NULL,', '')"

mutate "the handler writes a column the migration does not define" "$CTRL" \
  "s=s.replace('INSERT IGNORE INTO newsletter_signups (email, source, created_at)', 'INSERT IGNORE INTO newsletter_signups (email, source, signed_up_at)')"

mutate "the recovered address is dropped from the migration" "$MIG" \
  "s=s.replace('h.melotto@melottogroup.com', 'nobody@example.com')"

echo
echo "──── order of operations ────"
mutate "Brevo is called before the row is stored" "$CTRL" \
  "i=s.index('let stored = false;'); j=s.index('if (stored) {'); s=s[:i]+'const r0 = await brevo.upsertContact(email);\n'+s[i:]"

mutate "the row is pushed even when the insert failed" "$CTRL" \
  "s=s.replace('if (stored) {', 'if (true) {')"

echo
echo "──── the Brevo list id ────"
mutate "a missing list id is treated as success" "$BREVO" \
  "s=s.replace('if (!Number.isInteger(listId) || listId < 1) {', 'if (false) {')"

mutate "the list id is hardcoded instead of read from the env" "$BREVO" \
  "s=s.replace('process.env.BREVO_NEWSLETTER_LIST_ID', '2')"

mutate "updateEnabled is dropped, so repeat signups 400" "$BREVO" \
  "s=s.replace('updateEnabled: true,', '')"

echo
echo "──── the logging that found this ────"
mutate "the ER_NO_SUCH_TABLE branch is removed" "$CTRL" \
  "s=s.replace(\"if (err.code === 'ER_NO_SUCH_TABLE') {\", 'if (false) {')"

mutate "a failed Brevo sync goes quiet again" "$CTRL" \
  "s=s.replace(\"console.error('[account] newsletter: Brevo sync failed for', email,\", \"void (0 &&\")"

mutate "an empty catch creeps back into the newsletter handler" "$CTRL" \
  "s=s.replace(\"    ).then(() => { stored = true; })\", \"    ).catch(() => {}).then(() => { stored = true; })\")"

mutate "an empty catch creeps back elsewhere in the controller" "$CTRL" \
  "s=s.replace(\"  authCode.purgeExpired().catch(e =>\n    console.error('[account] auth-code purge failed:', e && (e.code || e.message)));\", '  authCode.purgeExpired().catch(() => {});')"

echo
echo "──── the recovery script ────"
mutate "recovery writes without --execute" "$REC" \
  "s=s.replace(\"const EXECUTE = process.argv.includes('--execute');\", 'const EXECUTE = true;')"

mutate "recovery stops refusing when the table is missing" "$REC" \
  "s=s.replace('REFUSING: newsletter_signups does not exist.', 'warning: table missing')"

mutate "recovered rows are logged as organic homepage signups" "$REC" \
  "s=s.replace(\"VALUES (?, 'recovered', ?)\", \"VALUES (?, 'homepage', ?)\")"

mutate "recovery overwrites live rows" "$REC" \
  "s=s.replace('INSERT IGNORE INTO newsletter_signups', 'REPLACE INTO newsletter_signups')"

mutate "recovery quietly pushes the stale list to Brevo" "$REC" \
  "s=s.replace('NOT synced to Brevo', 'synced to Brevo').replace('brevo_synced_at IS NULL)','brevo_synced_at set)')"

mutate "the unrecoverable window stops being mentioned" "$REC" \
  "s=s.replace('2026-09-02', '2026-07-23').replace('gone for good', 'probably fine')"

mutate "a future-dated log line is accepted" "$REC" \
  "s=s.replace('if (d.getTime() > Date.now() + 60_000) return null;', '')"

echo
echo "──── restore verification ────"
restore
trap - INT TERM
BAD=0
for f in "${FILES[@]}"; do
  cmp -s "$f" "$TMP/$(echo "$f" | tr '/' '_')" || { echo "  NOT RESTORED: $f"; BAD=1; }
done
[ "$BAD" = "0" ] && echo "  all ${#FILES[@]} files byte-identical to their backups"
node "$GATE" >/dev/null 2>&1 && echo "  gate green again after restore" \
  || { echo "  GATE RED AFTER RESTORE — the tree is dirty"; BAD=1; }
rm -rf "$TMP"

echo
TOTAL=$((PASS+MISS))
echo "  mutations: $PASS/$TOTAL caught"
echo
[ "$MISS" != "0" ] || [ "$BAD" != "0" ] && exit 1
exit 0
