#!/bin/bash
# Negative test for gate_vendor_assets.js. Each mutation reintroduces the exact
# failure mode of 2026-10-14 (a CDN asset that can vanish without warning) or
# the latent strict-dynamic one, and asserts the gate catches it.
set -uo pipefail
cd "$(dirname "$0")"
GATE=gates/gate_vendor_assets.js
JMV=views/pages/admin/marketing/jmv-reports.ejs
PE=views/pages/admin/page-edit.ejs
CHART=public/js/vendor/chart.umd.4.4.1.js
FILES=("$JMV" "$PE" "$CHART")

TMP=$(mktemp -d)
for f in "${FILES[@]}"; do cp "$f" "$TMP/$(echo "$f" | tr '/' '_')" || { echo "BACKUP FAILED: $f"; exit 1; }; done
restore() { for f in "${FILES[@]}"; do cp "$TMP/$(echo "$f" | tr '/' '_')" "$f" || { echo "RESTORE FAILED: $f"; exit 1; }; done; }

node "$GATE" >/dev/null 2>&1 || { echo "BASELINE RED"; node "$GATE" | tail -20; restore; rm -rf "$TMP"; exit 1; }
echo "baseline: gate passes on unmodified code"; echo

PASS=0; MISS=0
mutate() {
  local label="$1" file="$2" py="$3"
  python3 -I -c "
import io,sys
p=r'''$file'''
s=io.open(p,encoding='utf-8').read()
before=s
$py
if s==before:
    sys.stderr.write('MUTATION DID NOT APPLY\n'); sys.exit(2)
io.open(p,'w',encoding='utf-8').write(s)
" 2>/tmp/mut_va.err
  if [ $? -ne 0 ]; then
    echo "  SETUP-FAIL  $label"; sed 's/^/              /' /tmp/mut_va.err; MISS=$((MISS+1)); restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then echo "  MISSED      $label"; MISS=$((MISS+1));
  else echo "  caught      $label"; PASS=$((PASS+1)); fi
  restore
}

echo "──── the 2026-10-14 failure, reintroduced ────"
mutate "Chart.js points back at cdnjs" "$JMV" \
  "s=s.replace('/js/vendor/chart.umd.4.4.1.js', 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js')"

mutate "Chart.js moved to jsdelivr instead" "$JMV" \
  "s=s.replace('/js/vendor/chart.umd.4.4.1.js', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js')"

mutate "Quill points back at cdnjs" "$PE" \
  "s=s.replace('/js/vendor/quill.1.3.7.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js')"

mutate "a new library arrives from unpkg" "$JMV" \
  "s=s.replace('<script nonce=\"<%= cspNonce %>\" src=\"/js/vendor/chart.umd.4.4.1.js\"></script>', '<script nonce=\"<%= cspNonce %>\" src=\"/js/vendor/chart.umd.4.4.1.js\"></script>\n<script nonce=\"<%= cspNonce %>\" src=\"https://unpkg.com/dayjs@1/dayjs.min.js\"></script>')"

echo
echo "──── the vendored file itself ────"
mutate "vendored Chart.js truncated to a stub" "$CHART" \
  "s='// placeholder\n'"

mutate "vendored Chart.js swapped for a different major" "$CHART" \
  "s=s.replace('Chart.js v4.4.1', 'Chart.js v3.9.1')"

echo
echo "──── strict-dynamic ────"
mutate "nonce dropped from the Chart.js tag" "$JMV" \
  "s=s.replace('<script nonce=\"<%= cspNonce %>\" src=\"/js/vendor/chart.umd.4.4.1.js\">', '<script src=\"/js/vendor/chart.umd.4.4.1.js\">')"

mutate "nonce dropped from the chart init block" "$JMV" \
  "s=s.replace('<script nonce=\"<%= cspNonce %>\">', '<script>', 1)"

echo
echo "──── restore verification ────"
BAD=0
for f in "${FILES[@]}"; do cmp -s "$f" "$TMP/$(echo "$f" | tr '/' '_')" || { echo "  NOT RESTORED: $f"; BAD=1; }; done
[ "$BAD" = "0" ] && echo "  all ${#FILES[@]} files byte-identical to their backups"
node "$GATE" >/dev/null 2>&1 || { echo "  GATE RED AFTER RESTORE"; BAD=1; }
[ "$BAD" = "0" ] && echo "  gate green again after restore"
rm -rf "$TMP"
echo
TOTAL=$((PASS+MISS))
echo "mutations: $PASS/$TOTAL caught"
if [ "$MISS" != "0" ] || [ "$BAD" != "0" ]; then echo "RESULT: the gate has holes — do not ship."; exit 1; fi
echo "RESULT: every mutation caught, tree clean."
