#!/usr/bin/env node
'use strict';

/**
 * docs/00-start/reindex.js — generate INDEX.md from the filesystem.
 *
 * WHY THIS EXISTS
 * The first version of INDEX.md was hand-maintained, with a note saying
 * "a document not in the index does not exist as far as the next session
 * is concerned." That is a description of a failure mode, not a fix: it
 * still depends on someone remembering to add the row. Remembering is the
 * step that keeps failing on this project.
 *
 * So the index is DERIVED. Walk docs/, read each file's own one-line
 * purpose, emit INDEX.md. A document cannot be missing from the index,
 * because the index is not a list anyone maintains — it is a rendering of
 * what is on disk.
 *
 * Each document declares its own purpose on the line after its H1:
 *
 *     # JMV Revenue Definition
 *     > Revenue basis and the warranty haircut.
 *
 * The description lives IN the document so it cannot drift away from it.
 * A file with no "> " line is listed as NEEDS DESCRIPTION — visible and
 * annoying, rather than silently absent.
 *
 * USAGE
 *   node docs/00-start/reindex.js            rewrite INDEX.md
 *   node docs/00-start/reindex.js --check    exit 1 if INDEX.md is stale
 *
 * --check is what a push gate runs. Adding a doc without reindexing then
 * fails the push, which is the only enforcement that has actually held.
 */

const fs   = require('fs');
const path = require('path');

const REPO      = path.resolve(__dirname, '..', '..');
const DOCS      = path.join(REPO, 'docs');
const INDEX     = path.join(DOCS, '00-start', 'INDEX.md');
const SELF      = 'INDEX.md';

/* Folder order and what each is for. A folder not listed here still gets
   indexed — under "UNFILED", loudly — so a new folder cannot hide. */
const SECTIONS = [
  ['00-start',     'START HERE — read before any work'],
  ['architecture', 'ARCHITECTURE — how a thing is built and why'],
  ['definitions',  'DEFINITIONS — settled meanings. Do not re-derive.'],
  ['briefs',       'BRIEFS — feature and integration specs'],
  ['reference',    'REFERENCE — policy, legal, launch'],
  ['audits',       'AUDITS'],
  ['rollbacks',    'ROLLBACKS — how to undo a specific change'],
  ['history',      'HISTORY — what changed, when, and why'],
];

function describe(file) {
  const txt   = fs.readFileSync(file, 'utf8');
  const lines = txt.split('\n');

  /* The description is the "> " line DIRECTLY under the H1 — blank lines
     allowed between, nothing else. Matching any "> " anywhere in the file
     pulled in warnings and mid-document asides, which produced an index
     full of confident nonsense. */
  const h1 = lines.findIndex(l => /^#\s+\S/.test(l));
  if (h1 !== -1) {
    for (let i = h1 + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      if (line.startsWith('>')) {
        return line.replace(/^>\s*/, '').trim().replace(/\|/g, '\\|');
      }
      break;                       // first non-blank isn't a quote -> none
    }
  }
  return h1 !== -1
    ? `⚠ NO DESCRIPTION — titled "${lines[h1].replace(/^#\s+/, '').trim()}"`
    : '⚠ NO DESCRIPTION';
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.md') && entry.name !== SELF) out.push(full);
  }
  return out;
}

