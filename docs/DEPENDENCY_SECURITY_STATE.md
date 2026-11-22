# Dependency security — state, reasoning, and what to do next

**Last updated:** 2026-11-22
**Live commit at time of writing:** `0dbf443` (deployed 2026-11-22 15:42, build `01a204fe`)
**Trigger:** Hostinger hPanel vulnerability scan, 2026-11-18, reported 41 unpatched
dependencies on bathroomvanitiesoutlet.com.

This file exists so the next session does not have to re-derive any of it. Every
number here was measured, not estimated; where something is unverified it says so.

---

## 1. WHERE THE SCAN LIVES, AND HOW DEPLOY ACTUALLY WORKS

Both cost time in this session. Write them down once.

**The vulnerability scanner:**
```
hPanel → Websites → bathroomvanitiesoutlet.com → Security → Vulnerabilities
https://hpanel.hostinger.com/websites/bathroomvanitiesoutlet.com/hosting-security/vulnerabilities
```
Default page size is 10; set it to 50 or the list silently paginates to 5 pages.

**Deployment is AUTOMATIC on push to `main`. There is no manual deploy step.**
```
hPanel → Websites → bathroomvanitiesoutlet.com → Deployments
https://hpanel.hostinger.com/websites/bathroomvanitiesoutlet.com/node/deployments
```
Connected to `github.com/smashinventory/bvo-website`, branch `main`. Each push
clones, runs `npm install`, publishes, and restarts — about 15s end to end. The
build log per deployment is behind the details icon on each row and is the
authoritative record of what was installed.

⚠️ **DO NOT send the owner `cd ~/domains/.../nodejs && git pull`.** That path is
the SERVER's, not their Mac's. It was handed over three times in this session and
each time ran in the local repo instead, achieving nothing. There is no shell step
to perform. Push is the deploy.

⚠️ **Every previous deployment is retained with a Redeploy button.** Rollback is
one click, not a restore. This materially changes the risk calculus for anything
below — a bad Node bump or library upgrade is reversible in seconds.

---

## 2. WHAT WAS DONE (commit `0dbf443`)

41 → **1** on the server. Verified in the build log: `added 137 packages … 1 high
severity vulnerability`.

**Not** fixed with hPanel's "Auto-fix all" button, and future sessions should not
use it either. It patches `node_modules` ON THE SERVER. Because deploy re-runs
`npm install` from the lockfile, the patch is either wiped on the next push or the
server drifts permanently from the repo. The lockfile stays vulnerable either way.

### Root cause, which matters more than the individual bumps

`package-lock.json` was last committed **2026-09-25** while the installed tree had
moved on (express 4.22.2, axios 1.19.0). Something ran `npm install` without the
lockfile being updated and committed, so transitive versions drifted unseen for two
months. **The regenerated lockfile is the point of that commit as much as the
version bumps are.**

### Changes made

```
direct      axios 1.18 -> 1.21.1          compression 1.7.4 -> 1.8.2
            morgan 1.10 -> 1.12.1         multer 2.2 -> 2.5.0
            mysql2 3.6 -> 3.24.6          express-mysql-session 3.0 -> 3.0.3

overrides   proxy-addr ^2.0.8   body-parser ^1.20.9   qs ^6.16.1
            follow-redirects ^1.16.2      mysql2 ^3.24.6
            (brace-expansion and js-yaml raised to current)
```

---

## 3. FINDINGS THE SCANNER GOT WRONG — READ BEFORE TRUSTING IT AGAIN

**The scanner is an input, not a priority queue.** Three specific failures:

**(a) The worst issue was not the one marked Critical.** `express-mysql-session`
bundled its own `mysql2@3.10.2` carrying `GHSA-3f6p-5ww8-9rcr` — auth plugin
downgrade to `mysql_clear_password`, which hands the DB password to a hostile
server in clear text. It was rated *High*, below the *Critical* proxy-addr issue,
and it was nested under the **session store** where nobody would look. The direct
mysql2 was already 3.22.6 and fine. There is now one mysql2 in the tree.

