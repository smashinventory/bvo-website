'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_vendor_assets.js — no runtime asset comes from a third-party CDN.
 *
 * WHY THIS EXISTS. On 2026-10-14 cdnjs.cloudflare.com began returning HTTP
 * 503 for chart.umd.min.js. Every chart on all five analytics dashboards went
 * blank at once. No deploy, no code change, no error on the page — the canvas
 * elements simply stayed empty, which reads exactly like "the data is gone".
 * Diagnosis cost far more than the fix: the only visible symptom was absence.
 *
 * The same request was in flight for Quill on the page editor, so the CMS
 * editors were down too and nobody had noticed yet.
 *
 * A CDN is a dependency on someone else's uptime for a page that is already
 * being served from our own box. These files are 200-400KB, cached, and
 * loaded by admin screens only. There is no case for the round trip.
 *
 * SECOND, SEPARATE REASON — the nonce. script-src carries 'strict-dynamic',
 * which makes CSP3 browsers ignore BOTH the host allowlist and 'self'. Only
 * nonce-bearing scripts run. Today the admin pages are unaffected because the
 * CSP meta tag is emitted by main.ejs and admin.ejs has no cspMeta, and the
 * helmet header is replaced by Hostinger's CDN. All three of those are
 * accidents, not decisions. The moment CSP_META=on reaches admin pages, every
 * nonce-less script dies the same silent death. Gated now, while it is cheap.
 * ───────────────────────────────────────────────────────────────────────── */

const path = require('path');
const fs   = require('fs');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function check(cond, label, why) {
  if (cond) { console.log('  ok   ' + label); pass++; }
  else { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
}

/* Hosts that must never appear in a view. Not an exhaustive list of CDNs —
   these are the ones this codebase has actually reached for. */
const BANNED_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'ajax.googleapis.com',
  'stackpath.bootstrapcdn.com',
];

/* Hosts that are legitimately remote because they are SERVICES, not assets we
   could host: a local copy of Stripe.js is explicitly unsupported and would
   break PCI compliance, and the tag managers must be the live ones. */
const ALLOWED_REMOTE = [
  'js.stripe.com',
  'www.googletagmanager.com',
  'maps.googleapis.com',
  'www.clarity.ms',
];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.ejs')) out.push(p);
  }
  return out;
}
const VIEWS = walk(path.join(ROOT, 'views'));

/* ── 1. no banned CDN host anywhere in the views ─────────────────────── */
console.log('--- no third-party CDN serves a runtime asset ---');
for (const host of BANNED_HOSTS) {
  const hits = VIEWS.filter(f => fs.readFileSync(f, 'utf8').includes(host))
                    .map(f => path.relative(ROOT, f));
  check(hits.length === 0,
        `no view loads anything from ${host}`,
        hits.length ? 'found in: ' + hits.join(', ') +
          '\n         self-host it under public/js/vendor or public/css/vendor instead'
        : '');
}

/* ── 2. the self-hosted files actually exist ─────────────────────────── */
console.log('--- the vendored files are present ---');
const VENDORED = [
  'public/js/vendor/chart.umd.4.4.1.js',
  'public/js/vendor/quill.1.3.7.min.js',
  'public/css/vendor/quill.snow.1.3.7.css',
];
for (const rel of VENDORED) {
  const p = path.join(ROOT, rel);
  const ok = fs.existsSync(p) && fs.statSync(p).size > 10000;
  check(ok, `${rel} exists and is not a stub`,
        'a view pointing at a missing local file fails exactly like the 503 did');
}
/* Cheap identity check: the right library, not an empty file with the right
   name. Catches a truncated copy or the wrong package. */
{
  const chart = fs.readFileSync(path.join(ROOT, VENDORED[0]), 'utf8').slice(0, 400);
  check(/Chart\.js v4\.4\.1/.test(chart),
        'the vendored Chart.js really is v4.4.1',
        'the views were written against 4.4.x; a major bump changes the API silently');
}

/* ── 3. every view that uses a vendored asset points at the local copy ─ */
console.log('--- the dashboards point at the local copy ---');
const CHART_PAGES = [
  'views/pages/admin/marketing/jmv-reports.ejs',
  'views/pages/admin/marketing/jmv-financials.ejs',
  'views/pages/admin/marketing/site-analytics.ejs',
  'views/pages/admin/marketing/customers.ejs',
  'views/pages/admin/orders/reports.ejs',
];
for (const rel of CHART_PAGES) {
  const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  check(s.includes('/js/vendor/chart.umd.4.4.1.js'),
        `${path.basename(rel)} loads Chart.js from /js/vendor`);
}

