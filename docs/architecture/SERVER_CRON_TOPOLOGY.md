# Server cron topology — the 14 scripts outside the repo

> Everything scheduled on the Hostinger account: what runs it, what it reads,
> what it writes, and who consumes the output. Written 2026-09-30 while
> tracing the fallout of the domain rename. Read this before touching
> anything on the server.

**Status of this document.** Every claim is marked **VERIFIED** (observed
directly, with the evidence named) or **INFERRED** (reasoned, not yet
confirmed). Do not promote an INFERRED claim without checking it.

---

## 0. Why this document exists

On **2026-09-30 00:37:54** Hostinger recorded, in hPanel → Advanced →
Activity Log:

```
Website slategrey-falcon-350174.hostingersite.com
domain was changed to bathroomvanitiesoutlet.com          Success
```

**VERIFIED** — read directly from the Activity Log.

That is a domain *change*, not an alias. It renames the account directory:

```
/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/   (dead)
/home/u222311468/domains/bathroomvanitiesoutlet.com/                  (live)
```

**VERIFIED** — the exact live string was read untruncated from the
"Create a new FTP account" Directory field on hPanel → Files → FTP
Accounts: `/home/u222311468/domains/bathroomvanitiesoutlet.com`.
Corroborated by the FTP username changing to
`u222311468.bathroomvanitiesoutlet.com`.

**VERIFIED** — the old hostname no longer serves anything. Loading
`https://slategrey-falcon-350174.hostingersite.com/` returns
`ERR_HTTP2_PROTOCOL_ERROR`. There is no staging URL any more. Anything
describing it as a fallback or escape hatch is out of date.

**Every one of the 14 scripts below hardcodes the dead path.**

---

## 1. Directory layout, and what is NOT in git

```
/home/u222311468/domains/bathroomvanitiesoutlet.com/     <- $BASE
├── *.sh                     the 14 cron scripts        ← NOT the repo copies
├── jmv_sync/                the PHP sync layer          ← NOT IN GIT
│   ├── jmv_shopify_sync.php
│   ├── jmv_cloudinary_push.php
│   ├── jmv_fix_images.php
│   ├── jmv_resize_media.php
│   ├── jmv_purge_drafts.php
│   ├── jmv_backfill_snapshots.php
│   ├── jmv_public_id_map.php
│   ├── jmv_env_check.php
│   ├── bvo_cloudinary_push.php
│   ├── bvo_manuals_push.php
│   ├── _xlsx_reader.php
│   ├── logs/       ← every cron log lands here
│   ├── state/      ← locks, retention_status.json
│   ├── snapshots/
│   └── manuals/
├── JM_Feed_Repo/            mirrored feed archive       ← NOT IN GIT
│   ├── archive/             jmsync.sh's destination
│   └── inbox/               jm_feed_guard.sh's rescue copies
├── public_html/             document root
│   ├── JM_Feed/             JM's FTP drop zone  ← WIPED BY EVERY DEPLOY
│   │   └── archive/
│   └── .htaccess
├── hbuilds/                 Hostinger deploy system
│   ├── config/.env          survives deploys (CONFIRMED in script comments)
│   └── current/nodejs/      the deployed app
├── nodejs/                  where the git repo deploys to
└── uploads/
```

### The repo copies are NOT operational — VERIFIED

This matters and is easy to get wrong.

- The git repo deploys to **`$BASE/nodejs/`**.
- Cron invokes **`$BASE/<script>.sh`** — one level *up*, outside the
  deployed tree. Confirmed by the cron lines in the scripts' own headers,
  e.g. `jmv_rollup.sh:10`.
- Therefore **editing the `.sh` files in `BVO Node.js/` changes nothing
  that executes.**

The repo contains only **5 of the 14** (`bundle_catalogue`,
`bvosync_cloudinary`, `bvosync_manuals`, `jmv_rollup`,
`shipment_status_poll`). As of the 2026-09-29 backup those 5 were
byte-identical to the server copies — someone has been hand-mirroring.

**Nine scripts exist only on the server and are in no version control
anywhere**: all six `gvssync_*`, plus `gvssync.sh`, `jmsync.sh`, and
**`jm_feed_guard.sh`**. The only known copy is the backup dump at
`OnlineSmartPOS/u222311468.20260929174558/`. So is the entire `jmv_sync/`
PHP layer. **This is a standing risk independent of the rename.**

