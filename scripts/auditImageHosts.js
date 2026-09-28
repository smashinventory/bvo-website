#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   auditImageHosts.js — every image URL in the database that we do not host.

   Run:  node scripts/auditImageHosts.js
   Exit: 0 = clean, 1 = foreign hosts found, 2 = could not connect

   ─────────────────────────────────────────────────────────────────────────
   WHY THIS IS A SCRIPT AND NOT A GATE, AND NOT ANOTHER ADMIN WARNING

   Two controls already exist and BOTH MISS THE CASE THAT KEEPS HAPPENING:

   1. views/partials/admin/hotlink-warn.ejs, included globally in
      layouts/admin.ejs. It warns when someone TYPES a foreign image URL
      into an admin form. Works, and covers all five admin surfaces.

   2. src/utils/cdnUrl.js rewrites vendor hosts to the Bunny pull zone on
      every product import, so the 56k-row catalogue stays clean. Verified
      clean on 2026-09-28: zero foreign hosts in product_images.

   On 2026-09-28 the live database still held ELEVEN foreign images — ten
   inspiration-guide cards (pages.og_image) plus the Brittany model tile.
   None of them were typed into a form, so (1) never fired. None came from
   a product import, so (2) never applied. They arrived with the
   inspiration-page content build, straight into the database.

   A GATE CANNOT CATCH THIS EITHER. Gates run in the push script with no
   database credentials, and the URLs are not in any committed .sql file —
   so there is nothing in the repo to scan. The truth only exists in the
   database, which is why this reads the database.

   Run it before cutover, and after any bulk content import. That is the
   gap the other two controls leave.

   ─────────────────────────────────────────────────────────────────────────
   OWNED HOSTS COME FROM cdnUrl.js — ONE LIST, NOT A SECOND COPY

   A hand-maintained list here would drift from the admin warning's, and
   then the two controls would disagree about what "ours" means. That is
   how res.cloudinary.com came to be missing from one list and present in
   another during the 2026-09-23 pass.
   ───────────────────────────────────────────────────────────────────────── */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { OWNED_IMAGE_HOSTS } = require('../src/utils/cdnUrl');

/* images.salsify.com is the James Martin feed's own host. It is NOT in
   OWNED_IMAGE_HOSTS because product imports are supposed to rewrite it to
   Bunny — a Salsify URL surviving in product_images is a cdnUrl.js
   failure and SHOULD be reported. But it is legitimate as a source, so it
   is listed separately here rather than silently folded into "ours". */
const REPORT_SALSIFY_AS = 'un-rewritten feed URL (cdnUrl.js should have caught this)';

/* Each: table, id expression, URL column, what it renders as. */
const TARGETS = [
  { table: 'pages',          id: 'slug',                                   col: 'og_image',      what: 'inspiration/CMS card + JSON-LD image' },
  { table: 'model_groups',   id: "CONCAT(model_name,' / ',brand)",         col: 'custom_image',  what: 'homepage model tile' },
  { table: 'categories',     id: 'slug',                                   col: 'image_url',     what: 'category card' },
  { table: 'blog_posts',     id: 'slug',                                   col: 'og_image',      what: 'blog card + JSON-LD image' },
  { table: 'product_images', id: 'CONCAT("product #", product_id)',        col: 'url',           what: 'product gallery' },
];

const hostOf = (u) => { try { return new URL(u).hostname.toLowerCase(); } catch { return ''; } };

const isOwned = (h) =>
  OWNED_IMAGE_HOSTS.some(o => h === o || h.endsWith('.' + o));

(async () => {
  let pool;
  try {
    pool = require('../src/config/database').bvoPool;
  } catch (err) {
    console.error('Could not open the database. Is .env present?\n ', err.message);
    process.exit(2);
  }

  const findings = [];
  let scanned = 0;

  for (const t of TARGETS) {
    let rows;
    try {
      /* Deliberately NOT filtered in SQL. Filtering with NOT LIKE means
         maintaining the owned-host list twice — once here and once in
         cdnUrl.js — and a host missing from the SQL copy silently hides
         rows. Pull every non-empty URL and classify in JS against the ONE
         list. Costs a full scan of ~57k rows; takes under a second. */
      [rows] = await pool.query(
        `SELECT ${t.id} AS id, ${t.col} AS url FROM ${t.table}
          WHERE ${t.col} IS NOT NULL AND ${t.col} <> ''`
      );
    } catch (err) {
      /* A missing table is worth saying out loud rather than skipping —
         it usually means a rename nobody propagated. */
      console.warn(`  ! skipped ${t.table}.${t.col}: ${err.message}`);
      continue;
    }

    for (const r of rows) {
      scanned += 1;
      const u = String(r.url);
      /* Root-relative paths (/images/uploads/x.png) are ours by
         definition — they are served by this app. */
      if (u.startsWith('/')) continue;
      const h = hostOf(u);
      if (!h || isOwned(h)) continue;
      findings.push({
        table: t.table, what: t.what, id: r.id, host: h, url: u,
        note: h.endsWith('salsify.com') ? REPORT_SALSIFY_AS : '',
      });
    }
  }

  console.log(`\nScanned ${scanned} image URLs across ${TARGETS.length} tables.\n`);

  if (!findings.length) {
    console.log('CLEAN — every image is on a host we control.\n');
    await pool.end().catch(() => {});
    process.exit(0);
  }

  /* Grouped by host: the useful unit of work is "go deal with bathgems",
     not "go deal with row 47". */
  const byHost = {};
  findings.forEach(f => (byHost[f.host] = byHost[f.host] || []).push(f));

  console.log(`${findings.length} FOREIGN IMAGE${findings.length === 1 ? '' : 'S'}, `
            + `${Object.keys(byHost).length} host${Object.keys(byHost).length === 1 ? '' : 's'}:\n`);

  for (const [host, list] of Object.entries(byHost).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${host}  (${list.length})${list[0].note ? '  — ' + list[0].note : ''}`);
    for (const f of list) {
      console.log(`     ${f.table}.${f.id}`);
      console.log(`       ${f.what}`);
      console.log(`       ${f.url}`);
    }
    console.log('');
  }

  console.log('Each one either breaks when that site changes it, or disappears\n'
            + 'entirely if they block hotlinking. Re-host to the Bunny pull zone,\n'
            + 'or repoint at an image already in our catalogue.\n');

  await pool.end().catch(() => {});
  process.exit(1);
})();
