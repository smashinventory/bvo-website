'use strict';
/* ARTICLE CONTENT IS PLAIN ASCII, AND AMERICAN ENGLISH.
 *
 * WHY THIS GATE EXISTS. The owner opened a draft article and saw:
 *
 *     "later a€" and"      "lacquer a€" this"
 *
 * That is mojibake: a UTF-8 em-dash (U+2014) decoded as Windows-1252. The
 * draft file was correct UTF-8 and the viewer was wrong - but the same
 * corruption can happen anywhere the charset is assumed rather than declared,
 * and the article path has several such links: the file, the SQL client that
 * runs the migration, the MySQL connection charset, the column collation, and
 * finally the response encoding. Getting all five right forever is not a thing
 * anyone can promise.
 *
 * So the rule is not "declare the charset correctly everywhere". It is
 * ARTICLE BODIES CONTAIN ONLY ASCII. A character that cannot be mis-decoded
 * cannot appear as garbage on a product page. Em-dashes, curly quotes,
 * ellipses and non-breaking spaces all buy typography worth less than the risk.
 *
 * SECOND RULE, SAME FILE: American English. The site is American, the column
 * is literally `color_family`, and the owner had to correct me for writing
 * "colour" and "centre" repeatedly. Checked here so the decision survives.
 *
 * ⚠️ SCOPE. This gate checks ARTICLE CONTENT ONLY - the migration files that
 * write pages.content, and the HTML drafts they are built from. It does NOT
 * check src/ or views/. Code and config are deliberately out of scope:
 * src/config/colorFamilies.js holds 'Grey' as a vendor-feed alias that MUST
 * keep its British spelling to match incoming data, and orderStatuses.js holds
 * 'cancelled' as a stored status value. A blanket find-and-replace over the
 * repo would break both. That is the whole reason the scope is narrow.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

/* The files that carry article prose. A migration qualifies by naming
   pages.content, so a new one is picked up without editing this list. */
function articleFiles() {
  const out = [];
  const mig = path.join(ROOT, 'migrations');
  if (fs.existsSync(mig)) {
    for (const f of fs.readdirSync(mig)) {
      if (!/\.sql$/i.test(f)) continue;
      const p = path.join(mig, f);
      const s = fs.readFileSync(p, 'utf8');
      /* ⚠️ Strip SQL comments first. These migrations carry long explanatory
         headers which themselves discuss the words being banned - a search
         over raw text would match the prose explaining the rule and fail a
         correct file. That exact comment-vs-code trap has produced both false
         reds and a false green in this codebase. */
      const code = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*--.*$/gm, '');
      if (/pages\s+SET\s+content|pages\.content|INSERT\s+INTO\s+pages/i.test(code)) {
        out.push({ p, rel: 'migrations/' + f, code });
      }
    }
  }
  const briefs = path.join(ROOT, 'docs/briefs');
  if (fs.existsSync(briefs)) {
    for (const f of fs.readdirSync(briefs)) {
      if (!/^article_.*\.html$/i.test(f)) continue;
      const p = path.join(briefs, f);
      out.push({ p, rel: 'docs/briefs/' + f, code: fs.readFileSync(p, 'utf8') });
    }
  }
  return out;
}

const files = articleFiles();

console.log('--- article content is plain ASCII ---');
ok('there is article content to check', files.length > 0,
   'no migration writes pages.content and no article_*.html draft exists');

for (const f of files) {
  const bad = [];
  for (let i = 0; i < f.code.length; i += 1) {
    const cp = f.code.codePointAt(i);
    if (cp > 127) {
      const line = f.code.slice(0, i).split('\n').length;
      bad.push(`U+${cp.toString(16).toUpperCase().padStart(4, '0')} at line ${line}`);
      if (bad.length >= 6) break;
    }
  }
  ok(`${f.rel} is ASCII`, bad.length === 0,
     `non-ASCII will mojibake if any charset in the chain is wrong: ${bad.join('; ')}`);
}

console.log('--- article content is American English ---');
/* Word-boundary matched. 'colour' would otherwise hit 'color_family' and
   'grey' would hit nothing useful; the boundaries are what make this safe to
   run over SQL that legitimately names American columns. */
const BRITISH = [
  'colour', 'colours', 'coloured', 'centre', 'centres', 'centred', 'grey',
  'organise', 'organised', 'organisation', 'recognise', 'recognised',
  'customise', 'customised', 'personalise', 'optimise', 'minimise',
  'maximise', 'analyse', 'analysed', 'catalogue', 'catalogues', 'favourite',
  'behaviour', 'labour', 'honour', 'neighbour', 'metre', 'litre',
  'aluminium', 'enquire', 'enquiry', 'whilst', 'amongst', 'programme',
  'speciality', 'storey', 'travelling', 'fulfilment', 'instalment',
  'licence', 'practise', 'defence', 'offence', 'mould', 'draught',
  'kerb', 'tyre', 'jewellery',
];
const RE = new RegExp('\\b(' + BRITISH.join('|') + ')\\b', 'gi');

for (const f of files) {
  const hits = [...new Set((f.code.match(RE) || []).map(w => w.toLowerCase()))];
  ok(`${f.rel} has no British spellings`, hits.length === 0,
     `American English only in article copy: ${hits.join(', ')}`);
}

console.log('--- the narrow scope is deliberate, and still true ---');
/* If colorFamilies.js ever loses its 'Grey' alias, incoming feed rows
   spelled that way stop matching a colour family. Asserted here because this
   gate is the most likely thing to tempt someone into a repo-wide replace. */
const cf = path.join(ROOT, 'src/config/colorFamilies.js');
if (fs.existsSync(cf)) {
  ok("colorFamilies.js still carries its 'Grey' vendor alias",
     /'Grey'/.test(fs.readFileSync(cf, 'utf8')),
     'a repo-wide spelling replace has broken vendor colour matching');
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