function build() {
  const files = walk(DOCS).sort();
  const byFolder = new Map();
  for (const f of files) {
    const rel    = path.relative(DOCS, f).split(path.sep);
    const folder = rel.length > 1 ? rel[0] : '(docs root)';
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(f);
  }

  const L = [];
  L.push('# BVO — DOCUMENT INDEX');
  L.push('');
  L.push('> Generated file. Do not hand-edit — run `node docs/00-start/reindex.js`.');
  L.push('');
  L.push('Every document for this project. Nothing lives outside `BVO Node.js/docs/`.');
  L.push('');
  L.push('**New session:** you have a summary of ONE previous thread. This is all of');
  L.push('them. Read what the task touches BEFORE forming a view.');
  L.push('');
  L.push('**The numbered Rules (8, 9, 10, 11, 13) are in**');
  L.push('`docs/00-start/BVO_AUDIT_BRIEF.md` — not in CLAUDE.md.');
  L.push('');
  L.push('Descriptions come from each file\'s own `> ` line, so they cannot drift');
  L.push('from the document. A row flagged in the Purpose column has no such');
  L.push('line — add one to the top of that file, under its H1, then reindex.');
  L.push('');
  L.push('---');
  L.push('');

  const seen = new Set();
  for (const [folder, heading] of SECTIONS) {
    const items = byFolder.get(folder);
    if (!items || !items.length) continue;
    seen.add(folder);
    L.push(`## ${heading}`);
    L.push('');
    L.push('| Document | Purpose |');
    L.push('|---|---|');
    if (folder === '00-start') {
      L.push('| `CLAUDE.md` (repo root) | Working rules, brand canon, process. Auto-loaded by every session. |');
    }
    for (const f of items) {
      L.push(`| \`docs/${path.relative(DOCS, f).split(path.sep).join('/')}\` | ${describe(f)} |`);
    }
    L.push('');
  }

  const unfiled = [...byFolder.keys()].filter(k => !seen.has(k));
  if (unfiled.length) {
    L.push('## ⚠ UNFILED — these folders are not in the section list');
    L.push('');
    L.push('Either move them into an existing section, or add the folder to');
    L.push('`SECTIONS` in `reindex.js`.');
    L.push('');
    L.push('| Document | Purpose |');
    L.push('|---|---|');
    for (const folder of unfiled) {
      for (const f of byFolder.get(folder)) {
        L.push(`| \`docs/${path.relative(DOCS, f).split(path.sep).join('/')}\` | ${describe(f)} |`);
      }
    }
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push('## WHERE NEW NOTES GO');
  L.push('');
  L.push('Do not create a new top-level document. Add to the one that already');
  L.push('governs the area:');
  L.push('');
  L.push('| If it is… | It goes in |');
  L.push('|---|---|');
  L.push('| a change that was made | `docs/history/CHANGE_LOG_BRIEF.md` |');
  L.push('| something still outstanding | `docs/00-start/OPEN_ITEMS.md` |');
  L.push('| a rule or architectural decision | `docs/00-start/BVO_AUDIT_BRIEF.md` |');
  L.push('| how a specific feature works | the matching file in `docs/architecture/` |');
  L.push('| a settled definition | the matching file in `docs/definitions/` |');
  L.push('');
  L.push('A genuinely new area gets a file in the right subfolder, with a `> `');
  L.push('description line, then `node docs/00-start/reindex.js`. You cannot');
  L.push('forget to index it — the index is generated from what is on disk.');
  L.push('');
  L.push('## NOT HERE ON PURPOSE');
  L.push('');
  L.push('Different projects, in the parent folder. Do not pull them in:');
  L.push('');
  L.push('    RFLPOS_BRIEF.md   RFLPOS_SECURITY_SWEEP.md   rflpos_roadmap.md');
  L.push('    WEBFLOW_BUILD_SPEC.md   PNC_Authorize_Net_*.md');
  L.push('');
  return L.join('\n') + '\n';
}

const generated = build();
const check     = process.argv.includes('--check');
const current   = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, 'utf8') : '';

if (check) {
  if (current !== generated) {
    console.error('INDEX.md is stale — a document was added, moved or renamed.');
    console.error('Run: node docs/00-start/reindex.js');
    process.exit(1);
  }
  const undescribed = (generated.match(/^\| `docs\/.*⚠ NO DESCRIPTION/gm) || []).length;
  if (undescribed) {
    console.error(`${undescribed} document(s) have no "> " description line.`);
    console.error('Add one under the H1 of each, then reindex.');
    process.exit(1);
  }
  console.log('INDEX.md is current; every document has a description.');
} else {
  fs.writeFileSync(INDEX, generated);
  const n = (generated.match(/^\| `docs\//gm) || []).length;
  const u = (generated.match(/^\| `docs\/.*⚠ NO DESCRIPTION/gm) || []).length;
  console.log(`INDEX.md written — ${n} documents indexed.`);
  if (u) console.log(`${u} still need a "> " description line.`);
}