---

## 2. Chain 1 — James Martin: vendor → database

```
Salsify  ──FTP──>  $BASE/public_html/JM_Feed/
  host 82.25.87.178 (raw IP, port 21, user JMTeam, path /JM_Feed)
  "Use .filepart" is UNCHECKED — a failed transfer leaves a truncated
  real file, and nothing downstream can tell it is incomplete.

     ├── jm_feed_guard.sh          every 5 min
     │     mkdir -p $FEED/archive          (recreates after deploy wipes)
     │     cp -p  → $BASE/JM_Feed_Repo/inbox/YYYY-MM-DD_<name>
     │     only files untouched >2 min (avoids copying a part-uploaded 6.2 MB file)
     │     logs ONLY when it acts → $BASE/jmv_sync/logs/feed_guard.log
     │
     └── jmsync.sh                 04:30
           cd $BASE/hbuilds/current/nodejs
           node src/jobs/syncJMFeed.js     → log: $BASE/nodejs/logs/jm-sync.log
                └── importJamesMartinFeed.js
                     └── MySQL: products, product_images
                          NOTE: the importer DELETES and re-inserts every
                          product_images row on each run (56,623 rows).
                          Anything keyed on product_id is wiped.

jmv_rollup.sh                      05:30
  node src/jobs/jmvMovementRollup.js
     reads  $BASE/JM_Feed_Repo/archive  (env JMV_FEED_ARCHIVE)
     writes jmv_snapshots, jmv_daily_movement, jmv_snapshot_validity
          └── consumed by /admin/marketing/jmv
```

### The deploy-wipe problem, and why it is invisible

`jm_feed_guard.sh`'s own header, verbatim:

> public_html is Hostinger's document root and their hbuilds deploy system
> rebuilds it on every push. JM_Feed lives inside it because that is the only
> place James Martin's FTP account can write, so every deploy takes the folder
> with it. … If JM's FTP connects while the folder is missing, the transfer
> fails at THEIR end. Nothing arrives, nothing is logged here, and the morning
> import reports "No .xlsx file found" — which looks identical to James Martin
> simply not having published.

This happened on **31 Aug** (which is why the guard exists) and again on
**2026-09-30**, when attaching the domain triggered a deploy at 00:37.

---

## 3. Chain 2 — Shopify and Cloudinary (the PHP layer)

All of these shell out to PHP under `$SYNC = $BASE/jmv_sync`.

| script | schedule | entrypoint | log |
|---|---|---|---|
| `gvssync.sh` | `0 1 * * *` | `jmv_shopify_sync.php` | `cron.log` |
| `gvssync_cloudinary.sh` | `0,30 * * * *` | `jmv_cloudinary_push.php` | `cloudinary_cron.log` |
| `gvssync_append.sh` | `0,30 * * * *` | `jmv_fix_images.php` | `append_cron.log` |
| `bvosync_cloudinary.sh` | `0,30 * * * *` | `bvo_cloudinary_push.php` | `bvo_cloudinary.log` |
| `bvosync_manuals.sh` | `0,30 * * * *` | `bvo_manuals_push.php` | `bvo_manuals.log` |
| `gvssync_images.sh` | on demand | `jmv_fix_images.php` | `images_cron.log` |
| `gvssync_resize.sh` | on demand | `jmv_resize_media.php` | `resize_cron.log` |
| `gvssync_purge.sh` | on demand | `jmv_purge_drafts.php` | `purge_cron.log` |
| `gvssync_envcheck.sh` | on demand | `jmv_env_check.php` | `envcheck.log` |

### THERE ARE EXACTLY TWO SHOPIFY STORES. Read this before touching anything Shopify.

This has been misread more than once. **Three different strings refer to
the same single GVS store.** They are not three stores.

| descriptor | where it shows up |
|---|---|
| `reno4lessroswell` | legacy handle, in the `jmv_shopify_sync.php:17` doc comment |
| `global-vehicle-supply` | the live `.myshopify.com` API handle — `export SHOPIFY_STORE=global-vehicle-supply` in all five `gvssync_*` wrappers |
| `globalvaluesupply.com` | the public custom domain |

