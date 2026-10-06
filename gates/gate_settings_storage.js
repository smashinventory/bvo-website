#!/usr/bin/env node
'use strict';

/* gate_settings_storage.js
 *
 * THE BUG THIS EXISTS TO PREVENT
 *
 * themeSettings.save() wrote the FULLY MERGED settings object back to
 * data/theme_settings.json. load() is deepMerge(DEFAULTS, file), so every save
 * froze every current default into the file as an explicit value. After that,
 * changing a default in themeSettings.js did nothing for that key — for ever,
 * with no error and nothing in the logs.
 *
 * It cost a real day: seo.filter_landing_min_products was changed 25 -> 10,
 * deployed, verified green, and the live site carried on behaving as 25.
 * Measured against the live file the same morning: 109 of 130 scalar keys were
 * byte-identical to their defaults and existed only to shadow them.
 *
 * WHAT IS ASSERTED
 *
 *   1. ONE writer. There were three — themeSettings.save(), the initFromDb
 *      restore branch, and a duplicate in adminController._persistSettings
 *      that ran last and undid the other two. Three writers is how this
 *      survived: thinning any one of them would have been silently overwritten.
 *   2. The file write goes through thinForStorage.
 *   3. The DB copy is thinned too — it is the restore source on a fresh
 *      Hostinger deploy, so a fat row would hand the stale defaults back on the
 *      next wipe and the fix would last until then.
 *   4. thinForStorage is EXECUTED against the real settings file:
 *        - round trip: deepMerge(DEFAULTS, thin(x)) === x
 *        - a value equal to its default is dropped
 *        - a value differing from its default is kept
 *        - a key with no default at all is kept
 *        - arrays are atomic (deepMerge cannot read a partial array back)
 *        - the cache keeps the FULL object, so no reader sees a thinner one
 *
 * Nothing here pins a byte count or a key name. Those change as the catalogue
 * and the settings do; what must hold is the behaviour.
 */

const fs   = require('fs');
const path = require('path');
const vm   = require('vm');
const ROOT = path.join(__dirname, '..');

let fails = 0, checks = 0;
const ok  = m => { checks++; console.log('  ok   ' + m); };
const bad = (m, d) => { checks++; fails++; console.log('  FAIL ' + m + (d ? '\n         ' + d : '')); };
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const read = r => fs.readFileSync(path.join(ROOT, r), 'utf8');

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/[^\n]*/g, '');
}

console.log('\ngate_settings_storage — a saved default must never shadow a new one\n');

const svc   = read('src/services/themeSettings.js');
const admin = read('src/controllers/adminController.js');
const svcC  = stripComments(svc);
const adminC = stripComments(admin);

