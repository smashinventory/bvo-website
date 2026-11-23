#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_agent_readiness.js
 *
 * THE RULE: robots.txt states our content preference, llms.txt is served
 * from a ROUTE rather than a file, and both close themselves on the
 * non-canonical host.
 *
 * WHY A ROUTE AND NOT public/llms.txt. This repo has already been bitten:
 * the live host served a public/robots.txt containing
 *
 *     User-agent: Googlebot
 *     Disallow: /
 *
 * while the app's own route said Allow. Nothing in the code was wrong and
 * nothing logged; a static file simply won, because express.static sat
 * above the route. llms.txt is served above express.static for the same
 * reason, and this gate asserts the ordering holds.
 *
 * ⚠️ WHAT THIS DOES NOT CLAIM. Content-Signal is a request, not a fence,
 * and llms.txt has no confirmed consumer. These checks assert that what we
 * say is what we meant to say — not that anyone obeys it.
 *
 * Run:  node gates/gate_agent_readiness.js
 * Exit: 0 = pass, 1 = fail
 * ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const ok = (c, label, why) => {
  if (c) { console.log('  ok   ' + label); pass++; }
  else   { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
};

console.log('\ngate_agent_readiness — what we tell crawlers, and from where\n');

const src  = read('src/server.js');
/* Comments are not code. A note ABOUT Content-Signal is not a directive,
   and this repo has had six gates fooled by exactly that. */
const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('--- served from a route, above express.static ---');
{
  /* ⚠️ THE UNSCOPED MOUNT IS THE ONLY ONE THAT CAN SHADOW A ROOT PATH, and
     the first version of this check got that wrong. server.js has three
     express.static mounts: /docs/uploads, /images/uploads, and public/.
     The first two are path-scoped and can never answer /robots.txt or
     /llms.txt, but a bare indexOf('express.static') finds /docs/uploads at
     line 515 and concluded both routes were registered too late — failing
     on correct code. Match `app.use(express.static(`, with no path
     argument, which is the public/ mount and the only real hazard. */
  const iStatic = code.search(/app\.use\(\s*express\.static\(/);
  const iLlms   = code.indexOf("app.get('/llms.txt'");
  const iRobots = code.indexOf("app.get('/robots.txt'");

  ok(iLlms !== -1, 'llms.txt has a route', 'nothing serves it');
  ok(iRobots !== -1, 'robots.txt still has a route');
  ok(iStatic !== -1, 'the unscoped public/ static mount is found (sanity check)',
     'if this fails the two ordering checks below are meaningless, not passing');
  ok(iLlms !== -1 && iStatic !== -1 && iLlms < iStatic,
     'the llms.txt route is registered BEFORE express.static',
     'a file at public/llms.txt would shadow the route silently — which is ' +
     'exactly what happened to robots.txt on this host');
  ok(iRobots !== -1 && iStatic !== -1 && iRobots < iStatic,
     'the robots.txt route is still before express.static');

  ok(!fs.existsSync(path.join(ROOT, 'public/llms.txt')),
     'no public/llms.txt exists to shadow the route',
     'delete it; the route is the source');
  ok(!fs.existsSync(path.join(ROOT, 'public/robots.txt')),
     'no public/robots.txt exists to shadow the route',
     'this is the exact file that broke crawling once already');
}

console.log('\n--- robots.txt states the content preference ---');
{
  const m = code.match(/Content-Signal:\s*([^\\\n`]+)/);
  ok(!!m, 'a Content-Signal directive is present',
     'the owner chose search=yes, ai-input=yes, ai-train=no on 2026-11-23');
  if (m) {
    const sig = m[1];
    ok(/search\s*=\s*yes/.test(sig),   `search=yes  (${sig.trim()})`,
       'refusing indexing would remove the site from search entirely');
    ok(/ai-train\s*=\s*no/.test(sig),  'ai-train=no',
       'the owner declined model training; flipping this is a business decision');
    /* ⚠️ ai-input IS NOT ai-train. Retrieval to ground an answer is the case
       the owner actively WANTS; training is the one they declined. Leaving
       ai-input unstated leaves the wanted case to a crawler's guess. */
    ok(/ai-input\s*=\s*yes/.test(sig), 'ai-input=yes, stated explicitly',
       'without it, whether we welcome answer-grounding is left to inference');
  }
}

console.log('\n--- both files close on the non-canonical host ---');
{
  /* 6,000 indexable URLs on a staging hostname is a duplicate of the whole
     catalogue. The same reasoning already governs robots.txt. */
  const llmsBlock = code.slice(code.indexOf("app.get('/llms.txt'"));
  ok(/host\s*!==\s*CANONICAL_HOST/.test(llmsBlock.slice(0, 600)),
     'llms.txt checks the host before answering',
     'staging would advertise itself as a source for the catalogue');
}

console.log('\n--- llms.txt is a map, not a catalogue ---');
{
  const block = src.slice(src.indexOf("app.get('/llms.txt'"));
  const body  = block.slice(0, block.indexOf('\n});') + 1);

  ok(/sitemap\.xml/.test(body),
     'it points at sitemap.xml for the full URL set',
     'without it, a crawler has no route to the complete catalogue');
  /* ⚠️ NO LIVE NUMBERS. A product count or a price in a file an assistant
     quotes is wrong the day after it is written. The sitemap and the page
     are the places those live. */
  ok(!/\b\d{3,}\s*(?:products|vanities|items|SKUs)/i.test(body),
     'it quotes no product count',
     'a stale number in a quotable file is worse than no number');
  ok(!/\$\s?\d/.test(body),
     'it quotes no prices',
     'prices change daily; they belong on the page and in the Offer node');
  ok(/no retail showroom|online only/i.test(body),
     'it states the business is online-only',
     'consistent with the structured data, which deliberately claims no ' +
     'LocalBusiness — see gate_structured_data.js');
}

console.log('\n--- the homepage advertises the map ---');
{
  ok(/rel="llms-txt"/.test(code), 'a Link header advertises llms.txt');
  ok(/req\.path\s*===\s*'\/'/.test(code),
     'the Link header is homepage-only',
     'on every response it is noise repeated 6,000 times');
}

console.log(fail ? `\n*** ${fail} of ${pass + fail} CHECKS FAILED ***`
                 : `\nALL ${pass} CHECKS PASS`);
process.exit(fail ? 1 : 0);
