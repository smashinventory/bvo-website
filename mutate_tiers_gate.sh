#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# mutate_tiers_gate.sh — negative tests for gates/gate_tiers_and_trade.js
#
#   bash mutate_tiers_gate.sh
#
# Re-breaks each invariant and confirms the gate goes RED. A gate nobody has
# tried to fool is not a gate — gate_free_order_checkout PASSED on the broken
# code it was written to protect, and only the harness found it.
#
# ANCHOR RULES THIS SCRIPT ENFORCES ON ITSELF:
#   · every anchor must match EXACTLY ONCE (Rule 17a)
#   · never anchor on prose — these files document their own past defects,
#     so `Number(` and `/trade/apply` both appear inside comments (Rule 18)
# ─────────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")" || exit 1

GATE="gates/gate_tiers_and_trade.js"
TIERS="src/utils/tiers.js"
PRICING="src/utils/cartPricing.js"
CLAIM="src/services/offerClaim.js"
TRADE="src/controllers/tradeController.js"
CHECKOUT="src/controllers/checkoutController.js"
CART="src/controllers/cartController.js"
ACCOUNT="src/controllers/accountController.js"
ADMINR="src/routes/admin.js"

ALL=("$TIERS" "$PRICING" "$CLAIM" "$TRADE" "$CHECKOUT" "$CART" "$ACCOUNT" "$ADMINR")

BACKUP=$(mktemp -d) || exit 1
for f in "${ALL[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"; cp "$f" "$BACKUP/$f" || { echo "cannot back up $f"; exit 1; }
done
restore() { for f in "${ALL[@]}"; do cp "$BACKUP/$f" "$f"; done; }
trap 'restore; rm -rf "$BACKUP"' EXIT

CAUGHT=0; MISSED=0; BROKEN=0

if ! node "$GATE" >/dev/null 2>&1; then
  echo "ABORT: the gate is RED before any mutation."
  node "$GATE" 2>&1 | grep -E '^\s+FAIL' | head -20
  exit 1
fi
echo "baseline: GREEN"; echo