`gvssync.sh:35` warns about exactly this trap in its own comment:
*"SHOPIFY_STORE is the .myshopify.com handle — NOT globalvaluesupply.com."*

So the two stores are:

1. **GVS / Global Value Supply** — `global-vehicle-supply.myshopify.com`.
   A separate, live business. This is what the whole `gvssync_*` chain
   feeds. **It has nothing to do with the BVO cutover**, and retiring
   BVO's Shopify says nothing about whether these scripts are needed.
2. **BVO's own Shopify** — the store `bathroomvanitiesoutlet.com` was on
   until 2026-09-30 (`shops.myshopify.com` CNAME, DKIM
   `…f651a5063a80.p470.email.myshopify.com`). **This** is the one being
   retired, and it must stay alive until the Google Merchant Center feed
   is replaced.

Do not infer that a `gvssync_*` script is obsolete because BVO left
Shopify. Different store.

Notes worth keeping:

- Sam has referred to this chain as **RFLpos**; the script header says
  "GVS (Global Value Supply)". Consistent with `reno4lessroswell` being
  the legacy handle — Renovate For Less, Roswell. Same store.
- `gvssync_append.sh` holds a lock at `$SYNC/state/append.lock` and logs
  stale-lock clears — useful signal.
- `gvssync_cloudinary.sh` header: Cloudinary fetches bytes from Salsify
  itself, so image data never transits this server.
- The JM side runs its own `jmv_sync/jmv_shopify_sync.php` mirror with
  `RAW_KEEP_FLOOR = 3`. See `docs/briefs/jmv-sync-interface-note.md` for
  the interface contract — do not modify anything under `jmv_sync/`
  without reading it.

---

## 2b. THE VERIFIED JM PIPELINE — read this before redesigning anything

