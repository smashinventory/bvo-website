#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_icon_link_text.js — the three icon links in the header carry real
   text, not an aria-label.

   WHY THIS NEEDS A GATE AT ALL
   The change is invisible. Nothing moves on screen, nothing moves for a
   screen reader. The only observable difference is in a crawler's view of
   the HTML, which nobody checks. So the obvious "tidy-up" — putting the
   aria-label back because it reads cleaner — silently undoes it and no one
   notices until the next report.

   TWO FAILURE MODES, BOTH SILENT:

   1. aria-label comes back ALONGSIDE the span. The accessible name is then
      the aria-label and the span is never announced — two labels, one dead,
      free to drift apart. Asserted: these links have NO aria-label.

   2. .sr-only becomes display:none. Clipped text is read by crawlers and
      announced by assistive tech; display:none text is neither. The link
      looks identical and the warning comes straight back.

   Run:  node gates/gate_icon_link_text.js
   Exit: 0 = pass, 1 = fail
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const strip = (s) => s.replace(/<%\/\*[\s\S]*?\*\/%>/g, '').replace(/<!--[\s\S]*?-->/g, '');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

const header = strip(read('views/partials/header.ejs'));
const bundle = read('public/css/site-bundle.css');

/* Slice each link out of the markup so assertions are scoped to it and
   cannot be satisfied by some other link elsewhere in the header. */
const linkBlock = (href) => {
  const i = header.indexOf(`<a href="${href}" class="nav-icon-btn`);
  if (i < 0) return null;
  const j = header.indexOf('</a>', i);
  return j < 0 ? null : header.slice(i, j);
};

/* Wording changed 2026-10-02 to match the mobile drawer — see the
   "hidden desktop labels match the visible mobile drawer" section below,
   which is what keeps the two copies from drifting again. */
const LINKS = [
  { href: '/account',           label: 'My Account'  },
  { href: '/account/favorites', label: 'Saved Items' },
  { href: '/cart',              label: 'Cart'        },
];

console.log('--- each icon link carries real text ---');
for (const { href, label } of LINKS) {
  const b = linkBlock(href);
  ok(`${href}: the link was found`, !!b);
  if (!b) continue;

  ok(`${href}: has an .sr-only label`, /<span class="sr-only">/.test(b),
     'a crawler reads link text and does not count aria-label');
  ok(`${href}: the label reads "${label}…"`, b.includes(label));

  /* Failure mode 1. */
  ok(`${href}: has NO aria-label`, !/aria-label=/.test(b),
     'an aria-label would win the accessible name and silence the span — ' +
     'two labels, one of them dead');

  /* The icon itself must stay hidden, or it is announced alongside the
     label as a meaningless graphic. */
  ok(`${href}: the svg is still aria-hidden`, /<svg[^>]*aria-hidden="true"/.test(b));
}

console.log('\n--- the cart count has one source ---');
{
  const b = linkBlock('/cart') || '';
  ok('the count is inside the sr-only label',
     /<span class="sr-only">Cart \(<%= cart\.count %>\)<\/span>/.test(b));
  ok('the visible badge stays aria-hidden',
     /<span class="nav-cart-badge" aria-hidden="true">/.test(b),
     'otherwise the count is announced twice — once as the badge, once in ' +
     'the label');
}

/* ═══ FAILURE MODE 2 ═══════════════════════════════════════════════ */
console.log('\n--- .sr-only is clipped, not display:none ---');
{
  const m = bundle.match(/\.sr-only\{[^}]*\}/);
  ok('.sr-only exists in the shipped bundle', !!m);
  const rule = m ? m[0] : '';
  ok('it uses clip, not display:none', /clip:/.test(rule) && !/display:\s*none/.test(rule),
     'display:none text is read by neither crawlers nor screen readers — ' +
     'the labels would vanish for both and nothing would look different');
  ok('it is absolutely positioned out of flow', /position:absolute/.test(rule),
     'otherwise it takes layout space and shifts the icons');
  ok('it is 1px, not zero-sized', /width:1px/.test(rule) && /height:1px/.test(rule),
     'some assistive tech skips zero-sized elements');
}

