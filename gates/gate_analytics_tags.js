#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_analytics_tags.js — the analytics tags stay env-guarded, stay
   deferred, and keep the CSP entries they actually need.

   Run:  node gates/gate_analytics_tags.js
   Exit: 0 = pass, 1 = fail

   Every failure here is invisible on the page. A missing connect-src host
   does not break rendering — the script loads, the layout is perfect, and
   the beacons die silently, which is exactly how the Google Maps Places
   entry cost a deploy on 2026-09-27. An un-deferred tag does not break
   anything either; it just quietly hands back ~250ms of LCP that was
   measured and paid for. Neither shows up in a browser tab, so both are
   asserted.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

const server = read('src/server.js');
const layout = read('views/layouts/main.ejs');

/* The layout carries the tags plus a long comment block explaining them.
   Assertions about CODE must not be satisfied by prose, so EJS comment tags
   are stripped before anything is measured. Without this, a gate asserting
   "clarity.ms appears" would pass on a comment that merely mentions it. */
const code = layout
  .replace(/<%\/\*[\s\S]*?\*\/%>/g, '')
  .replace(/<%#[\s\S]*?%>/g, '');

/* ═══ 1. NOTHING RENDERS WITHOUT AN ID ══════════════════════════════
   An unset env var must produce no tag at all. A tag built from an empty
   id is worse than absent: it loads a third-party script that can never
   report, so it costs the bandwidth and returns nothing. */
console.log('--- both tags are env-guarded ---');
{
  ok('server.js exposes clarityId from the environment',
     /res\.locals\.clarityId\s*=\s*process\.env\.CLARITY_ID\s*\|\|\s*''/.test(server));
  ok('server.js exposes ga4Id from the environment',
     /res\.locals\.ga4Id\s*=\s*process\.env\.GA4_ID\s*\|\|\s*''/.test(server));

  ok('the Clarity block is wrapped in a truthiness check on clarityId',
     /<%\s*if\s*\([^%]*clarityId[^%]*\)\s*\{\s*%>/.test(code),
     'without the guard an unset CLARITY_ID renders clarity.ms/tag/ with no id');
  ok('the GA4 block is still wrapped in a truthiness check',
     /<%\s*if\s*\(\s*_gaId\s*&&/.test(code));
}

/* ═══ 2. BOTH TAGS LOAD WITH THE PAGE ═══════════════════════════════
   As of 2026-09-30 neither tag is deferred. Clarity went eager first, to
   isolate whether the deferral was why its install never registered; GA4
   followed, at Sam's call, to re-measure the LCP cost against the page as
   it stands today rather than as it stood on 2026-09-22.

   THIS SECTION ASSERTS THE STATE WE INTEND, NOT THE STATE WE HAPPEN TO BE
   IN. That is the whole reason it is worth writing: if a later session
   reintroduces a deferred loader for either tag — reasonably, perhaps, off
   the back of a fresh measurement — the gate fails and forces the decision
   to be made explicitly and re-recorded here, instead of drifting back in
   as a silent "optimisation" nobody measured. The previous loader is intact
   in git history at f89af87 if it needs to come back. */
console.log('\n--- neither tag is deferred ---');
{
  /* Isolate each block around its OWN marker. An earlier version sliced by
     a fixed offset from the Clarity tag, which silently cut through the GA4
     loader once the comment lengths changed — the gate failed on correct
     code. Anchor on the thing being measured, never on a distance from it. */
  const ci = code.indexOf('clarity.ms/tag/');
  ok('the Clarity tag is present at all', ci > -1);
  const blockAround = (idx) => idx < 0 ? '' : (() => {
    /* walk back to this block's opening EJS guard, forward to its close */
    const start = code.lastIndexOf('<% if', idx);
    const end   = code.indexOf('<% } %>', idx);
    return code.slice(start < 0 ? 0 : start, end < 0 ? code.length : end);
  })();
  const cBlock = blockAround(ci);

  ok('Clarity runs at parse time, with no deferral wrapper',
     !/setTimeout\(load,\s*\d+\)/.test(cBlock) &&
     !/addEventListener\(e,load/.test(cBlock),
     'the whole point of the current state is that Clarity is NOT deferred — ' +
     'if a loader has crept back, the isolation test is invalid');
  ok('Clarity still creates the script itself (stock snippet shape)',
     /createElement\(r\)/.test(cBlock) && /insertBefore/.test(cBlock),
     'Microsoft injects rather than using a plain src tag; keeping that shape ' +
     'means we are testing their snippet, not our approximation of it');
  ok('the Clarity id is interpolated, not hardcoded',
     /clarityId/.test(cBlock),
     'a literal id here would survive an env change and mislead');

  const gBlock = blockAround(code.indexOf('googletagmanager.com/gtag/js'));
  /* Asserted as the ABSENCE of the loader's parts, not just of the timer.
     Deleting only `setTimeout(load,3000)` would leave gtag loading solely on
     first interaction with no fallback at all — strictly worse than the
     deferral it replaced, and invisible in any lab measurement, which never
     interacts with the page. That is the specific wrong outcome this guards
     against, so all three pieces are named. */
  ok('GA4 has no timer',
     !/setTimeout\(load,\s*\d+\)/.test(gBlock),
     'GA4 now loads with the page; a timer means the loader is back');
  ok('GA4 has no interaction listeners',
     !/pointerdown/.test(gBlock) && !/addEventListener\(e,load/.test(gBlock),
     'interaction-gated loading with no timer is the worst of both — gtag ' +
     'would never fire for a visitor who reads and leaves');
  ok('GA4 has no visibilitychange fallback',
     !/visibilitychange/.test(gBlock),
     'a leftover fallback implies the rest of the loader is meant to be there');
  ok('GA4 still injects the script and still primes dataLayer first',
     /createElement\('script'\)/.test(gBlock) &&
     gBlock.indexOf('window.dataLayer') > -1 &&
     gBlock.indexOf('window.dataLayer') < gBlock.indexOf('createElement'),
     'the config calls must be queued BEFORE the tag is requested or the ' +
     'pageview can arrive without the real URL and referrer');
  ok('the two blocks are genuinely separate',
     gBlock.indexOf('clarity.ms') === -1 && cBlock.indexOf('googletagmanager') === -1,
     'if one block contains both markers the slicing is wrong and every ' +
     'assertion above is measuring the wrong thing');
}

/* ═══ 3. THE CSP HOSTS THAT ACTUALLY GET CONSULTED ══════════════════
   scriptSrc deliberately has no entry — 'strict-dynamic' covers the
   injected tag, and a host there is ignored by CSP3 browsers. connectSrc
   is the one that silently kills the beacons if it is wrong. */
console.log('\n--- connect-src carries the hosts the beacons need ---');
{
  const connect = server.slice(server.indexOf('connectSrc:'),
                               server.indexOf('frameSrc:'));
  ok("connect-src allows the Clarity tag host and its regional ingests",
     /'https:\/\/\*\.clarity\.ms'/.test(connect),
     'the wildcard covers a.clarity.ms, b.clarity.ms and friends');
  ok("connect-src allows c.bing.com",
     /'https:\/\/c\.bing\.com'/.test(connect),
     'Clarity posts its own telemetry here; without it every page throws');

  /* Regression guard on the entries that already cost a deploy. */
  ok('the Google Maps pair is still intact',
     /maps\.googleapis\.com/.test(connect) && /places\.googleapis\.com/.test(connect),
     'both are needed — see the note in server.js, learned 2026-09-27');
  ok('the GA4 beacon hosts are still intact',
     /google-analytics\.com/.test(connect) && /googletagmanager\.com/.test(connect));
}

/* ═══ 4. NO DEFERRED LOADERS ANYWHERE IN THE LAYOUT ═════════════════
   Section 2 checks each tag's own block. This one sweeps the WHOLE file, so
   a third tag added later with a copied-and-pasted loader is caught even
   though sections 2 and 3 know nothing about it. */
console.log('\n--- no deferred loader anywhere in the layout ---');
{
  const loaders = (code.match(/setTimeout\(load,\s*\d+\)/g) || []).length;
  ok('there are no deferred script loaders',
     loaders === 0,
     `found ${loaders} — expected 0. Both analytics tags load with the page ` +
     `as of 2026-09-30; if a loader is being reintroduced on the strength of ` +
     `a fresh measurement, update section 2 and this count together and ` +
     `record the number in the template comment`);
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
