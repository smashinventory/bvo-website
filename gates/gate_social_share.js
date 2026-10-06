#!/usr/bin/env node
'use strict';

/* gate_social_share.js
 *
 * SHARE IS NOT FOLLOW, AND THE CODE MUST SAY SO.
 *
 * Three bugs on 2026-10-06, all from the two being tangled:
 *
 *  1. Every share button was wrapped in `if (settings.social.<network>_url)`.
 *     Sharing TO LinkedIn has nothing to do with whether BVO HAS a LinkedIn
 *     page, so LinkedIn sharing was off site-wide because that field was blank.
 *
 *  2. An Instagram link sat inside the share bar labeled "Follow us on
 *     Instagram". Instagram has no web share intent, so it cannot be a share
 *     button — it was a follow link under a heading that said "Share this
 *     product".
 *
 *  3. The footer's FOLLOW links wore class="social-share-btn". Crawlers were
 *     never fooled, because they read the href and it plainly says profile URL
 *     — which is exactly why Seobility correctly reported no sharing options on
 *     pages that had none. But every human and assistant reading the source
 *     was, including this one. That is the bug this gate exists for.
 *
 * ASSERTED
 *   1. ONE share-bar definition. The markup lived inline in product.ejs AND
 *      inspiration-guide.ejs, which is how the gating bug got written twice.
 *   2. Every link in the partial is a real share INTENT, never a profile URL.
 *   3. No Instagram, no Yelp in the share bar — neither accepts a shared URL.
 *   4. Share buttons are NOT gated on settings.social.*_url.
 *   5. Footer follow links never carry a share class, and vice versa.
 *   6. The partial is EXECUTED and its output checked.
 *   7. The bar is absent from checkout, cart, account, admin, search and error
 *      pages. Share buttons on a checkout step are noise.
 *
 * NOT asserted: which networks, how many, or the markup shape. Those are
 * product decisions that will change. What must hold is the share/follow
 * separation.
 */

const fs   = require('fs');
const path = require('path');
const ejs  = require('ejs');
const ROOT = path.join(__dirname, '..');

let fails = 0, checks = 0;
const ok  = m => { checks++; console.log('  ok   ' + m); };
const bad = (m,d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c,m,d) => c ? ok(m) : bad(m,d);
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

/* STRIP COMMENTS BEFORE MATCHING. Every assertion below is about what the
   TEMPLATE DOES, and a template that explains a past bug necessarily names it:
   the partial's header says the words "Instagram", "social-share-btn" and
   "settings.social.<network>_url" in order to document why none of them are
   used. Matching raw source turned all five of those comments into failures on
   the first run — the gate accusing the documentation of being the bug. This
   project has hit the same trap before, which is why the stripper is written
   once, here, and used by every check rather than bolted onto one of them. */
function stripTemplateComments(src) {
  return src
    .replace(/<%#[\s\S]*?%>/g, '')     // <%# EJS comment %>
    .replace(/<%\/\*[\s\S]*?\*\/%>/g, '')  // <%/* EJS comment */%>
    .replace(/<!--[\s\S]*?-->/g, '');  // <!-- HTML comment -->
}
const views = r => path.join(ROOT, 'views', r);

/* Real, documented web share endpoints. A link in the share bar must match one
   of these; anything else is a profile link that has wandered in. */
const SHARE_INTENT =
  /(facebook\.com\/sharer|twitter\.com\/intent|pinterest\.com\/pin\/create|linkedin\.com\/sharing\/share-offsite|^mailto:)/i;

console.log('\ngate_social_share — share links and follow links must stay apart\n');

const PARTIAL = 'views/partials/social-share.ejs';
const partial = stripTemplateComments(read(PARTIAL));
const partialRaw = read(PARTIAL);   // for the render test, which needs the real file

/* ── 1. one definition ───────────────────────────────────────────────────── */
{
  const offenders = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.ejs') || e.name.includes('.bak')) continue;
      const rel = path.relative(ROOT, p);
      if (rel === PARTIAL) continue;
      const src = stripTemplateComments(fs.readFileSync(p, 'utf8'));
      // The CONTAINER markup, not the include. An include is the right answer.
      if (/<div[^>]+class="[^"]*social-share-bar/.test(src)) offenders.push(rel);
    }
  };
  walk(views(''));
  check(offenders.length === 0,
        'the share bar is defined ONCE, in the partial — nowhere else writes the markup',
        offenders.join(', '));
}

