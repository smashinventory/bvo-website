#!/usr/bin/env python3
"""
Nav rewrite, CSS half. Run from the repo root:  python3 tools/nav_css_merge.py

WHY A SCRIPT INSTEAD OF HAND EDITS
  The same four changes have to land in site.css (the source) AND in
  site-bundle.css (the hand-minified concatenation that is the only
  stylesheet main.ejs actually links). Editing one and forgetting the other
  is the single most repeated mistake in this project's history: a change in
  site.css reaches no browser. Doing both from one script makes them
  impossible to get out of step, and it prints what it changed so the diff
  can be read before committing.

  It is idempotent. Run it twice and the second run reports 0 changes.

THE FOUR CHANGES, and why each one is load-bearing

  1. DELETE  @media (max-width:900px){.mega-menu{display:none!important}}
     This is the one that would have broken the phone. The rewritten nav
     renders .mega-menu INLINE as the accordion panel below the Desktop
     band. This rule hides it, with !important, under 900px - so every
     phone would have got a "Vanities" row that expanded to nothing. The
     inline CSS in header.ejs cannot beat !important. The rule only existed
     to stop the desktop dropdown appearing while #mobile-menu was the
     mobile nav; #mobile-menu is gone, so its reason is gone.

  2. DELETE the .mobile-menu and .mobile-sub rules
     Dead: the only elements they styled were inside #mobile-menu. Left in
     place they are 4 rules of misleading dead weight, and .mobile-sub a
     carried four !important declarations that would ambush the next person
     who reuses the class name. NOT touching .mobile-filter-btn /
     .mobile-filter-dot - those are the collection page's filter drawer, a
     different feature that is still live.

  3. .nav-brand,.nav-links{display:none}  ->  .nav-brand{display:none}
     A stale hardcoded responsive rule. The list must NOT be display:none
     below Desktop any more - it is the drawer now. The inline CSS in
     header.ejs does win here on source order (same specificity, later in
     the document), so this is belt-and-braces rather than a live bug. Doing
     it anyway: a rule that says the opposite of what ships is a trap, and
     relying on source order across two files is not a thing to leave for
     someone else to discover.

  4. APPEND the .nav-disclosure base rules
     Hides the native <details> marker at every width (the summary already
     contains an SVG chevron, so the UA triangle would be a second
     affordance) and rotates that chevron when open.

     Marker hiding needs BOTH properties: list-style:none covers Firefox
     and Chrome, ::-webkit-details-marker covers Safari. Neither alone is
     enough.
"""
import re, sys, os

ROOT = os.path.dirname(os.path.abspath(os.path.join(__file__, '..')))
CSS  = os.path.join(ROOT, 'BVO Node.js', 'public', 'css')
if not os.path.isdir(CSS):
    CSS = os.path.join(os.getcwd(), 'public', 'css')

TARGETS = ['site.css', 'site-bundle.css']

# 1. the killer. Tolerant of whitespace so it matches minified and source form.
KILLER = re.compile(
    r'@media\s*\(\s*max-width:\s*900px\s*\)\s*\{\s*'
    r'\.mega-menu\s*\{\s*display:\s*none\s*!important\s*;?\s*\}\s*\}'
)

# 2. dead drawer rules. Anchored on the selector so .mobile-filter-* survives.
DEAD = [
    re.compile(r'\.mobile-menu\s*\{[^}]*\}'),
    re.compile(r'\.mobile-menu\s+ul\s*\{[^}]*\}'),
    re.compile(r'\.mobile-menu\s+li\s+a\s*\{[^}]*\}'),
    re.compile(r'\.mobile-menu\.is-open\s*\{[^}]*\}'),
    re.compile(r'\.mobile-sub\s+a\s*\{[^}]*\}'),
]

# 3. the stale hide rule
HIDE_FROM = re.compile(r'\.nav-brand\s*,\s*\.nav-links\s*\{\s*display:\s*none\s*;?\s*\}')
HIDE_TO   = '.nav-brand{display:none}'

# 4. what to append. Marker rules apply at EVERY width, not just desktop:
#    the summary carries its own SVG chevron, so the UA triangle is always
#    a duplicate affordance.
APPEND = (
    '\n/* nav rewrite 2026-10-02 - one list, <details> submenus. */'
    '\n.nav-disclosure>summary{list-style:none;cursor:pointer}'
    '\n.nav-disclosure>summary::-webkit-details-marker{display:none}'
    '\n.nav-disclosure[open]>summary svg{transform:rotate(180deg)}\n'
)
APPEND_MIN = (
    '.nav-disclosure>summary{list-style:none;cursor:pointer}'
    '.nav-disclosure>summary::-webkit-details-marker{display:none}'
    '.nav-disclosure[open]>summary svg{transform:rotate(180deg)}'
)

def run():
    total = 0
    for fn in TARGETS:
        p = os.path.join(CSS, fn)
        if not os.path.exists(p):
            print(f'  !! {fn} not found at {p}'); return 1
        src = open(p, encoding='utf-8').read()
        t = src
        log = []

        n = len(KILLER.findall(t))
        if n:
            t = KILLER.sub('', t)
            log.append(f'removed 900px .mega-menu display:none!important x{n}')

        for rx in DEAD:
            hits = rx.findall(t)
            if hits:
                t = rx.sub('', t)
                log.append(f'removed dead rule {rx.pattern[:28]}... x{len(hits)}')

        n = len(HIDE_FROM.findall(t))
        if n:
            t = HIDE_FROM.sub(HIDE_TO, t)
            log.append(f'.nav-brand,.nav-links hide -> .nav-brand only x{n}')

        if '.nav-disclosure' not in t:
            t = t.rstrip() + (APPEND_MIN if fn == 'site-bundle.css' else APPEND)
            log.append('appended .nav-disclosure base rules')

        if t != src:
            open(p, 'w', encoding='utf-8').write(t)
            total += 1
            print(f'  {fn}: {len(src)} -> {len(t)} chars')
            for l in log: print(f'      - {l}')
        else:
            print(f'  {fn}: no change (already done)')

    # Post-conditions. A silent regex miss is the failure mode here, so assert
    # rather than trust the substitution count.
    print('\n  === post-conditions ===')
    ok = True
    for fn in TARGETS:
        t = open(os.path.join(CSS, fn), encoding='utf-8').read()
        checks = [
            ('no 900px mega-menu killer',  not KILLER.search(t)),
            ('no .mobile-menu rules',      '.mobile-menu' not in t),
            ('no .mobile-sub rules',       '.mobile-sub' not in t),
            ('.nav-links not force-hidden', not HIDE_FROM.search(t)),
            ('.nav-disclosure present',    '.nav-disclosure' in t),
            ('.mega-menu still styled',    '.mega-menu{' in t or '.mega-menu {' in t),
        ]
        # .mobile-filter-btn is the collection page's filter drawer - a LIVE
        # feature that shares the "mobile-" prefix with the dead drawer rules
        # above, which is exactly how an over-broad regex would eat it. It
        # lives in site2.css, so it is only asserted where it actually exists:
        # the bundle. Asserting it in site.css was a false FAIL on first run -
        # the assertion was wrong, not the edit.
        if fn == 'site-bundle.css':
            checks.append(('.mobile-filter-btn kept (live feature)',
                           '.mobile-filter-btn' in t))
        for label, good in checks:
            if not good: ok = False
            print(f'  {"PASS" if good else "FAIL"}  {fn:18s} {label}')
    print()
    return 0 if ok else 1

if __name__ == '__main__':
    sys.exit(run())
