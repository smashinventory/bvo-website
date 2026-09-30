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

/* ═══ 2. GA4 DEFERRED, CLARITY EAGER ════════════════════════════════
   These two are asymmetric ON PURPOSE as of 2026-09-30, and the asymmetry
   is the point of the experiment running right now.

   GA4 stays deferred: its 3s / first-interaction loader is a measured LCP
   decision (~250ms on throttled mobile, plus the page's only long
   main-thread task).

   Clarity was shipped deferred too, and never registered its install —
   across a multi-page phone session that reached the cart, where prior
   installs have always registered within minutes. The deferral was the one
   variable we had introduced, so Clarity is now Microsoft's stock snippet,
   loading at parse time, to isolate it.

   So this section asserts DIFFERENT things about the two tags. If Clarity
   is later returned to a deferred loader, this section flips back and the
   loader count below goes to 2. */
console.log('\n--- GA4 loads late; Clarity loads with the page ---');
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
     !/setTimeout\(load,3000\)/.test(cBlock) &&
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
  ok('GA4 still has its 3s fallback',
     /setTimeout\(load,3000\)/.test(gBlock),
     'the GA4 loader must not have been disturbed by adding Clarity');
  ok('GA4 still waits for first interaction',
     /pointerdown/.test(gBlock) && /addEventListener\(e,load/.test(gBlock));
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

/* ═══ 4. EXACTLY ONE DEFERRED LOADER ════════════════════════════════
   GA4's, and only GA4's. Two would mean Clarity has been re-deferred and
   the isolation test is no longer running. Zero would mean GA4's measured
   LCP protection has been lost. */
console.log('\n--- exactly one deferred loader, and it is GA4 ---');
{
  const loaders = (code.match(/setTimeout\(load,3000\)/g) || []).length;
  ok('there is exactly one deferred loader',
     loaders === 1,
     `found ${loaders} — expected 1 (GA4). 2 means Clarity was re-deferred; ` +
     `0 means GA4 lost its LCP protection`);
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
