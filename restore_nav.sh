#!/bin/bash
# Run with: bash restore_nav.sh
#
# PANIC BUTTON. Puts the navigation back to the last known-good state
# (tag nav-pre-rewrite, commit 1988bb6) and pushes, which redeploys.
#
# Use this if the nav rewrite ships and the menu is broken: hamburger does
# nothing, megamenu will not open, links missing on one layout.
#
# WHY A SCRIPT AND NOT "just git revert"
#   A nav rewrite touches the template AND two stylesheets together:
#       views/partials/header.ejs
#       public/css/site.css          (source)
#       public/css/site-bundle.css   (what actually ships, hand-minified)
#   Restoring the template alone leaves markup and styling disagreeing, which
#   can look worse than the bug you were escaping. This restores all of them
#   from one commit so they cannot get out of step.
#
# This does NOT touch anything else. Commits since the tag that are unrelated
# to the nav stay exactly as they are.
set -e
cd "$(dirname "$0")"

TAG=nav-pre-rewrite
FILES="views/partials/header.ejs public/css/site.css public/css/site-bundle.css public/js/site.js"

echo "=== what you are restoring ==="
git --no-pager log -1 --format='  from: %h  %s' "$TAG"
echo "  to:   working tree"
echo
echo "=== what differs right now ==="
if git diff --quiet "$TAG" -- $FILES; then
  echo "  nothing — the nav files already match $TAG. Stopping."
  exit 0
fi
git --no-pager diff --stat "$TAG" -- $FILES

echo
read -r -p "Restore these files from $TAG and push? [y/N] " ans
[ "$ans" = "y" ] || { echo "Aborted. Nothing changed."; exit 1; }

echo
echo "=== restoring ==="
git checkout "$TAG" -- $FILES
git --no-pager diff --cached --stat

echo
echo "=== gates (a restore must still pass them) ==="
for g in gate_icon_link_text gate_footer_and_headings gate_card_anchors \
         gate_heading_labels gate_guide_preview gate_analytics_tags \
         gate_canonical_redirect gate_account_paths; do
  printf '  %-30s ' "$g"
  node "gates/$g.js" >/dev/null 2>&1 && echo PASS || echo "FAIL  <-- expected if a later commit changed these files on purpose"
done

echo
echo "A FAIL above is not automatically wrong. It means a commit after $TAG"
echo "changed one of these files deliberately and the restore undid it."
echo "Read the failure before pushing."
echo
read -r -p "Commit and push the restore? [y/N] " ans2
[ "$ans2" = "y" ] || { echo "Files restored locally, NOT committed. Run 'git checkout HEAD -- $FILES' to undo."; exit 1; }

git commit -m "Restore navigation to $TAG ($(git rev-list -n1 --abbrev-commit $TAG))

Rollback. The nav rewrite broke something and this puts header.ejs,
site.css, site-bundle.css and site.js back to the last state where the
desktop megamenu and the mobile drawer were both known working.

Restored as a set, not file by file: site-bundle.css is hand-minified from
the sources, so a template restored without its stylesheet leaves markup and
styling disagreeing."
git push origin main

echo
echo "Pushed. hbuilds redeploys - this WIPES public_html/JM_Feed."
echo
echo "Then check, on a phone and on desktop:"
echo "  1. Hamburger opens the drawer."
echo "  2. Vanities opens the megamenu on hover."
echo "  3. The drawer's Vanities accordion expands."
