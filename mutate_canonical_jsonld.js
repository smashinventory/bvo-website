'use strict';
/**
 * Offline self-test for gate_canonical_host_live's JSON-LD host check.
 *
 * WHY IT IS NOT A .sh MUTATION HARNESS. That gate needs the network: it
 * reads live pages. There is nothing on disk to mutate that would change
 * what a live page publishes, so the usual "edit a file, expect red" route
 * cannot test this logic at all. Instead this drives the gate's own
 * exported classifier over fixtures — the real `ownUrls` and the real
 * EXTERNAL_BY_DESIGN set, not a restatement of them.
 *
 * WHAT IT IS PROVING. On 2026-10-20 the check was failing all three page
 * types on three URLs:
 *
 *     https://www.facebook.com/BathroomVanitiesOutlet/
 *     https://x.com/BVOutlet
 *     https://www.pinterest.com/bathroomvanitiesoutlet/
 *
 * Those are Organization.sameAs, built by structuredData.js:102 from the
 * owner's theme settings. `sameAs` is the schema.org property for "this
 * entity's identity on OTHER platforms" — a sameAs naming our own canonical
 * host would be meaningless. So the gate was not catching a regression: it
 * went red because the owner FILLED IN the social URLs in the Theme Editor,
 * i.e. because the markup got MORE correct. Rule 22.
 *
 * The fix exempts `sameAs` and nothing else. A relaxation is only safe if
 * it is proven to still catch what it was guarding, so the cases below are
 * deliberately split: ALLOW for the external-by-design property, CATCH for
 * every property that denotes one of our own resources.
 */

const { ownUrls, EXTERNAL_BY_DESIGN } = require('./gates/gate_canonical_host_live.js');

const CANONICAL = 'www.bathroomvanitiesoutlet.com';
const SITE = 'https://' + CANONICAL;
const hostOf = (u) => { try { return new URL(u).host.toLowerCase(); } catch { return null; } };

/* The same allow-list the gate applies after collection. */
const CDN = /(^|\.)(schema\.org|bunny\.net|b-cdn\.net|cloudinary\.com)$/;

function offenders(graph) {
  const urls = [];
  ownUrls(graph, null, urls);
  return urls.filter((u) => {
    const h = hostOf(u);
    return h && h !== CANONICAL && !CDN.test(h);
  });
}

let fail = 0, n = 0;
function expect(label, graph, mode, wanted) {
  n++;
  const bad = offenders(graph);
  const got = bad.length;
  if (mode === 'allow') {
    if (got === 0) console.log(`  correctly allowed  ${label}`);
    else { console.log(`  FALSE POSITIVE     ${label} → flagged ${JSON.stringify(bad)}`); fail++; }
  } else {
    if (got >= (wanted || 1)) console.log(`  caught             ${label}`);
    else { console.log(`  MISSED             ${label} → flagged nothing`); fail++; }
  }
}

console.log('\n--- sameAs is external BY DESIGN and must be allowed ---');

/* The exact live payload that was going red, trimmed to the relevant nodes. */
expect('the three real sameAs profiles that failed the gate', {
  '@type': 'OnlineStore',
  '@id':   `${SITE}/#organization`,
  url:     `${SITE}/`,
  logo:    { '@type': 'ImageObject', url: `${SITE}/images/logo.webp` },
  sameAs: [
    'https://www.facebook.com/BathroomVanitiesOutlet/',
    'https://x.com/BVOutlet',
    'https://www.pinterest.com/bathroomvanitiesoutlet/',
  ],
}, 'allow');

expect('sameAs nested inside publisher', {
  '@type': 'Article',
  url: `${SITE}/inspiration/x`,
  publisher: { '@type': 'Organization', sameAs: ['https://www.yelp.com/biz/x'] },
}, 'allow');

expect('a Person author sameAs (authorsController writes these)', {
  '@type': 'Article',
  url: `${SITE}/inspiration/x`,
  author: { '@type': 'Person', name: 'A', sameAs: 'https://www.linkedin.com/in/a' },
}, 'allow');

console.log('\n--- but every property that names OUR content is still checked ---');

expect('a foreign url', { '@type': 'WebPage', url: 'https://evil.example.com/' }, 'catch');
expect('a foreign @id',  { '@type': 'WebPage', '@id': 'https://evil.example.com/#x' }, 'catch');
expect('a foreign logo contentUrl', {
  '@type': 'Organization',
  logo: { '@type': 'ImageObject', contentUrl: 'https://evil.example.com/l.png' },
}, 'catch');
expect('a foreign breadcrumb item', {
  '@type': 'BreadcrumbList',
  itemListElement: [{ '@type': 'ListItem', item: 'https://evil.example.com/c' }],
}, 'catch');
expect('a foreign thumbnailUrl on a VideoObject', {
  '@type': 'VideoObject', thumbnailUrl: 'https://i.ytimg.com/vi/x/hq.jpg',
}, 'catch');
expect('a foreign potentialAction target', {
  '@type': 'WebSite',
  potentialAction: { '@type': 'SearchAction', target: 'https://evil.example.com/s?q={q}' },
}, 'catch');

/* ⚠️ THE ONE THAT WOULD MATTER MOST. The non-canonical variants of our OWN
   domain are the actual SEO defect this gate was built for — an apex or a
   staging host in a self-reference splits ranking signals. Exempting sameAs
   must not have loosened this. */
expect('the apex host in url (the original defect this gate exists for)',
  { '@type': 'WebPage', url: 'https://bathroomvanitiesoutlet.com/' }, 'catch');
expect('a staging host in @id',
  { '@type': 'WebPage', '@id': 'https://staging.bathroomvanitiesoutlet.com/#x' }, 'catch');

console.log('\n--- mixed node: a legitimate sameAs must not mask a real offender ---');
expect('foreign url AND legitimate sameAs in the same node', {
  '@type': 'Organization',
  url: 'https://bathroomvanitiesoutlet.com/',          // apex — must be caught
  sameAs: ['https://x.com/BVOutlet'],                   // fine
}, 'catch');

console.log('\n--- the exemption is exactly one property, not a category ---');
if (EXTERNAL_BY_DESIGN.size === 1 && EXTERNAL_BY_DESIGN.has('sameAs')) {
  console.log('  ok                 EXTERNAL_BY_DESIGN is {sameAs} and nothing else');
} else {
  console.log(`  FAIL               EXTERNAL_BY_DESIGN drifted: ${[...EXTERNAL_BY_DESIGN]}`);
  fail++;
}
n++;

console.log('');
if (fail === 0) {
  console.log(`ALL ${n} CASES BEHAVED (sameAs allowed, every self-reference still checked)`);
  process.exit(0);
}
console.log(`*** ${fail} of ${n} CASES MISBEHAVED ***`);
process.exit(1);
