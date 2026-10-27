#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# mutate_unsubscribe.sh — proves gate_unsubscribe.js can fail.
#
# Each mutation is a plausible "simplification" somebody would make while
# believing they were tidying up. Every one of them breaks an unsubscribe
# in a way nobody would notice from the outside, which is precisely why
# the gate exists: a broken unsubscribe produces no error, no log line and
# no complaint — just a spam report, weeks later, against a Brevo account
# with almost no sending history.
#
# Restores from a /tmp copy, not git, so it runs on uncommitted work.
# python3 with `assert old in s`, never perl s{}{} — an unbalanced brace
# dies silently, applies nothing, and reads as a MISSED mutation.
# ─────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")/.." || exit 1

GATE="gates/gate_unsubscribe.js"
UTIL="src/utils/unsubscribeToken.js"
CTRL="src/controllers/unsubscribeController.js"
CSRF="src/middleware/csrf.js"
VIEW="views/pages/unsubscribe.ejs"
SRV="src/server.js"

BAK="$(mktemp -d)"
for f in "$UTIL" "$CTRL" "$CSRF" "$SRV" "$VIEW"; do
  mkdir -p "$BAK/$(dirname "$f")"
  cp "$f" "$BAK/$f" || { echo "cannot back up $f — aborting"; exit 2; }
done
restore() { for f in "$UTIL" "$CTRL" "$CSRF" "$SRV" "$VIEW"; do cp "$BAK/$f" "$f"; done; }
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
  if node "$GATE" >/tmp/mun.out 2>&1; then
    echo "  MISSED  $1"; missed=$((missed+1))
  else
    echo "  caught  $1  ($(grep -c 'FAIL' /tmp/mun.out) failing check(s))"
    caught=$((caught+1))
  fi
  restore
}

echo
echo "mutate_unsubscribe — planting the quiet failures"
echo

# ── M1: the GET handler starts writing ───────────────────────────────
# "Why make them click twice?" — because link scanners click once, for
# everybody, invisibly.
patch_py "$CTRL" \
  "exports.page = (req, res, next) => {
  const email = token.verify(req.query.t);" \
  "exports.page = async (req, res, next) => {
  const email = token.verify(req.query.t);
  await bvoPool.query('UPDATE customers SET accepts_marketing = 0 WHERE email = ?', [email]);" \
  && run "M1 GET unsubscribes on sight (prefetch kills consent silently)"

# ── M2: it also blocks the address at Brevo ──────────────────────────
# The #376 defect, deliberately reintroduced: kills the sign-in code too.
patch_py "$CTRL" \
  "              marketing_consent_source = 'unsubscribe_link'," \
  "              email_blocked            = 1,
              marketing_consent_source = 'unsubscribe_link'," \
  && run "M2 unsubscribe also sets email_blocked (locks them out of sign-in)"

# ── M3: timing-safe compare replaced with === ────────────────────────
# Looks identical, leaks the signature byte by byte.
patch_py "$UTIL" \
  "  if (given.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(given, expected)) return null;" \
  "  if (given.toString() !== expected.toString()) return null;" \
  && run "M3 signature compared with === (timing leak)"

# ── M4: the secret used raw, no key separation ───────────────────────
patch_py "$UTIL" \
  "  return crypto.createHmac('sha256', base).update(PURPOSE).digest();" \
  "  return base;" \
  && run "M4 SESSION_SECRET used raw (one secret, two purposes)"

# ── M5: missing secret no longer throws ──────────────────────────────
# Tokens become signed with 'undefined' — verifying nothing, loudly
# claiming to work.
patch_py "$UTIL" \
  "  if (!base) throw new Error('SESSION_SECRET is not set — cannot sign unsubscribe links');" \
  "  if (!base) return Buffer.from('fallback');" \
  && run "M5 missing SESSION_SECRET silently falls back"

# ── M6: the CSRF exemption widened to a prefix ───────────────────────
# Would silently cover anything mounted under /unsubscribe later.
patch_py "$CSRF" \
  "  if (req.path === '/unsubscribe') return next();" \
  "  if (req.path.startsWith('/unsubscribe')) return next();" \
  && run "M6 CSRF exemption widened from exact path to prefix"

# ── M7: the CSRF exemption removed ───────────────────────────────────
# Gmail's one-click button then fails silently — the customer believes
# they unsubscribed and keeps getting mail.
patch_py "$CSRF" \
  "  if (req.path === '/unsubscribe') return next();" \
  "" \
  && run "M7 CSRF exemption removed (one-click fails silently)"

# ── M8: the POST route unregistered ──────────────────────────────────
patch_py "$SRV" \
  "  app.post('/unsubscribe', unsub.submit);" \
  "" \
  && run "M8 POST /unsubscribe route removed"

# ── M9: the error swallowed ──────────────────────────────────────────
# Told they are off the list; still on it. The worst available outcome.
patch_py "$CTRL" \
  "    console.error('[unsubscribe]', err.code, err.sqlMessage || err.message);
    return next(err);" \
  "    return res.redirect('/');" \
  && run "M9 a failed unsubscribe is swallowed"

# ── M10: consent timestamp no longer stamped ─────────────────────────
# Reads later as "never asked" — and they get asked again.
patch_py "$CTRL" \
  "              marketing_consent_at     = NOW()," \
  "" \
  && run "M10 marketing_consent_at no longer stamped"

# ── M11: an unreadable token dead-ends on a 404 again ────────────────
# The original behaviour. Looks tidy, reads to a customer as "your
# unsubscribe is broken", and the next email they get is marked spam.
patch_py "$CTRL" \
  "  if (!email) {
    return res.status(400).render('pages/unsubscribe', {" \
  "  if (!email) return next();
  if (false) {
    return res.status(400).render('pages/unsubscribe', {" \
  && run "M11 unreadable token 404s instead of offering a way through"

# ── M12: the recovery page loses its contact routes ──────────────────
# A page that only apologises leaves the person stuck, which is the
# same dead end wearing nicer wording.
patch_py "views/pages/unsubscribe.ejs" \
  'Email <a href="mailto:support@bathroomvanitiesoutlet.com?subject=Unsubscribe%20request">support@bathroomvanitiesoutlet.com</a>' \
  'Please try again later.' \
  && run "M12 recovery page no longer offers a way to unsubscribe"

echo
echo "caught $caught / $((caught+missed))"
[ "$missed" -eq 0 ] || exit 1