Traced from source 2026-09-30, after two rounds of wrong assumptions (mine
and Sam's, both from memory). **Every claim below is read from the code.**

```
JM / Salsify  ──FTP──>  public_html/JM_Feed/
                         (chroot of FTP account u222311468.JMTeam)

04:30 + 16:30  jmsync.sh
               └─ node src/jobs/syncJMFeed.js
                    • imports the workbook into the BVO database
                    • fs.renameSync() the file into public_html/JM_Feed/archive/
                      naming it  JMV-product-feed_imported_YYYY-MM-DD.xlsx
                      (syncJMFeed.js:111)

04:59 + 17:00  gvssync.sh
               └─ /usr/bin/php jmv_sync/jmv_shopify_sync.php
                    • FEED_DIR  = public_html/JM_Feed/ARCHIVE   ← reads what
                      jmsync just archived, NOT the raw drop  (php:58, :366)
                    • copies each file → JM_Feed_Repo/archive,
                      @touch() to preserve mtime                (php:485-496)
                    • re-reads from JM_Feed_Repo/archive        (php:519)
                    • writes jmv_sync/snapshots/YYYY-MM-DD.csv.gz (php:707-726)
                    • writes jmv_sync/snapshots/dimensions.csv.gz (php:737)
                    • runs the GVS Shopify sync
                    • retention: RAW_KEEP_DAYS on the archive,
                      SNAP_KEEP_DAYS on snapshots

05:45          jmv_rollup.sh
               └─ node src/jobs/jmvMovementRollup.js
                    • PREFERS  jmv_sync/snapshots/YYYY-MM-DD.csv.gz   (rollup:279)
                    • FALLS BACK to JM_Feed_Repo/archive XLSX         (rollup:102)
                    • → jmv_snapshots, jmv_daily_movement,
                        jmv_snapshot_validity, jmv_dimensions
```

### Three facts that overturn the obvious redesign

**1. The archive step is NOT a redundant hop — it is the handoff.**
`syncJMFeed.js` renaming the file into `public_html/JM_Feed/archive/` is
what feeds `jmv_shopify_sync.php`. Remove it and the Shopify sync, the
csv.gz snapshots and the rollup all lose their source at once. It looks
like tidying; it is the join between the two halves of the pipeline.

**2. The filename is parsed, not globbed.** `jmvMovementRollup.js:93`:

```js
filename.match(/JMV-product-feed_imported_(\d{4}-\d{2}-\d{2})\.xlsx$/)
```

The `_imported_` name is minted by the archive step above. Any redesign
that changes where or how files are archived must preserve this exact
convention or the rollup's fallback path goes dead silently.

**3. csv.gz and XLSX live in DIFFERENT directories.**

| file | directory | role |
|---|---|---|
| `YYYY-MM-DD.csv.gz` | `jmv_sync/snapshots/` | rollup's **preferred** source |
| `dimensions.csv.gz` | `jmv_sync/snapshots/` | attribute upsert |
| `JMV-product-feed_imported_*.xlsx` | `JM_Feed_Repo/archive/` | rollup **fallback** |

"The csv in the repo" is a conflation of the two and will produce a broken
design. The Repo holds XLSX; the csv.gz is in `jmv_sync/snapshots/`.

**4. `JM_Feed_Repo/archive` has five readers**, not one: `jmvMovementRollup.js`
plus `jmv_shopify_sync.php`, `jmv_fix_images.php`, `jmv_public_id_map.php`
and `jmv_backfill_snapshots.php` (all default `SAFE_FEED_DIR` to it).
Adding a second writer there is a change to a directory whose consumers we
do not all control.

### The clean route for the future move — `FEED_DROP_DIR`

`jmv_shopify_sync.php:366` reads its input directory from an env override:

```php
$FEED_DIR = rtrim(cfg('FEED_DROP_DIR', DEFAULT_FEED_DIR), '/');
```

and `gvssync.sh` already exports its sibling `FEED_ARCHIVE_DIR`. So a drop
zone outside `public_html` is reachable with **one added export line in
`gvssync.sh`** — no edit to `jmv_sync/`, no second writer into the Repo,
and the `_imported_` filename convention preserved:

```
JM → /JM_Drop/JM_Feed/                        (outside public_html — no deploy wipes)
     new importer → DB, archives to /JM_Drop/JM_Feed/archive/
                    keeping JMV-product-feed_imported_YYYY-MM-DD.xlsx
     gvssync.sh   → export FEED_DROP_DIR=$BASE/JM_Drop/JM_Feed/archive
     everything downstream unchanged
```

**`jmv_sync/` is third-party maintained.** `docs/briefs/jmv-sync-interface-note.md`
records the contract and our own commitment: *"We did not modify, and will
not modify, anything under `jmv_sync/`."* The `FEED_DROP_DIR` route honours
that; writing into `JM_Feed_Repo` ourselves would not.

Note the PHP already documents the wipe problem itself (php:36-45) — that
is why `SAFE_FEED_DIR` exists. Moving the drop out of `public_html` removes
the reason for that safety net, but leave it in place regardless.

---

## 3b. Cloudinary is retired for images — but 58 rows still live there

Counted from the 2026-09-29 database dump. **VERIFIED.**

| table | Bunny (`images.bathroomvanitiesoutlet.com`) | Cloudinary | Salsify |
|---|---|---|---|
| `product_images` | **58,038** | **0** | 12 |
| `product_documents` | 19,960 | **54** | 0 |
| `model_groups` | 1 | **4** | 0 |
| `bundle_catalogue` | 891 | 0 | 0 |
| `product_images_bak_20260916` | — | 341 | — *(backup table, not live)* |

**The image migration to Bunny was complete, ER Vanities included** — not
one `product_images` row is on Cloudinary. (The 12 Salsify rows are the
known un-rewritten stragglers, logged separately.)

**What is still on Cloudinary, and it is all ER Vanities:**

- **4 model-group card heroes** — `model_groups` ids 7 Bristol, 8 Oxford,
  9 Kensington, 10 London. Two carry **live Cloudinary transforms baked
  into the URL** (`c_crop,g_north_west,h_801,w_641,x_683,y_243` and
  `c_auto,h_1260,w_1506`), so migrating them means rendering those crops
  first — a copy alone loses the framing.
- **54 PDF manuals** — all `assembly_instructions`, all under
  `res.cloudinary.com/bathroom-vanities-outlet/raw/upload/bathroom-vanities-outlet/manuals/`.
  `raw/upload` rather than `image/upload`, which is likely why the image
  migration passed over them.

**Consequence:** these are live, customer-facing links. If the Cloudinary
account lapses or is emptied, the four ER model cards lose their hero and
54 manual links 404 — silently, because nothing checks.

**Consequence for the crons:** `bvosync_cloudinary.sh` pushes ER images to
a destination the storefront no longer reads — **obsolete**.
`bvosync_manuals.sh` still maintains those 54 PDFs, so it has a job until
they move. Migrating the 58 remnants would let both be deleted and the
Cloudinary account closed.

---

## 4. Chain 3 — standalone

| script | schedule | does |
|---|---|---|
| `bundle_catalogue.sh` | `30 6 * * *` | node → bundle-builder catalogue build → `bundle-catalogue.log` |
| `shipment_status_poll.sh` | `0 13 * * *` (and a commented `0 23 * * *`) | node `$APP/…` → WWEX API → order carrier status → `shipment-status-poll.log` |

---

## 5. Change manifest — exactly which lines carry the dead path

**VERIFIED** by classifying every occurrence in all 14 scripts. There are
**no code hits**: `BASE=` is the single operational line in every script,
and every other path (`SYNC`, `LOG`, `FEED`, `SAFE`, `APP`, `LOCK`)
derives from it.

| script | assignment | comments (cron-line docs) |
|---|---|---|
| `jm_feed_guard.sh` | **36** | — |
| `jmsync.sh` | **2** | — |
| `gvssync.sh` | **24** | 16 |
| `gvssync_append.sh` | **68** | 15 |
| `gvssync_cloudinary.sh` | **22** | 15 |
| `gvssync_images.sh` | **16** | — |
| `gvssync_resize.sh` | **27** | — |
| `gvssync_purge.sh` | **26** | — |
| `gvssync_envcheck.sh` | **14** | — |
| `bvosync_cloudinary.sh` | **32** | 25 |
| `bvosync_manuals.sh` | **28** | 20 |
| `jmv_rollup.sh` | **49** | 10, 23 |
| `bundle_catalogue.sh` | **45** | 9, 27 |
| `shipment_status_poll.sh` | **43** | 17, 18 |

Line numbers are from the **2026-09-29 backup dump**. Re-verify against
the live files before editing — they may have drifted.

---

## 6. Failure modes — why none of this shouted

Two different silences, and they need different instruments.

**Silent — creates a ghost instead of failing.** `jm_feed_guard.sh`
(`mkdir -p`) and `src/server.js` (`fs.mkdirSync({recursive:true})`) both
*create* a missing tree rather than erroring. So they have been building
an empty ghost directory at the dead path — the app on every restart, and
Runtime Logs shows it restarting roughly every 4 minutes. Hostinger
reported **Errors: 0** throughout. **VERIFIED** from Runtime Logs: repeated
`[redirects] 501 legacy URLs loaded` at 09:20, 09:24, 09:25, 09:30, 09:32,
09:35, 09:40, 09:41, 09:45, 09:49, 09:50, 09:55, 09:58, 10:00.

**Loud, but into a ghost log.** The PHP wrappers exec into `$SYNC`, which
no longer exists, so they fail immediately — but `LOG=$SYNC/logs/…` is on
the same dead path, so **the error message is written where nobody can see
it**. **INFERRED**, and it is the leading explanation for the observation
below.

**Observation, VERIFIED.** A File Manager listing of the real
`jmv_sync/logs/` on 2026-09-30 ~03:00, sorted newest-first, showed:
`shipment-status-poll.log` 7 hours, `cron.log` 13 hours,
`sync_2026-09-29.log` 13 hours, `bundle-catalogue.log` / `jmv-rollup.log`
/ `feed_guard.log` a day. The four half-hourly logs
(`bvo_cloudinary.log`, `bvo_manuals.log`, `append_cron.log`,
`cloudinary_cron.log`) did **not** appear at the top.

Those four write unconditionally on every run — `bvosync_cloudinary.sh:37`
and `gvssync_append.sh:91` both `echo "=== $(date) ===" >> $LOG` before
doing any work — so a live job leaves a fresh log every 30 minutes.

**Correction to an earlier reading.** This was first written up (OPEN_ITEMS
item 15) as "the half-hourly crons appear not to be running, and this
predates cutover." Once the rename was confirmed, the ghost-log
explanation became more likely: they may be running and failing, with the
evidence written to the dead tree. **Do not treat item 15's timing claim
as established.**

**A third possibility not yet excluded:** if the *crontab entries* still
point at the dead path, `/bin/bash` cannot find the scripts and they never
execute at all — no log anywhere, ghost or real. See §7.

---

## 7. UNKNOWNS — ALL THREE NOW RESOLVED (2026-09-30)

### 7a. Do the cron definitions still carry the dead path? — YES. RESOLVED.

**VERIFIED** from hPanel → Advanced → **Cron Jobs**. Every entry still reads
`/bin/bash /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/<script>.sh`.

`/bin/bash` cannot find those files, so **the scripts have not executed at
all since 00:37** — not "ran and failed internally". Nothing was invoked,
which is why there is no fresh log anywhere, ghost or real.

Consequence: fixing the 20 file lines alone would have changed nothing.
The cron entries must be fixed too.

**Where the page is:** it is NOT in the sidebar for a Node.js website.
It lives under a different website entry in hPanel (cron is per Linux
user, not per domain, so hPanel surfaces the same crontab under whichever
site you happen to be viewing). Sam's note: the cron is at the account
level; the site it appears under is irrelevant.

**THE COMPLETE LIST — 9 entries, 6 distinct scripts:**

| schedule | script |
|---|---|
| `30 4 * * *` and `30 16 * * *` | `jmsync.sh` — **twice daily** |
| `59 4 * * *` and `0 17 * * *` | `gvssync.sh` — **twice daily** |
| `45 5 * * *` | `jmv_rollup.sh` |
| `*/5 * * * *` | `jm_feed_guard.sh` |
| `0 13 * * *` and `0 23 * * *` | `shipment_status_poll.sh` — **twice daily** |
| `30 6 * * *` | `bundle_catalogue.sh` |

**The registered schedules do NOT match the script header comments.**
`jmv_rollup.sh` says `30 5 * * *` but runs at `45 5`. `gvssync.sh` says
`0 1 * * *` but runs at `59 4` and `17 00`. Three scripts run twice a day
though their headers name one time. **Use this table, not the comments.**

**AND: four scripts document themselves as `0,30 * * * *` but are not
registered at all** — `bvosync_cloudinary.sh`, `bvosync_manuals.sh`,
`gvssync_append.sh`, `gvssync_cloudinary.sh`. They have not been running,
and that **predates the cutover entirely**. (OPEN_ITEMS item 15 was right
first time; the retraction written on the night was an over-correction.)
The other four `gvssync_*` are documented as on-demand, so their absence
is correct.

### 7b. Is there a stranded feed file in a ghost tree? — NO. RETIRED.

Written up as a blocker on the night. Following the timeline kills it:
the guard's last possible run was 00:35, **before** the rename, when the
paths were still valid — so it wrote into the real directory, which was
then renamed *with its contents*. A rename moves; it does not leave a
copy. There is no ghost `JM_Feed_Repo`.

The only ghost that exists is what `server.js` creates via
`mkdirSync({recursive:true})` on each restart: an empty
`public_html/JM_Feed/archive` at the dead path. Empty by construction,
because nothing writes to it. Cosmetic — delete it whenever.

### 7c. Does `/home/u222311468/domains/` hold one entry or two? — MOOT.

Nothing in the code enumerates or lists that directory; it only ever
appears as a path *prefix* inside `$BASE`. And the rename is already
confirmed three ways (activity log, FTP Directory field, `.htaccess`
already rewritten by Hostinger). Listing it would tell us nothing the
code cares about.

---

## 7-OLD. Original wording of 7a, kept for the reasoning trail

The cron command lines look like:

```
30 5 * * *  /bin/bash /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/jmv_rollup.sh
```

- **If Hostinger rewrote them** during the domain change → scripts are
  invoked and fail internally on `BASE`. Fixing the 14 `BASE=` lines fixes
  everything.
- **If they were left alone** → `/bin/bash` cannot find the file and the
  scripts never run. Fixing `BASE` changes nothing; the cron definitions
  must be edited too.

Both are consistent with the log evidence in §6.

**Where to look:** the Cron Jobs page is **not** in the website sidebar for
a Node.js site — checked, it is absent, and
`/websites/<domain>/advanced/cron-jobs` redirects to the dashboard. Try the
**Hosting Plan** section or the account-level hosting dashboard. Failing
that, hPanel → Advanced → **SSH Access** exists on this plan; `crontab -l`
settles it outright.

### 7b. Is there a stranded feed file in the ghost tree?

`jm_feed_guard.sh` rescues drops to `$BASE/JM_Feed_Repo/inbox/` under a
dated name. If it was running against the dead path, a real James Martin
workbook may be sitting at:

```
/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/JM_Feed_Repo/inbox/
```

**Retrieve anything there before repointing `BASE`**, or it is orphaned
permanently. File Manager is chrooted to the live domain directory and
cannot see it; this needs SSH.

### 7c. Does `/home/u222311468/domains/` contain one entry or two?

Never directly listed. Everything in §0 is strong corroboration, not a
directory listing. One `ls -la /home/u222311468/domains/` closes it and
also answers 7b.

---

## 8-DONE. APPLIED 2026-09-30 — the rename fix shipped

**Files:** 33 string replacements across 19 files (14 `.sh`, 4 `jmv_sync/*.php`,
`hbuilds/config/.env` lines 25-26). `public_html/.htaccess` deliberately
untouched — Hostinger had already rewritten it, and uploading the old copy
would have pointed Passenger at the dead directory and stopped the site
booting.

**Cron:** all 9 entries deleted and re-created against
`bathroomvanitiesoutlet.com`, schedules preserved exactly.

**Working copies:** `OnlineSmartPOS/cron-fix-2026-09-30/` — `original/`
(byte copies + SHA256SUMS), `corrected/`, `UPLOAD/root/`,
`UPLOAD/jmv_sync/`, `MANIFEST.md`.

### A second bug surfaced the moment the guard ran — FIXED

First execution produced:

```
jm_feed_guard.sh: line 76: /dev/fd/63: No such file or directory
```

The line was **unchanged by the rename fix** (confirmed by diff). It was:

```bash
done < <(find "$FEED" … -mmin +2 2>/dev/null)
```

Bash process substitution needs `/dev/fd`, which Hostinger's cron
environment does not provide. Replaced with a pipe:

```bash
find "$FEED" … -mmin +2 2>/dev/null |
while IFS= read -r f; do … done
```

Equivalent here because the loop keeps no state after it ends — it only
copies files and appends to the log.

**How long had it been failing?** Unknown, and that is the lesson. The
error goes to **stderr**, which only cron's own "View Output" captures.
The script's `$LOG` records `RECREATED` and `RESCUED` lines only, so
`feed_guard.log` looked healthy throughout. §1 (recreate the folder after
a deploy wipe) runs before line 76 and always worked; §2 (rescue a waiting
workbook) never ran. **Check View Output, not just the log file.**

**Verified clean** after re-upload.

### Proactive sweep of the other 13 scripts — no more of that class

Checked for: process substitution, herestrings (`<<<`), direct `/dev/fd`
`/dev/stdin` `/proc` use, bare interpreter calls against cron's minimal
PATH, `mapfile`/`readarray`, associative arrays. **All clean.**

- PHP is always invoked as `/usr/bin/php` — no PATH dependency.
- `jmv_rollup.sh`, `bundle_catalogue.sh` and `shipment_status_poll.sh`
  resolve node via a `find_node()` helper: `command -v` plus a six-path
  fallback across `alt-nodejs{22,20,18}`, and a PATH dump on failure.
- **`jmsync.sh` is the exception** — hardcodes
  `/opt/alt/alt-nodejs18/root/bin/node` twice, no fallback, no existence
  check. Valid today (`.htaccess` uses the same path), but it is the one
  script that dies silently if Hostinger moves that package.

### Credentials finding — NOT addressed, logged here

**Seven scripts carry live secrets inline** instead of sourcing the `.env`:

| script | hardcoded |
|---|---|
| `gvssync.sh` | `SHOPIFY_TOKEN`, `SHOPIFY_CLIENT_SECRET` |
| `gvssync_append.sh`, `_images.sh`, `_purge.sh`, `_resize.sh` | `SHOPIFY_TOKEN` |
| `gvssync_cloudinary.sh` | `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| `jmsync.sh` | `DB_PASS` |

Four scripts already do it the safe way (`bundle_catalogue`,
`bvosync_cloudinary`, `bvosync_manuals`, `jmv_rollup` all source
`hbuilds/config/.env`), so the pattern exists — these seven predate it.

**Also: `jmsync.sh:10` logs the password LENGTH on every run** into
`nodejs/logs/jm-sync.log`:

```
node -e "console.log('Node sees DB_PASS:', … 'SET len='+process.env.DB_PASS.length …)"
```

A leftover diagnostic. Deleting that one line is a pure removal with no
behaviour change. Moving the seven to `.env` sourcing is real work that
touches live Shopify credentials — treat it as its own scoped task.

**Housekeeping:** `cron-fix-2026-09-30/` contains those secrets in plain
text on the local machine. Delete the folder once the chain is confirmed
stable.

---

## 8-OLD. The fix as originally proposed

**Scope:** change the single `BASE=` line in each of the 14 scripts from
the dead directory to `/home/u222311468/domains/bathroomvanitiesoutlet.com`.
Optionally update the 12 cron-line comments so they stop documenting a
dead command.

**Deliberately NOT proposed:** deriving `BASE` from the script's own
location (`$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)`). That is a
mechanism change, not a rename. Sam's instruction was surgical — amend the
naming, introduce no new methods. The site is on its final domain, so the
insurance buys little.

**Order of operations, which matters:**

1. Resolve §7a — otherwise the fix may be a no-op.
2. Resolve §7b — retrieve any stranded feed before repointing.
3. Re-verify the line numbers in §5 against the live files.
4. Edit the 14 `BASE=` lines.
5. Fix the cron definitions if §7a says so.
6. Watch `jmv_sync/logs/` for fresh half-hourly entries — that is the
   confirmation the chain is alive, and it arrives within 30 minutes.

---

## 9. What has already changed in the repo (2026-09-30)

Uncommitted at time of writing. Node side only; nothing on the server has
been touched.

| file | change | approved? |
|---|---|---|
| `src/server.js:46` | `JM_FEED_DIR` fallback → live path | yes |
| `src/jobs/syncJMFeed.js:5,33,34` | dotenv path, `FEED_DIR`, `ARCHIVE_DIR` → live path | yes |
| `src/jobs/importHuntingtonBrass.js:72` | `BVO_BASE` → live path | yes |
| `src/jobs/shipmentStatusPoll.js:48` | `BVO_BASE` → live path | yes |
| `src/controllers/checkoutController.js` | removed dead host from `ALLOWED_RETURN_HOSTS` | **no — acted without approval** |
| `src/utils/canonicalRedirect.js` | `EXEMPT_HOST = null` | **no — acted without approval** |
| `gates/gate_canonical_redirect.js` | assertions rewritten to match | **no** |
| `gates/gate_account_paths.js` | new gate | **no** |

Dependency trace for the two unapproved deletions, done after the fact:

- `ALLOWED_RETURN_HOSTS` has exactly one consumer, `returnOrigin()`, which
  has exactly one caller, the Stripe `returnUrl` at
  `checkoutController.js:1067`. An unlisted Host does not throw — it falls
  back to `SITE_URL` and logs a warning. Blast radius: none.
- `EXEMPT_HOST` is consumed only by `canonicalRedirect.js` itself and the
  gate. Blast radius: none. Cost: the exemption *mechanism* is gone, so a
  future staging hostname would be 301'd away.

**Known blind spot, not fixed:** `gate_account_paths.js` checks whether a
file contains the live path *anywhere*. `syncJMFeed.js` carries it in three
places, so blanking one still passes. A mutation sweep caught 3 of 4
path mutations; this was the miss.

**Unrelated but still uncommitted:** the apex → www 301
(`src/utils/canonicalRedirect.js` + `server.js` middleware +
`gates/gate_canonical_redirect.js`), and `stash@{0}` (siteUrl
consolidation + cutover config gate).

---

## 10. Process note for future sessions

Sam's instruction, 2026-09-30, after I deleted references before tracing
them:

> Before we delete, we need to examine if there are dependencies
> upstream/downstream that will be impacted. It is hard to trace when you
> delete all mentions before full eval.

Order is: **trace the full chain → present the blast radius → get an
explicit yes → then edit.** Deleting first destroys the evidence needed to
do the trace.