/* ═══ THE UTILITY LABELS ════════════════════════════════════════════
   REWRITTEN 2026-10-02, when the nav rewrite deleted #mobile-menu.

   WHAT THIS SECTION USED TO ASSERT, and why it had to change
   The navigation existed TWICE — icons with hidden labels for desktop, a
   text drawer for mobile — and the two had drifted (sentence case on one
   side, title case on the other). So this section asserted the two copies
   as exact PAIRS: neither side could be reworded alone.

   There is no second copy any more. The drawer is gone and .nav-icons
   renders at every width, so these three labels exist in exactly one place.
   The pairing contract is not loosened, it is RETIRED — there is nothing
   left to pair with. Asserting a drawer row that cannot exist would be a
   gate that fails for being right.

   What is still worth asserting is that the labels did not VANISH in the
   deletion. They were rows in the drawer as well as hidden labels on the
   icons, and deleting the drawer is exactly the moment someone could take
   the wrong copy. One assertion each, on the surviving copy. */
console.log('\n--- utility labels (single source: .nav-icons) ---');
{
  const LABELS = [
    { sr: '<span class="sr-only">My Account</span>',                what: 'My Account' },
    { sr: '<span class="sr-only">Saved Items</span>',               what: 'Saved Items' },
    { sr: '<span class="sr-only">Cart (<%= cart.count %>)</span>',  what: 'Cart (n)' },
  ];
  for (const { sr, what } of LABELS) {
    ok(`${what}: label present on the icon link`, header.includes(sr));
  }
  ok('no sentence-case leftovers from the old desktop wording',
     !/sr-only">My account</.test(header) && !/sr-only">Saved items</.test(header),
     'the wording regressed to the pre-2026-10-01 desktop form');

  /* The drawer rows must NOT come back. If they do, these three labels are
     duplicated in the HTML again and so are their anchor texts — the exact
     regression the nav rewrite was for. gate_nav_single_source covers the
     structural side; this covers these three strings specifically. */
  ok('the drawer rows have not been re-added',
     !/<li><a href="\/account">My Account<\/a><\/li>/.test(header) &&
     !/<li><a href="\/account\/favorites">Saved Items<\/a><\/li>/.test(header) &&
     !/<li><a href="\/cart">Cart \(/.test(header),
     'a second copy of the utility links is back in the markup');
}

/* ═══ THE FOOTER LOGO ALT IS NOT THE WORDMARK'S LINK TEXT ══════════
   For an image link the alt IS the anchor text. The footer logo used
   alt="<%= gl.site_name %>", which renders "BathroomVanitiesOutlet.com" —
   identical to the header wordmark's link text, with both links pointing at
   "/". One phrase acting as the anchor for two separate links to the same
   page, and invisible unless you read alt attributes.

   Asserted against site_name specifically: swapping the static alt back to
   the settings value silently recreates it. */
console.log('\n--- the footer logo alt does not collide with the wordmark ---');
{
  const footer = strip(read('views/partials/footer.ejs'));
  const logo = (() => {
    const i = footer.indexOf('class="footer-brand"');
    return i < 0 ? '' : footer.slice(i, footer.indexOf('</a>', i));
  })();

  ok('the footer brand logo block was found', logo.length > 80);
  ok('its alt is static, not gl.site_name',
     /alt="Bathroom Vanities Outlet logo"/.test(logo),
     'gl.site_name renders the same string as the header wordmark link text');
  ok('the alt does NOT interpolate the site name',
     !/alt="<%=\s*gl\.site_name/.test(logo));
  ok('the alt is not the wordmark string',
     !/alt="BathroomVanitiesOutlet\.com"/.test(logo));
}

/* ═══ THE HOMEPAGE CTA DEFAULT POINTS AT A PAGE THAT EXISTS ════════
   /pages/about is a 404; the page is /pages/about-us. Live is fixed in the
   Theme Editor, so this default is inert there — it matters only for a
   fresh environment, which is exactly the case nobody tests. */
console.log('\n--- the Image with Text CTA default is not a 404 ---');
{
  const ts = read('src/services/themeSettings.js');
  const block = (() => {
    const i = ts.indexOf('  image_with_text: {');
    return i < 0 ? '' : ts.slice(i, ts.indexOf('\n  },', i));
  })();
  ok('the image_with_text defaults were found', block.length > 100);
  ok("cta_url defaults to /pages/about-us", /cta_url:\s*'\/pages\/about-us'/.test(block));
  ok("it is not the 404 /pages/about", !/cta_url:\s*'\/pages\/about'/.test(block),
     'a fresh environment would ship a dead "Our Story" button');
}

/* ═══ THE FOOTER SOCIAL LINKS CARRY REAL ANCHOR TEXT ═══════════════
   Added 2026-10-02. Same failure as the three nav icons fixed in cc748a9:
   an inline SVG plus aria-label, so assistive tech has a name but a crawler
   reading anchor text sees an empty link.

   ASSERTED FOR ALL FIVE NETWORKS, NOT JUST FACEBOOK.
   Only facebook_url is set today, so Facebook is the only one that renders
   and the only one any crawl could have flagged. The other four carried the
   identical markup and would have inherited the bug silently the moment an
   owner pasted a URL into the Theme Editor — a defect that ships later, on
   someone else's change, is the kind worth gating now rather than fixing
   again in six months.

   WHY aria-label IS ASSERTED ABSENT, NOT MERELY "TEXT PRESENT":
   aria-label OVERRIDES element contents for the accessible name. Keeping
   both means the .sr-only text is dead to assistive tech while existing only
   for crawlers, which is the cloaking-adjacent shape we avoided on the nav
   icons for the same reason. One source of truth per link. */
console.log('\n--- footer social links have anchor text, not just aria-label ---');
{
  const foot = read('views/partials/footer.ejs');
  const NETS = ['facebook', 'instagram', 'twitter', 'pinterest', 'linkedin'];

  for (const net of NETS) {
    /* [\s\S]{0,N}? and NOT [^>]* — the href is an EJS tag and every EJS tag
       contains a ">" inside its closing "%>", so a negated-> class stops dead
       inside the attribute and matches nothing. That exact bug silently
       rewrote zero links on the first attempt at this very fix. */
    const block = (() => {
      const re = new RegExp('<a[\\s\\S]{0,200}?social-share-btn--' + net + '[\\s\\S]{0,2600}?</a>');
      const m = foot.match(re);
      return m ? m[0] : '';
    })();
    ok(`${net}: link block found`, block.length > 40);
    ok(`${net}: carries .sr-only anchor text`,
       /<span class="sr-only">[^<]+<\/span>/.test(block),
       'an icon-only link reads as empty to a crawler');
    /* THE OPENING TAG ENDS AT THE FIRST ">" THAT IS NOT PART OF "%>".
       indexOf('>') is wrong here for the same reason [^>]* is wrong: the href
       is an EJS tag, so the first ">" in the string sits INSIDE the attribute,
       in the tag's own "%>". Slicing there yields just

           <a href="<%= _fsoc.facebook_url %>

       which can never contain aria-label, so the assertion passed no matter
       what. The mutation sweep caught it — putting aria-label back on two of
       the five links left this gate green. Negative lookbehind for "%" finds
       the real end of the tag. */
    const openTag = (block.match(/^<a[\s\S]*?(?<!%)>/) || [''])[0];
    ok(`${net}: no aria-label on the anchor`,
       openTag.length > 0 && !/aria-label=/.test(openTag),
       'aria-label overrides the element contents, making the text dead');
  }

  /* The five labels must be DISTINCT. Five links to five different domains
     all reading "Follow us" would be the duplicate-anchor-text problem this
     whole scope existed to remove, reintroduced in the footer. */
  const labels = [...foot.matchAll(/<span class="sr-only">(Follow us on [^<]+)<\/span>/g)]
                   .map(m => m[1]);
  ok(`five social labels present (found ${labels.length})`, labels.length === 5);
  ok('and all five are distinct', new Set(labels).size === labels.length,
     `duplicates: ${labels.filter((v,i)=>labels.indexOf(v)!==i).join(', ')}`);
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