/* ── 2 + 3. only real share intents, and no network that lacks one ───────── */
{
  const hrefs = [...partial.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  check(hrefs.length > 0, 'the partial emits links at all');

  const notIntent = hrefs.filter(h => !SHARE_INTENT.test(h.replace(/<%[-=]?\s*_?\w+\s*%>/g, 'X')));
  check(notIntent.length === 0,
        'every link in the share bar is a share INTENT, not a profile URL',
        notIntent.join(', '));

  for (const net of ['instagram', 'yelp']) {
    check(!new RegExp(net, 'i').test(partial),
          `no ${net} in the share bar — it has no web share intent, so it can only be a follow link`);
  }
}

/* ── 4. share buttons are not gated on owning a profile ─────────────────── */
{
  const gated = /if\s*\(\s*_?s\w*\.(facebook|twitter|pinterest|linkedin|instagram)_url\s*\)/i.test(partial)
             || /social\.(facebook|twitter|pinterest|linkedin)_url/i.test(partial);
  check(!gated,
        'share buttons are NOT conditional on settings.social.*_url (that is what disabled LinkedIn)');
}

/* ── 5. the class boundary ──────────────────────────────────────────────── */
{
  const footer = stripTemplateComments(read('views/partials/footer.ejs'));
  check(!/social-share-btn/.test(footer),
        'footer FOLLOW links do not wear a share class');
  check(/social-follow-btn/.test(footer),
        'footer follow links carry an honest social-follow-btn class');
  check(!/social-follow-btn/.test(partial),
        'the share partial does not carry a follow class');

  /* The shared visual class must be the neutral one, and the old name gone
     from CSS, or the two uses cannot share styling without lying. */
  for (const f of ['public/css/site-bundle.css', 'public/css/site2.css']) {
    const css = read(f);
    check(/\.social-icon-btn\s*\{/.test(css), `${path.basename(f)}: neutral .social-icon-btn exists`);
    check(!/\.social-share-btn[\s{,:]/.test(css),
          `${path.basename(f)}: the misleading .social-share-btn rule is gone`);
  }
}

/* ── 6. EXECUTE the partial ─────────────────────────────────────────────── */
{
  const html = ejs.render(partialRaw, {
    canonicalUrl: 'https://www.bathroomvanitiesoutlet.com/products/example',
    pageTitle:    'Example Vanity | BVO',
    shareLabel:   'Share this product',
    shareImage:   'https://www.bathroomvanitiesoutlet.com/img/x.jpg',
  }, { filename: views('partials/social-share.ejs') });

  const anchors = [...html.matchAll(/<a\s[^>]*href="([^"]+)"[^>]*>/g)];
  check(anchors.length >= 3, `the bar renders multiple share links (${anchors.length})`);
  check(anchors.every(a => SHARE_INTENT.test(a[1])),
        'every RENDERED href is a share intent');
  /* LINK TEXT, not aria-label. The project rule (gate_icon_link_text) is that
     an icon link is named by an .sr-only span, because a crawler reads link text
     and does not count aria-label — which is precisely the question that started
     this work. An aria-label on the anchor would also win the accessible name
     and silence the span, so the two must never both be present. */
  check(!anchors.some(a => /aria-label="/.test(a[0])),
        'no share ANCHOR carries an aria-label (it would silence the sr-only span)');
  check((html.match(/<span class="sr-only">/g) || []).length === anchors.length,
        'every rendered share link is named by an .sr-only span a crawler can read');
  check(/class="social-share-bar"[^>]*aria-label="Share this product"/.test(html),
        'the container carries the label it was given');

  /* target=_blank without noopener is a security hole; nofollow on an outbound
     utility link is the convention. mailto opens in the mail client and needs
     neither. */
  const blanks = [...html.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)].map(m => m[0]);
  check(blanks.every(a => /rel="[^"]*noopener/.test(a)), 'every target=_blank share link sets noopener');
  check(blanks.every(a => /rel="[^"]*nofollow/.test(a)), 'every target=_blank share link sets nofollow');

  /* With no URL there is nothing to share, so the bar must not render an
     empty one. */
  const none = ejs.render(partialRaw, { canonicalUrl: '', pageTitle: 'x' },
                          { filename: views('partials/social-share.ejs') });
  check(none.trim() === '', 'with no shareable URL the bar renders nothing at all');

  /* Pinterest without an image would be a pin with no picture. */
  const noImg = ejs.render(partialRaw, { canonicalUrl: 'https://x.test/a', pageTitle: 'x' },
                           { filename: views('partials/social-share.ejs') });
  check(!/pinterest/i.test(noImg), 'Pinterest is omitted when the page has no image to pin');
}

/* ── 7. pages that must NOT carry it ────────────────────────────────────── */
{
  const FORBIDDEN = ['cart', 'checkout-info', 'checkout-delivery', 'checkout-payment',
                     'checkout-identify', 'checkout-success', 'checkout-cancel',
                     'order-confirm', 'search', '404', 'error'];
  const wrong = FORBIDDEN.filter(f => {
    const p = views('pages/' + f + '.ejs');
    return fs.existsSync(p) && /partials\/social-share/.test(stripTemplateComments(fs.readFileSync(p, 'utf8')));
  });
  check(wrong.length === 0,
        'no share bar on checkout, cart, order confirmation, search results or error pages',
        wrong.join(', '));

  const admin = views('pages/admin');
  if (fs.existsSync(admin)) {
    const inAdmin = fs.readdirSync(admin).filter(f => f.endsWith('.ejs') &&
      /partials\/social-share/.test(stripTemplateComments(fs.readFileSync(path.join(admin, f), 'utf8'))));
    check(inAdmin.length === 0, 'no share bar anywhere in admin', inAdmin.join(', '));
  }
}

console.log('\n' + (fails
  ? 'gate_social_share: FAILED ' + fails + ' of ' + checks
  : 'gate_social_share: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