/* ── 1. one writer ───────────────────────────────────────────────────────── */
const writes = (svcC.match(/writeFileSync\s*\(\s*SETTINGS_PATH/g) || []).length;
check(writes === 1,
      'exactly one writeFileSync(SETTINGS_PATH) in the service', 'found ' + writes);

check(!/writeFileSync\s*\([^)]*theme_settings\.json/.test(adminC) &&
      !/theme_settings\.json['"]\s*\)/.test(adminC.replace(/require\([^)]*\)/g, '')),
      'adminController no longer writes the settings file itself');
check(/themeSettings\.writeSettingsFile\s*\(/.test(adminC),
      'adminController delegates to themeSettings.writeSettingsFile');

/* ── 2 + 3. both persisted copies are thinned ────────────────────────────── */
check(/writeFileSync\s*\(\s*SETTINGS_PATH\s*,\s*JSON\.stringify\(\s*thinForStorage\(/.test(svcC),
      'the file write is thinned');
check(/\[\s*['"]theme_settings['"]\s*,\s*JSON\.stringify\(\s*thinForStorage\(/.test(svcC),
      'the DB copy is thinned too (it is the restore source after a deploy wipe)');

/* ── 4. execute thinForStorage against the REAL file ─────────────────────── */
function lift(name, extraCtx) {
  const i = svc.indexOf('function ' + name);
  if (i === -1) return null;
  const open = svc.indexOf('{', i);
  let d = 0;
  for (let j = open; j < svc.length; j++) {
    if (svc[j] === '{') d++;
    else if (svc[j] === '}') { d--; if (d === 0)
      return vm.runInNewContext(svc.slice(i, j + 1) + '\n' + name + ';', extraCtx || {}); }
  }
  return null;
}

const di = svc.indexOf('const DEFAULTS');
const DEFAULTS = vm.runInNewContext(
  svc.slice(di, svc.indexOf('\n};', di) + 3).replace(/^const DEFAULTS\s*=/, 'x =') + '\nx;',
  { require: m => require(path.resolve(ROOT, 'src/services', m)) });

const deepMerge = lift('deepMerge');
const thin      = lift('thinForStorage', { DEFAULTS });
check(!!deepMerge && !!thin, 'deepMerge and thinForStorage are liftable from the service');

if (deepMerge && thin) {
  const FILE = path.join(ROOT, 'data/theme_settings.json');
  const saved = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
  const full  = deepMerge(DEFAULTS, saved);

  /* THE ROUND TRIP. If this ever fails, thinning is losing real settings. */
  const thinned = thin(full, DEFAULTS);
  check(JSON.stringify(deepMerge(DEFAULTS, thinned)) === JSON.stringify(full),
        'round trip: deepMerge(DEFAULTS, thin(x)) reproduces x exactly');

  check(JSON.stringify(thinned).length < JSON.stringify(full).length,
        'the thinned form is actually smaller than the merged one');

  /* A value equal to its default is dropped. Picked from the real DEFAULTS
     rather than hardcoded, so this cannot be testing a key that does not
     exist — which is exactly what it WAS doing before the duplicate-key bug
     below was found: DEFAULTS.seo.home_title was undefined, the test compared
     undefined to undefined, and it looked like a thinning failure. */
  const sampleKey = Object.keys(DEFAULTS.seo).find(k => typeof DEFAULTS.seo[k] === 'string'
                                                     && DEFAULTS.seo[k].length > 0);
  check(!!sampleKey, 'DEFAULTS.seo has a non-empty string default to test with');
  const eq = thin({ seo: { [sampleKey]: DEFAULTS.seo[sampleKey] } }, DEFAULTS);
  check(Object.keys(eq).length === 0,
        'a value identical to its default is not written');

  /* A value differing from its default is kept. */
  const df = thin({ seo: { [sampleKey]: 'something the admin typed' } }, DEFAULTS);
  check(df.seo && df.seo[sampleKey] === 'something the admin typed',
        'a value differing from its default IS written');

  /* A key with no default is kept — there is nothing to fall back to. */
  const nd = thin({ seo: { zzz_no_such_default: 'keep me' } }, DEFAULTS);
  check(nd.seo && nd.seo.zzz_no_such_default === 'keep me',
        'a key with no default at all is always written');

  /* Arrays atomic. deepMerge replaces arrays wholesale rather than merging
     them, so a partial array could not be read back. */
  const arrSame = thin({ nav: { links: DEFAULTS.nav.links } }, DEFAULTS);
  check(Object.keys(arrSame).length === 0,
        'an array identical to its default is omitted entirely');
  const arrDiff = thin({ nav: { links: [{ label: 'One', url: '/x' }] } }, DEFAULTS);
  check(Array.isArray(arrDiff.nav && arrDiff.nav.links) && arrDiff.nav.links.length === 1,
        'a differing array is written WHOLE, not diffed per item');

  /* THE POINT OF THE WHOLE EXERCISE: a default changed after a save must now
     take effect. Simulated with the real file plus a pinned value. */
  const DEF_THEN = JSON.parse(JSON.stringify(DEFAULTS));
  DEF_THEN.seo[sampleKey] = 'OLD DEFAULT';
  const fileFromThen = thin(deepMerge(DEF_THEN, saved), DEF_THEN);
  const DEF_NOW = JSON.parse(JSON.stringify(DEFAULTS));
  DEF_NOW.seo[sampleKey] = 'NEW DEFAULT';
  const got = deepMerge(DEF_NOW, fileFromThen).seo[sampleKey];
  check(got === 'NEW DEFAULT' || (saved.seo && saved.seo[sampleKey] !== undefined
        && got === saved.seo[sampleKey]),
        'a default changed AFTER a save takes effect, unless the admin set that key',
        'got ' + JSON.stringify(got));
}

/* ── 5. NO DUPLICATE KEYS IN DEFAULTS ────────────────────────────────────
   Two keys of the same name in one object literal is not a syntax error —
   JavaScript keeps the LAST one and discards the first silently. DEFAULTS had
   TWO `seo:` blocks about a thousand lines apart; the second won, so the seven
   real SEO defaults were thrown away and og_image_alt rendered undefined on
   every page. Nothing caught it because the saved settings file supplied most
   of the lost values. Checked structurally, at every nesting level. */
{
  const di2 = svc.indexOf('const DEFAULTS');
  const body = svc.slice(di2, svc.indexOf('\n};', di2));
  const noComments = stripComments(body);
  const dupes = [];
  const seen = new Map();   // indent -> Set(keys) for that brace depth
  let depth = 0;
  for (const line of noComments.split('\n')) {
    const opens = (line.match(/[{[]/g) || []).length;
    const closes = (line.match(/[}\]]/g) || []).length;
    const m = line.match(/^\s*([a-zA-Z_][\w]*)\s*:/);
    if (m) {
      if (!seen.has(depth)) seen.set(depth, new Set());
      const set = seen.get(depth);
      if (set.has(m[1])) dupes.push(`${m[1]} (depth ${depth})`);
      else set.add(m[1]);
    }
    if (opens > closes) { depth += opens - closes; }
    else if (closes > opens) {
      for (let d = depth; d > depth - (closes - opens); d--) seen.delete(d);
      depth -= closes - opens;
    }
  }
  check(dupes.length === 0,
        'no duplicate keys in DEFAULTS (a later one silently discards the earlier)',
        dupes.join(', '));

  /* The specific loss that started this, asserted by name so it cannot
     regress quietly. */
  check(Object.keys(DEFAULTS.seo).length > 1,
        'DEFAULTS.seo carries more than just the threshold',
        JSON.stringify(Object.keys(DEFAULTS.seo)));
  for (const k of ['home_title', 'og_image', 'og_image_alt', 'filter_landing_min_products']) {
    check(DEFAULTS.seo[k] !== undefined, `DEFAULTS.seo.${k} exists`);
  }
}

/* ── 6. the cache must stay fat ──────────────────────────────────────────── */
check(/_cache\s*=\s*settings\s*;/.test(svcC) && !/_cache\s*=\s*thinForStorage/.test(svcC),
      'the in-memory cache keeps the FULL object — only the file is thinned');

console.log('\n' + (fails
  ? 'gate_settings_storage: FAILED ' + fails + ' of ' + checks
  : 'gate_settings_storage: all ' + checks + ' checks pass'));
process.exit(fails ? 1 : 0);