mutate() {
  local label="$1" file="$2" find="$3" repl="$4" expect="${5:-catch}"
  restore
  local n
  n=$(FIND="$find" python3 -c "
import os,re,sys
print(len(re.findall(os.environ['FIND'], open(sys.argv[1],encoding='utf-8').read())))
" "$file")
  if [ "$n" != "1" ]; then
    printf 'ANCHOR  %-56s matched %s times (need 1)\n' "$label" "$n"; BROKEN=$((BROKEN+1)); return
  fi
  FIND="$find" REPL="$repl" python3 -c "
import os,re,sys
s=open(sys.argv[1],encoding='utf-8').read()
s=re.sub(os.environ['FIND'], lambda m: os.environ['REPL'], s, count=1)
open(sys.argv[1],'w',encoding='utf-8').write(s)
" "$file"
  if node "$GATE" >/dev/null 2>&1; then
    if [ "$expect" = "allow" ]; then printf 'ok      %-56s correctly ALLOWED\n' "$label"; CAUGHT=$((CAUGHT+1));
    else printf 'MISSED  %-56s gate stayed GREEN\n' "$label"; MISSED=$((MISSED+1)); fi
  else
    if [ "$expect" = "allow" ]; then printf 'FALSE+  %-56s went RED on a legitimate edit\n' "$label"; MISSED=$((MISSED+1));
    else printf 'ok      %-56s caught\n' "$label"; CAUGHT=$((CAUGHT+1)); fi
  fi
}

echo "── MAP compliance — the rule JM withholds shipments over ────────────────"
mutate 'M1  logged-out check removed entirely' "$TIERS" \
  '  if \(!facts\.isLoggedIn\) return RESOLVED\.NONE;' '  ;'
mutate 'M2  logged-out check inverted' "$TIERS" \
  'if \(!facts\.isLoggedIn\) return RESOLVED\.NONE;' 'if (facts.isLoggedIn === false && false) return RESOLVED.NONE;'

echo
echo "── the ladder ───────────────────────────────────────────────────────────"
mutate 'M3  elite threshold lowered to 2000' "$TIERS" \
  'const ELITE_THRESHOLD = 20000;' 'const ELITE_THRESHOLD = 2000;'
mutate 'M4  rolling window becomes a calendar-ish 30 days' "$TIERS" \
  'const ROLLING_DAYS    = 365;' 'const ROLLING_DAYS    = 30;'
mutate 'M5  elite_trade becomes STORABLE' "$TIERS" \
  "  PLATINUM_TRADE:  'platinum_trade',\n\}\);" "  PLATINUM_TRADE:  'platinum_trade',\n  ELITE_TRADE:     'elite_trade',\n});"
# Two spaces before the 15, not one — PCT is column-aligned with LABELS.
mutate 'M6  trade rate changed to 25%' "$TIERS" \
  '  platinum_trade:  15,' '  platinum_trade:  25,'

echo
echo "── the grant — why 10% is not a blanket margin cut ──────────────────────"
mutate 'M7  first-order check removed (10% forever)' "$TIERS" \
  'return facts\.hasCapturedOrder \? RESOLVED\.NONE : RESOLVED\.PLATINUM_MEMBER;' \
  'return RESOLVED.PLATINUM_MEMBER;'
mutate 'M8  an unticked box still enrols' "$CLAIM" \
  '  if \(!optedIn\) return;' '  ;'
mutate 'M9  the claim is dropped by session.regenerate()' "$ACCOUNT" \
  '    \[offerClaim\.PENDING_KEY\]: req\.session\[offerClaim\.PENDING_KEY\],\n' ''
mutate 'M10 grant() demotes a trade account to member' "$CLAIM" \
  'const keepTier = row\.tier === tiers\.STORED\.PLATINUM_TRADE;' 'const keepTier = false;'
mutate 'M11 offer_enrolled_at re-stamped on every claim' "$CLAIM" \
  'offer_enrolled_at        = COALESCE\(offer_enrolled_at, NOW\(\)\)' \
  'offer_enrolled_at        = NOW()'

echo
echo "── replace, never stack ─────────────────────────────────────────────────"
mutate 'M12 discounts STACK (Math.max -> sum)' "$PRICING" \
  '  return Math\.max\(bundle, t\);' '  return Math.min(100, bundle + t);'

echo
echo "── a string must never become a discount ────────────────────────────────"
mutate 'M13 typeof guard replaced by coercion' "$PRICING" \
  "  const t = \(typeof tierPct === 'number' && Number\.isFinite\(tierPct\)\n             && tierPct > 0 && tierPct <= 100\) \? tierPct : 0;" \
  '  const t = (Number(tierPct) > 0 && Number(tierPct) <= 100) ? Number(tierPct) : 0;'
mutate 'M14 upper bound removed (150% off)' "$PRICING" \
  '&& tierPct > 0 && tierPct <= 100\) \? tierPct : 0;' '&& tierPct > 0) ? tierPct : 0;'

echo
echo "── the frozen rate ──────────────────────────────────────────────────────"
mutate 'M15 payment re-check resolves live instead' "$CHECKOUT" \
  'tierPct: Number\(order\.tier_pct\) \|\| 0,' 'tierPct: 0,'
mutate 'M16 tier_pct dropped from the payment SELECT' "$CHECKOUT" \
  '            tier_pct,\n' ''
mutate 'M17 order creation stops storing the rate' "$CHECKOUT" \
  '            tier_pct, tier_at_order,\n' ''
mutate 'M18 buyerTotal re-resolves instead of reading the order' "$CHECKOUT" \
  'tierPct: Number\(order && order\.tier_pct\) \|\| 0,' 'tierPct: 0,'
mutate 'M19 cart page builds its own opts' "$CART" \
  'const priceOpts = await tierService\.priceOptsFor\(req, sampleEligible\);' \
  'const priceOpts = { sampleEligible: sampleEligible };'

echo
echo "── documents must never be public ───────────────────────────────────────"
mutate 'M20 upload default moved under public/' "$TRADE" \
  "    \|\| path\.join\(__dirname, '\.\./\.\./storage/trade-docs'\);" \
  "    || path.join(__dirname, '../../public/images/uploads/trade-docs');"
mutate 'M21 original filename kept (traversal / double extension)' "$TRADE" \
  "    cb\(null, \`trade-\\\$\{Date\.now\(\)\}-\\\$\{crypto\.randomBytes\(8\)\.toString\('hex'\)\}\\\$\{ext\}\`\);" \
  '    cb(null, file.originalname);'
mutate 'M22 mimetype check dropped, extension only' "$TRADE" \
  'if \(ALLOWED_EXT\.has\(ext\) && ALLOWED_MIME\.has\(file\.mimetype\)\) return cb\(null, true\);' \
  'if (ALLOWED_EXT.has(ext)) return cb(null, true);'
mutate 'M23 path confinement removed from adminDoc' "$TRADE" \
  'if \(!resolved\.startsWith\(path\.resolve\(docsDir\(\)\)\)\) \{' 'if (false) {'
mutate 'M24 documents served inline instead of as attachments' "$TRADE" \
  "res\.setHeader\('Content-Disposition', 'attachment; filename=\"' \+ path\.basename\(resolved\) \+ '\"'\);" \
  "res.setHeader('Content-Disposition', 'inline');"
mutate 'M25 orphan uploads no longer deleted' "$TRADE" \
  'function discard\(files\) \{' 'function discard_UNUSED(files) {'

echo
echo "── applying is not approval ─────────────────────────────────────────────"
mutate 'M26 server-side terms check removed' "$TRADE" \
  "    if \(!b\.terms_ack\) errors\.push\('You must read and accept the trade terms\.'\);" '    ;'
mutate 'M27 marketing consent made mandatory for trade' "$TRADE" \
  '    const acceptsMkt   = b\.accepts_marketing \? 1 : 0;' \
  '    const acceptsMkt   = b.accepts_marketing ? 1 : 0;\n    if (!acceptsMkt) errors.push("Marketing consent is required.");'
mutate 'M28 admin granted the power to set elite_trade' "$TRADE" \
  '\[tiers\.STORED\.PLATINUM_TRADE, app\.customer_id\]' \
  "['elite_trade', app.customer_id]"
mutate 'M29 tax ID demanded from every applicant' "$TRADE" \
  '    if \(wantsTaxEx && !taxId\) \{' '    if (!taxId) {'

echo
echo "── controls: legitimate edits must NOT go red ───────────────────────────"
mutate 'C1  a comment reworded' "$TIERS" \
  'THE LADDER \(TRADE_PROGRAM_SPEC\.md §1, owner 2026-10-21\)\.' \
  'THE LADDER (see TRADE_PROGRAM_SPEC.md section 1).' allow
mutate 'C2  member rate copy unchanged, label reworded' "$TIERS" \
  "  platinum_member: 'Platinum Member'," "  platinum_member: 'Platinum Member '," allow

echo
echo "═════════════════════════════════════════════════════════════════════════"
echo "caught/allowed: $CAUGHT    missed: $MISSED    bad anchors: $BROKEN"
if [ "$MISSED" -ne 0 ] || [ "$BROKEN" -ne 0 ]; then
  echo "RESULT: the gate has holes, or these anchors are stale. Both need fixing."
  exit 1
fi
echo "RESULT: every mutation handled as intended."
