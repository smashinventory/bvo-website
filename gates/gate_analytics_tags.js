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

/* ═══ 2. BOTH ARE DEFERRED ══════════════════════════════════════════
   The 3s / first-interaction loader is a measured LCP decision, not a
   style. Microsoft's own snippet loads immediately; ours must not. */
console.log('\n--- both tags load late, not with the page ---');
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

  ok('Clarity waits for first interaction',
     /addEventListener\(e,load,\{passive:true\}\)/.test(cBlock) &&
     /pointerdown/.test(cBlock),
     'the interaction listeners are what make this deferred');
  ok('Clarity has a 3s fallback timer',
     /setTimeout\(load,3000\)/.test(cBlock),
     'without it a visitor who never interacts is never recorded');
  ok('Clarity fires on tab-hide too',
     /visibilitychange/.test(cBlock),
     'catches the tab-switcher who leaves before 3s');
  ok('Clarity is injected, not a direct <script src> in the head',
     !/<script[^>]+src=["']https:\/\/www\.clarity\.ms/.test(code),
     'a plain src tag in the head loads with the page and undoes the deferral');

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

/* ═══ 4. THE TWO LOADERS STAY SEPARATE ══════════════════════════════
   Deliberate duplication. If someone merges them to save five listeners,
   a mistake in the shared loader takes out both tags at once. */
console.log('\n--- the loaders are independent ---');
{
  const loaders = (code.match(/setTimeout\(load,3000\)/g) || []).length;
  ok('there are exactly two independent deferred loaders',
     loaders === 2,
     `found ${loaders} — one each for GA4 and Clarity is expected`);
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