/* ── 4. every script tag on those pages carries a nonce ──────────────── */
console.log('--- strict-dynamic: every script tag is nonce-bearing ---');
for (const rel of CHART_PAGES.concat(['views/pages/admin/page-edit.ejs'])) {
  const s = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  /* Opening <script> tags only; closing tags and EJS comments are not tags. */
  const tags = s.match(/<script\b[^>]*>/g) || [];
  const bare = tags.filter(t => !/\bnonce=/.test(t));
  check(bare.length === 0,
        `${path.basename(rel)}: all ${tags.length} script tag(s) carry a nonce`,
        bare.length ? 'nonce-less: ' + bare.join(' | ') +
          "\n         script-src has 'strict-dynamic', so these run only by accident today"
        : '');
}

/* ── 4b. EVERY view's inline scripts are nonce-bearing ───────────────── */
/* Confirmed live on 2026-10-14: the response carries
     script-src 'nonce-...' 'strict-dynamic' 'unsafe-inline' https:
   as an ENFORCING header (not report-only). Hostinger's CDN used to replace
   it; it no longer does. Under strict-dynamic the browser ignores both the
   host allowlist and 'self', so a nonce-less inline block simply never runs -
   silently, with no console error the owner would go looking for.

   Nine admin screens were in that state: order detail (capture payment, cancel
   authorization, add note, open return), the orders list, the returns queue,
   all four shipping screens and both email-template screens. Every button on
   them was inert.

   EJS TAGS ARE STRIPPED FIRST. The first attempt at this audit counted the
   word "<script>" written inside <%# comments %> explaining CSP, reported 19
   affected files, and then "fixed" nine of them by injecting a nonce into
   prose - which broke the templates. Comments are not markup. */
{
  const EJS  = /<%[-=#_]?[\s\S]*?[-_]?%>/g;
  const DATA = /type\s*=\s*["']application\/(ld\+json|json)["']/;
  const offenders = [];
  for (const f of VIEWS) {
    const raw = fs.readFileSync(f, 'utf8');
    /* Blank out EJS regions, preserving offsets so nothing shifts. */
    const flat = raw.replace(EJS, m => ' '.repeat(m.length));
    for (const m of flat.matchAll(/<script\b[^>]*?>/g)) {
      const tag = raw.slice(m.index, m.index + m[0].length);
      if (/\bnonce=/.test(tag) || DATA.test(tag)) continue;
      offenders.push(path.relative(ROOT, f) + ': ' + tag.slice(0, 60));
    }
  }
  check(offenders.length === 0,
        'every executable <script> in every view carries a nonce',
        offenders.length ? offenders.join('\n         ') +
          "\n         script-src is enforcing with 'strict-dynamic'; these never run"
        : '');
}

/* The comment-blindness above is load-bearing, so it is proved on a fixture
   rather than assumed. The first version of this audit lacked it, reported
   nineteen affected files instead of nine, and "fixed" the extra ten by
   injecting a nonce into prose inside <%# %> comments — which broke nine
   templates outright. A rule that cannot tell markup from documentation is
   worse than no rule. */
{
  const EJS  = /<%[-=#_]?[\s\S]*?[-_]?%>/g;
  const scan = (src) => {
    const flat = src.replace(EJS, m => ' '.repeat(m.length));
    return [...flat.matchAll(/<script\b[^>]*?>/g)]
      .map(m => src.slice(m.index, m.index + m[0].length))
      .filter(t => !/\bnonce=/.test(t));
  };
  check(scan('<%# the injected <script> needs no nonce %>').length === 0,
        'a <script> written inside an EJS comment is not counted as markup');
  check(scan('<% /* <script src="x"> */ %>').length === 0,
        'nor one inside an EJS code block');
  check(scan('<script>alert(1)</script>').length === 1,
        'but a real nonce-less tag IS counted');
  check(scan('<script nonce="<%= cspNonce %>">ok</script>').length === 0,
        'and a real nonce-bearing tag is not');
}

/* ── 5. the remote hosts that REMAIN are deliberate ──────────────────── */
console.log('--- the remaining remote scripts are services, not assets ---');
{
  const remote = new Set();
  for (const f of VIEWS) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<script[^>]+src=["']https:\/\/([^/"']+)/g)) remote.add(m[1]);
  }
  const unexpected = [...remote].filter(h => !ALLOWED_REMOTE.includes(h));
  check(unexpected.length === 0,
        'no unexpected remote script host',
        unexpected.length ? 'found: ' + unexpected.join(', ') +
          '\n         if it is an asset, vendor it; if it is a service, add it to ALLOWED_REMOTE with a reason'
        : '');
}

console.log('');
console.log(fail === 0
  ? `gate_vendor_assets: all ${pass} checks pass`
  : `gate_vendor_assets: ${fail} FAILED, ${pass} passed`);
process.exit(fail === 0 ? 0 : 1);
