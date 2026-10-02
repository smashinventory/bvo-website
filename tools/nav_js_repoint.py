#!/usr/bin/env python3
"""
Nav rewrite, JS half. Run from the repo root:  python3 tools/nav_js_repoint.py

public/js/site.js is minified and on two lines, so hand-editing it means
counting brackets in a 19KB string. This does the two surgical replacements
by exact-match and refuses to run if either target string is not found
verbatim - a partial patch to a minified IIFE is a broken site, so it is
all-or-nothing. Idempotent: a second run reports nothing to do.

── PATCH 1: the hamburger ─────────────────────────────────────────────
It toggled #mobile-menu, which no longer exists, so the hamburger would
have done nothing at all. Repointed at #primary-nav, the one nav list.

THE DANGEROUS PART, and why this is not a find-and-replace of the id:
The old handler also set aria-hidden on the drawer - true when closed,
false when open. That was right for a drawer that existed ONLY for mobile
and was display:none the rest of the time.

On the shared list it would be a serious accessibility bug. #primary-nav
is now the desktop navigation too, and it starts closed, so the old code
would stamp aria-hidden="true" on the entire site navigation and leave it
there for every desktop screen-reader user. Assistive tech would report no
nav at all.

So the aria-hidden handling is DELETED, not repointed. Nothing replaces it:
below Desktop the panel is moved off-screen with transform, which keeps it
in the accessibility tree on purpose - it is the only copy of the nav now,
and hiding it from assistive tech is precisely what the old two-copy
markup did wrong. aria-expanded on the BUTTON is kept; that is the correct
signal and it describes the button, not the nav.

── PATCH 2: the megamenu aria-expanded block ──────────────────────────
pointerenter / pointerleave handlers existed to mirror hover state onto
aria-expanded on .nav-mega-trigger. The trigger is a <summary> now, which
owns its own expanded state natively and exposes it to assistive tech
without help. Setting aria-expanded on it by hand is at best redundant and
at worst contradicts what the element reports.

Replaced with the one thing <details> does NOT give for free: Escape to
close. Also returns focus to the summary, which the old block did.
"""
import sys, os

ROOT = os.path.dirname(os.path.abspath(os.path.join(__file__, '..')))
P = os.path.join(ROOT, 'BVO Node.js', 'public', 'js', 'site.js')
if not os.path.exists(P):
    P = os.path.join(os.getcwd(), 'public', 'js', 'site.js')

OLD_HAMBURGER = (
 'function(){var e=document.querySelector(".nav-hamburger"),'
 't=document.getElementById("mobile-menu");'
 'e&&t&&e.addEventListener("click",function(){'
 'var n=t.classList.toggle("is-open");'
 'e.setAttribute("aria-expanded",String(n)),'
 't.setAttribute("aria-hidden",String(!n))}),'
 'document.addEventListener("click",function(n){'
 't&&t.classList.contains("is-open")&&(t.contains(n.target)||e.contains(n.target)||'
 '(t.classList.remove("is-open"),e.setAttribute("aria-expanded","false"),'
 't.setAttribute("aria-hidden","true")))})}()'
)
NEW_HAMBURGER = (
 'function(){var e=document.querySelector(".nav-hamburger"),'
 't=document.getElementById("primary-nav");'
 'e&&t&&e.addEventListener("click",function(){'
 'var n=t.classList.toggle("is-open");'
 'e.setAttribute("aria-expanded",String(n))}),'
 'document.addEventListener("click",function(n){'
 't&&t.classList.contains("is-open")&&(t.contains(n.target)||e.contains(n.target)||'
 '(t.classList.remove("is-open"),e.setAttribute("aria-expanded","false")))})}()'
)

OLD_MEGA = (
 'function(){var e=document.querySelector(".has-mega");'
 'if(e){var t=e.querySelector(".nav-mega-trigger");'
 'e.addEventListener("pointerenter",function(){n(!0)}),'
 'e.addEventListener("pointerleave",function(){n(!1)}),'
 'document.addEventListener("keydown",function(o){'
 '"Escape"===o.key&&e.matches(":hover, :focus-within")&&(t&&t.focus(),n(!1))})}'
 'function n(e){t&&t.setAttribute("aria-expanded",String(e))}}()'
)
NEW_MEGA = (
 'function(){document.addEventListener("keydown",function(e){'
 'if("Escape"===e.key){var t=document.querySelector(".nav-disclosure[open]");'
 't&&(t.open=!1,t.querySelector("summary")&&t.querySelector("summary").focus());'
 'var n=document.getElementById("primary-nav");'
 'n&&n.classList.contains("is-open")&&(n.classList.remove("is-open"),'
 'document.querySelector(".nav-hamburger")&&'
 'document.querySelector(".nav-hamburger").setAttribute("aria-expanded","false"))}})}()'
)

def main():
    src = open(P, encoding='utf-8').read()
    t, done = src, []

    for name, old, new in (('hamburger', OLD_HAMBURGER, NEW_HAMBURGER),
                           ('megamenu aria block', OLD_MEGA, NEW_MEGA)):
        if old in t:
            if t.count(old) != 1:
                print(f'  !! {name}: expected 1 occurrence, found {t.count(old)}. Refusing.')
                return 1
            t = t.replace(old, new)
            done.append(name)
        elif new in t:
            print(f'  {name}: already patched')
        else:
            print(f'  !! {name}: target string NOT FOUND verbatim.')
            print('     site.js has been re-minified or edited since this was written.')
            print('     Refusing to patch - a partial edit to a minified IIFE breaks the site.')
            return 1

    if t != src:
        open(P, 'w', encoding='utf-8').write(t)
        print(f'  site.js: {len(src)} -> {len(t)} chars  (patched: {", ".join(done)})')

    print('\n  === post-conditions ===')
    t = open(P, encoding='utf-8').read()
    checks = [
        ('hamburger targets #primary-nav', 'getElementById("primary-nav")' in t),
        ('no reference to mobile-menu',    'mobile-menu' not in t),
        ('no aria-hidden stamped on nav',  'aria-hidden",String(!n)' not in t
                                           and 'aria-hidden","true")))' not in t),
        ('no hand-set aria-expanded on trigger',
                                          'nav-mega-trigger' not in t),
        ('Escape closes the disclosure',   '.nav-disclosure[open]' in t),
        ('aria-expanded on the BUTTON kept',
                                          'e.setAttribute("aria-expanded",String(n))' in t),
    ]
    ok = True
    for label, good in checks:
        if not good: ok = False
        print(f'  {"PASS" if good else "FAIL"}  {label}')

    # Syntax. A minified file that no longer parses is the worst outcome here.
    import subprocess
    r = subprocess.run(['node', '--check', P], capture_output=True, text=True)
    print(f'  {"PASS" if r.returncode == 0 else "FAIL"}  node --check parses')
    if r.returncode: print('   ', r.stderr.strip()[:400]); ok = False
    print()
    return 0 if ok else 1

if __name__ == '__main__':
    sys.exit(main())
