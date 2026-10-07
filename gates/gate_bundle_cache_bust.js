#!/usr/bin/env node
'use strict';

/* gate_bundle_cache_bust.js
 *
 * site-bundle.css may not change without ?v= changing with it.
 *
 * main.ejs has said "BUMP THIS EVERY TIME site-bundle.css CHANGES" in a
 * comment for months. On 2026-10-07 I edited the bundle in c40e959 and did
 * not bump it, and the failure was worse than a stale style because the
 * same commit REMOVED the inline text-align from .iwt-text-col:
 *
 *   returning visitor = new markup (no inline override)
 *                     + cached v=44 stylesheet (align-items:flex-start)
 *                     = left aligned, with nothing able to correct it
 *
 * Every fresh context - the Theme Editor preview, a desktop session that
 * happened to refetch - looked correct, so the bug only showed on a real
 * phone that had the old file. A comment cannot enforce this; a hash can.
 *
 * TO BUMP: change ?v= in main.ejs and re-record the hash:
 *   node -e 'const c=require("crypto"),f=require("fs");
 *            f.writeFileSync("public/css/bundle-version.json",
 *              JSON.stringify({v:<NEW>,sha256:c.createHash("sha256")
 *                .update(f.readFileSync("public/css/site-bundle.css"))
 *                .digest("hex")},null,2))'
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const ROOT   = path.join(__dirname, '..');

let checks = 0, fails = 0;
const ok    = m => { checks++; console.log('  ok   ' + m); };
const bad   = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);

console.log('\ngate_bundle_cache_bust — the bundle cannot move without ?v= moving\n');

const bundlePath = path.join(ROOT, 'public/css/site-bundle.css');
const recPath    = path.join(ROOT, 'public/css/bundle-version.json');

check(fs.existsSync(recPath), 'the recorded version file exists');
if (!fs.existsSync(recPath)) { console.log('\ngate_bundle_cache_bust: FAILED'); process.exit(1); }

const rec  = JSON.parse(fs.readFileSync(recPath, 'utf8'));
const sha  = crypto.createHash('sha256').update(fs.readFileSync(bundlePath)).digest('hex');
const main = fs.readFileSync(path.join(ROOT, 'views/layouts/main.ejs'), 'utf8');

/* The link tag is the only thing a browser sees, so it is the authority. */
const tags = [...main.matchAll(/site-bundle\.css\?v=(\d+)/g)].map(m => Number(m[1]));
check(tags.length === 1,
      'exactly one site-bundle.css link tag carries a version (' + tags.length + ')',
      'two tags would let one go stale unnoticed');

check(sha === rec.sha256,
      'site-bundle.css matches the hash recorded against v=' + rec.v,
      'the bundle changed. Bump ?v= in main.ejs AND re-record the hash — see the header of this file.\n' +
      '         recorded ' + String(rec.sha256).slice(0, 16) + '...\n' +
      '         actual   ' + sha.slice(0, 16) + '...');

check(tags[0] === rec.v,
      'main.ejs serves ?v=' + rec.v + ', the version the hash was recorded against',
      'main.ejs says v=' + tags[0] + ', record says v=' + rec.v);

/* The history comment is how the next person learns what each bump was for,
   and it is the only place the reason survives. */
const histed = new RegExp('v=' + rec.v + ' \\(').test(main);
check(histed, 'and the bump is listed in the version history comment');

console.log('\n' + (fails
  ? 'gate_bundle_cache_bust: FAILED ' + fails + ' of ' + checks
  : 'gate_bundle_cache_bust: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