**(b) Five of the 41 never shipped.** js-yaml, browserslist (×2) and
baseline-browser-mapping are under jest → babel; minimatch@10.2.5 is under nodemon.
All devDependencies. Verified with `npm ls --omit=dev`. The server installs
production only — **137 packages, versus 424 locally** — so they are not even
present in production. The scanner reads the whole tree and does not distinguish.

**(c) It missed `xlsx` entirely.** Two high advisories, no npm fix available. See §5.

**Why proxy-addr genuinely did matter here**, despite (a): `src/server.js:141` sets
`app.set('trust proxy', 1)`, so `req.ip` flows through proxy-addr, and the rate
limiter, bot filtering and the `site_events` spine all key off that value. Spoofing
it means rate-limit evasion and poisoned analytics. Not theoretical for this app.

---

## 4. STILL OPEN — RANKED BY REAL EXPOSURE, NOT BY CVSS

### 4.1 Node 18 is end-of-life — recommended FIRST

```
Deployment settings → Node version: 18.x     (server runs v18.20.8)
```
Node 18 reached EOL **2025-04-30**, roughly 19 months ago. It receives no security
patches at all. This is a larger exposure than most of the 41 CVEs just closed:
those were libraries with fixes available; this is a runtime where fixes have
stopped being published. **It will never appear on a dependency scan.**

It already shows symptoms. The `0dbf443` build log carries:
```
npm warn EBADENGINE package: 'brace-expansion@5.0.13',
npm warn EBADENGINE required: { node: '20 || >=22' }, current: { node: 'v18.20.8' }
```
⚠️ **This warning is PRE-EXISTING, not caused by the upgrade.** The entire
brace-expansion 5.x line requires Node 20+, and the override was already `^5.0.8`
(resolving to 5.0.9, same requirement) before this session. Checked every 5.x
release; they all declare `20 || >=22`. The class of problem grows with time.

Change the Node version in the deployment settings and redeploy. Test checkout and
admin login. Roll back by redeploying `0dbf443` if anything misbehaves.

### 4.2 express-rate-limit 7.5.1 → 8.7.5

