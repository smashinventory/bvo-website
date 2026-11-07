'use strict';
/* MUTATION HARNESS for the JM review-figure checks in gate_structured_data.js.
 *
 * A gate nobody has watched fail is a decoration. This breaks each guarded
 * property on purpose, one at a time, and asserts the gate goes RED. If a
 * mutation leaves the gate green, that check is not testing what its name
 * claims and this harness exits non-zero.
 *
 * ⚠️ A MISSING ANCHOR IS A FAILURE, NOT A SKIP. If the code moves and a
 * mutation's search string no longer matches, that is reported as a hard
 * failure. A harness that quietly skips mutations it can no longer apply
 * reports "all mutations caught" while testing nothing — which is strictly
 * worse than having no harness, because it is believed.
 *
 * Every file is restored byte-for-byte and the restore is VERIFIED by hash
 * before the process exits, including on an unexpected throw.
 */

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const GATE = path.join(__dirname, 'gate_structured_data.js');

const VIEW = 'views/pages/collection.ejs';
/* The figures moved to a dependency-free config module so the gate can run
   without a database. Anchors follow them. */
const SETT = 'src/config/jmvReviews.js';

const abs    = p => path.join(ROOT, p);
const sha    = p => crypto.createHash('sha256').update(fs.readFileSync(abs(p))).digest('hex');
const RED    = '\u001b[31m', GRN = '\u001b[32m', OFF = '\u001b[0m';

/* Snapshot every file any mutation touches. */
const TOUCHED = [VIEW, SETT];
const ORIGINAL = {};
for (const f of TOUCHED) ORIGINAL[f] = { text: fs.readFileSync(abs(f), 'utf8'), hash: sha(f) };

function restoreAll() {
  for (const f of TOUCHED) {
    fs.writeFileSync(abs(f), ORIGINAL[f].text);
    if (sha(f) !== ORIGINAL[f].hash) {
      console.error(`${RED}CATASTROPHE${OFF}  ${f} did not restore. Run: git checkout -- ${f}`);
      process.exitCode = 2;
    }
  }
}
process.on('exit', restoreAll);
process.on('SIGINT', () => { restoreAll(); process.exit(130); });

/* The gate passes only when it exits 0. */
function gateIsGreen() {
  try {
    execFileSync(process.execPath, [GATE],
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, DB_PASS: process.env.DB_PASS || 'dummy' } });
    return true;
  } catch { return false; }
}

/* Each mutation: a file, a string that must exist, and its replacement. */
const MUTATIONS = [
  { name: 'star markup gains an itemprop',
    file: VIEW,
    find: '<span class="jmv-rev-score">',
    repl: '<span class="jmv-rev-score" itemprop="ratingValue">',
    guards: 'the block emits no itemprop / ratingValue' },

  { name: 'the attribution phrase is removed',
    file: VIEW,
    find: 'at national\n        retailers',
    repl: 'from our customers',
    guards: 'the block states the figures are not ours' },

  { name: 'a threshold is retyped into the template',
    file: VIEW,
    find: '<span class="jmv-rev-count">',
    repl: '<span class="jmv-rev-count" data-min="30">',
    guards: 'the template contains no threshold numbers' },

  { name: 'the review floor is loosened to 1',
    file: SETT,
    find: 'min_reviews: 5,',
    repl: 'min_reviews: 1,',
    guards: 'min_reviews is still 5' },

  { name: 'the spread rule is loosened to 2.0',
    file: SETT,
    find: 'max_spread:  0.5,',
    repl: 'max_spread:  2.0,',
    guards: 'max_spread is still 0.5' },

  { name: 'Breckenridge is published despite its 1.14 spread',
    file: SETT,
    find: "    myrrin: {",
    repl: "    breckenridge: {\n" +
          "      show: true,  brand: 'James Martin Vanities', model: 'Breckenridge',\n" +
          "      rating: '4.2', count: '32', hd: '3.43', ferguson: '4.57',\n" +
          "    },\n" +
          "    myrrin: {",
    guards: 'retailers agree within 0.5' },

  { name: 'a figure loses its brand, so it could match either brand',
    file: SETT,
    find: "show: true,  brand: 'James Martin Vanities', model: 'Bristol',",
    repl: "show: true,  brand: '', model: 'Bristol',",
    guards: 'brand and model are both set' },

  { name: 'a published rating is not supported by either retailer',
    file: SETT,
    find: "rating: '4.3', count: '184', hd: '4.31', ferguson: '4.24',",
    repl: "rating: '4.9', count: '184', hd: '4.31', ferguson: '4.24',",
    guards: 'published rating lies between the two retailer averages' },

  { name: 'the review block is deleted from the template',
    file: VIEW,
    find: '<section class="jmv-rev">',
    repl: '<section class="jmv-rev-REMOVED">',
    guards: 'the review block exists in collection.ejs' },
];

console.log('Baseline: the gate must be GREEN before any mutation.\n');
if (!gateIsGreen()) {
  console.error(`${RED}ABORT${OFF}  the gate is already failing. Fix that before trusting this harness.`);
  process.exit(1);
}
console.log(`${GRN}ok${OFF}  baseline green\n`);

let missed = 0, missing = 0;
for (const m of MUTATIONS) {
  const before = ORIGINAL[m.file].text;
  if (!before.includes(m.find)) {
    console.error(`${RED}ANCHOR MISSING${OFF}  ${m.name}`);
    console.error(`                 ${m.file} no longer contains: ${JSON.stringify(m.find.slice(0, 60))}`);
    console.error('                 The code moved. Re-anchor this mutation — do NOT delete it.');
    missing += 1;
    continue;
  }
  fs.writeFileSync(abs(m.file), before.replace(m.find, m.repl));
  const green = gateIsGreen();
  fs.writeFileSync(abs(m.file), before);            // restore immediately

  if (green) {
    console.error(`${RED}NOT CAUGHT${OFF}  ${m.name}`);
    console.error(`              expected to trip: ${m.guards}`);
    missed += 1;
  } else {
    console.log(`${GRN}caught${OFF}      ${m.name}`);
  }
}

console.log();
if (missing) console.error(`${RED}${missing} mutation(s) could not be applied — anchors are stale.${OFF}`);
if (missed)  console.error(`${RED}${missed} mutation(s) went undetected — those checks do not work.${OFF}`);
if (!missing && !missed) console.log(`${GRN}All ${MUTATIONS.length} mutations caught.${OFF}`);

process.exit((missing || missed) ? 1 : 0);
