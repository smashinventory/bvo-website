#!/usr/bin/env bash
# Negative tests for gate_social_share.js. Each mutation restores one of the
# three real bugs, or breaks a guarantee the partial makes.
set -u
cd "$(dirname "$0")"
BK=$(mktemp -d)
cp views/partials/social-share.ejs views/partials/footer.ejs \
   views/pages/product.ejs public/css/site-bundle.css views/pages/cart.ejs "$BK/"
restore() {
  cp "$BK/social-share.ejs" views/partials/social-share.ejs
  cp "$BK/footer.ejs"       views/partials/footer.ejs
  cp "$BK/product.ejs"      views/pages/product.ejs
  cp "$BK/site-bundle.css"  public/css/site-bundle.css
  cp "$BK/cart.ejs"         views/pages/cart.ejs
}
trap restore EXIT
bad=0
try() {
  local label="$1"; shift
  "$@" >/dev/null 2>&1
  if node gates/gate_social_share.js >/dev/null 2>&1; then
    echo "  BAD   gate still GREEN after: $label"; bad=$((bad+1))
  else
    echo "  good  gate went RED  after: $label"
  fi
  restore
}

# 1. BUG 1 BACK: gate a share button on owning a profile
m1() { perl -0pi -e 's{(<a href="https://www\.linkedin\.com/sharing)}{<% if (settings.social.linkedin_url) \{ %>\n    $1}' views/partials/social-share.ejs; }
# 2. BUG 2 BACK: an Instagram follow link inside the share bar
m2() { perl -0pi -e 's{(  </div>\n</div>\n<% \} %>)}{  <a href="https://instagram.com/bvoutlet" class="social-icon-btn social-share-btn" aria-label="Follow us on Instagram">x</a>\n$1}' views/partials/social-share.ejs; }
# 3. BUG 3 BACK: footer follow links wear the share class again
m3() { perl -0pi -e 's/social-follow-btn/social-share-btn/g' views/partials/footer.ejs; }
# 4. the bar gets written inline again instead of included
m4() { perl -0pi -e 's{(<%- include\(.\.\./partials/social-share.)}{<div class="social-share-bar" aria-label="x"></div>\n    $1}' views/pages/product.ejs; }
# 5. a share link loses noopener on target=_blank
m5() { perl -0pi -e 's/rel="nofollow noopener noreferrer"/rel="nofollow"/' views/partials/social-share.ejs; }
# 10. the sr-only link text is replaced by an aria-label — the exact regression
#     gate_icon_link_text exists to stop, and the one that leaves a crawler with
#     no link text at all.
m10() { perl -0pi -e 's{<span class="sr-only">Share on Facebook</span>}{}' views/partials/social-share.ejs
        perl -0pi -e 's{(class="social-icon-btn social-share-btn social-icon-btn--facebook")}{$1 aria-label="Share on Facebook"}' views/partials/social-share.ejs; }
# 6. the neutral CSS class reverts to the misleading name
m6() { perl -0pi -e 's/\.social-icon-btn\{/.social-share-btn{/' public/css/site-bundle.css; }
# 7. the bar renders even with nothing to share
m7() { perl -0pi -e 's/<% if \(_ssUrl\) \{ %>/<% if (true) { %>/' views/partials/social-share.ejs; }
# 8. share buttons land on the cart page
m8() { printf '\n<%%- include("../partials/social-share", { shareLabel: "Share" }) %%>\n' >> views/pages/cart.ejs; }
# 9. THE STRIPPER MUST NOT BLIND THE GATE: put a real violation on the same
#    line as a comment, so a sloppy stripper would swallow it too.
m9() { perl -0pi -e 's{(<a href="https://www\.facebook\.com/sharer)}{<%# note %> <a href="https://instagram.com/bvoutlet" class="social-share-btn">x</a>\n    $1}' views/partials/social-share.ejs; }

echo
echo "Negative tests for gate_social_share"
echo
try "BUG 1 back: a share button gated on owning a profile"      m1
try "BUG 2 back: an Instagram follow link inside the share bar" m2
try "BUG 3 back: footer follow links wearing the share class"   m3
try "the bar written inline again instead of included"          m4
try "a target=_blank share link loses noopener"                 m5
try "the CSS class reverts to the misleading social-share-btn"  m6
try "the bar renders even with no URL to share"                 m7
try "a share bar lands on the cart page"                        m8
try "a violation hidden on the same line as a comment"          m9
try "sr-only link text swapped back for an aria-label"          m10

echo
if [ "$bad" -gt 0 ]; then echo "NEGATIVE TESTS FAILED: $bad undetected"; exit 1; fi
echo "All 10 mutations detected. The gate can fail."