`GHSA-cppf-2hm6-mrvm` — prototype pollution **disables rate limiting**. Rated
Moderate; behaves worse than that, because the protection deliberately tuned for
launch (task #285) would silently stop working rather than fail loudly.

⚠️ **`npm audit` does NOT report this. Only Hostinger does.** The advisory was
published 2026-11-18 and npm's database may not have ingested it. The discrepancy
is not evidence the advisory is wrong — do not dismiss it on that basis.

**Migration surface, measured — it is small:**
```
src/server.js:428   global limiter   windowMs 5min,  max 150, skip(...)
src/server.js:827   authLimiter      windowMs 15min, max 10,  skipSuccessfulRequests
src/server.js:836   adminAuthLimiter windowMs 15min, max 5,   skipSuccessfulRequests
src/server.js:915   notifyLimiter    windowMs 15min, max 20
src/routes/admin.js:22  adminLoginLimiter
```
Five call sites, all plain options. No custom store, no custom keyGenerator — the
smallest possible v8 migration. v8 declares `engines.node >= 16`, so it does **not**
depend on the Node bump. Do it after §4.1 anyway so the app is regression-tested
once rather than twice.

Known v8 changes to check when doing it: `max` is renamed to `limit` (old name
deprecated), and `standardHeaders` default behaviour changed. Verify against the v8
changelog at the time — do not trust this line alone, it was not tested this session.

Unrelated pre-existing note found while measuring: the limiters use the default
**memory store**, so with PM2 cluster workers the limits are per-worker, not global.
Not a CVE; worth knowing before tuning any limit.

### 4.3 xlsx@0.18.5 — recommend DOCUMENT AND ACCEPT, not migrate

Two high advisories (prototype pollution, ReDoS), **no fix available** — the npm
package is abandoned at 0.18.5 and SheetJS now publishes to its own CDN.

**The evidence says the risk is low here.** All six usages are `XLSX.readFile()`:
```
src/jobs/jmvMovementRollup.js      src/jobs/syncJMFeed.js
src/jobs/importHuntingtonBrass.js  src/jobs/importJamesMartinFeed.js
src/controllers/adminController.js scripts/gen_mirror_colour_sql.js
```
These parse **supplier feed files** (James Martin, Huntington Brass) in cron jobs
and admin tooling. Nothing in the customer request path; no public upload path.
Both advisories require a malicious input file.

⚠️ **The one thing NOT verified this session:** whether `adminController`'s use is
an admin *upload* of an arbitrary spreadsheet. If it is, an authenticated admin
could be socially engineered into parsing a hostile file. Check that before
finalising the accept decision. Everything else is a vendor feed.

Revisit if a public or semi-public upload path ever parses spreadsheets.

### 4.4 `src/jobs/searchSync.js` cannot be loaded by Node — not security

```
$ node --check src/jobs/searchSync.js
src/jobs/searchSync.js:26
 *   */15 * * * * node /path/to/src/jobs/searchSync.js --delta
            ^
SyntaxError: Unexpected token '*'
```
Line 26 documents a cron schedule `*/15 * * * *` **inside a `/* */` block comment**.
The `*/` closes the comment early and Node parses the rest as code. Last committed
**2026-08-19** (`1654dcb`) — so if anything invokes this job, it has been failing
since August. Nothing else in `src/` references it except a comment in
`importJamesMartinFeed.js:225`. One-character fix; not done here to keep the
dependency commit clean.

---

## 5. THE RECOMMENDATION, AND WHY

Everything in §4 is cleanup. **The backlog reached 41 because nothing was
watching.** Two measures stop it recurring, and both fit how this repo already
works:

**(a) A gate.** There are 103 gates here; the culture exists. A
`gate_dependency_audit.js` running `npm audit --omit=dev`, failing on new
production advisories, catches this at commit time rather than two months later on
a hosting dashboard. **Production-only matters** — include dev and it will complain
about jest forever and get ignored, which is how a gate becomes decoration.

**(b) Dependabot on the GitHub repo.** Free, opens PRs when advisories land.

⚠️ **CONFIGURE DEPENDABOT FOR PULL REQUESTS ONLY — NEVER AUTO-MERGE.** Pushes to
`main` deploy automatically (§1). A bot merging at 3am would deploy untested
dependency changes straight to production. Same reasoning puts the gate in the push
path rather than in a nightly job.

**Suggested order:** Node 22 (§4.1) → express-rate-limit (§4.2) → the gate (§5a).
Arguably the gate first, since it is the lowest-risk piece and makes every later
step self-checking.

---

## 6. HOW TO RE-VERIFY FROM SCRATCH

```bash
# production tree only — what actually ships
npm audit --omit=dev

# is a flagged package production or build tooling?
npm ls <package> --omit=dev --all

# duplicate copies of one package (how the mysql2 credential leak hid)
find node_modules -path "*<pkg>/package.json" | while read f; do \
  echo "$(node -e "console.log(require('./$f').version)")  <- $(dirname $f)"; done

# do the app's own modules still load and expose the APIs we call?
node -e "require('express')(); require('multer')({dest:'/tmp'}).single; ..."
```

Baseline for the gate suite, so a future session can tell signal from noise:
**86 of 103 gates pass; 17 fail.** Two of the 17 need a database
(`gate_email_templates_have_senders`, `gate_orders_visibility`); the other 15 are
genuine drift where code moved and the gate did not follow — for example
`gate_nav_single_source` and `gate_hero_settings` both die on `jmvReviews is not
defined` because they render EJS without supplying a variable the templates now
expect. **This baseline was unchanged by `0dbf443`**, which is how we knew the
dependency work moved nothing in the application. Separate backlog; see the session
notes on the red gates.
