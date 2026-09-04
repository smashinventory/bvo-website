# BVO ⇄ JMV Shopify sync — interface note

**Date:** 2026-09-03
**Re:** proposed changes to `jmv_sync/jmv_shopify_sync.php`
**From:** BVO side

---

## 1. Your three changes are approved. None of them affect BVO.

Checked against our code, not assumed:

| your change | our verdict |
|---|---|
| `RAW_KEEP_FLOOR = 3` purge floor | **Good for us.** `JM_Feed_Repo/archive` is the directory our nightly rollup reads (`JMV_FEED_ARCHIVE`). A floor that keeps the three newest regardless of age is strictly protective of our input. |
| Log wording change | **No impact.** We grepped every `.js`, `.ejs` and `.sh` in BVO: nothing reads `jmv_sync/logs/cron.log`, and nothing pattern-matches `likely a BVO deploy wipe`. Your one flagged concern is a non-issue. |
| `state/retention_status.json` | **Not read by us.** Noted as available; we have no dependency on it. |

The phrase "deploy wipe" does appear twice in BVO — in a dashboard tooltip and
a code comment. Both are our own prose describing the behaviour. Neither
parses your log.

## 2. The interface contract is unchanged, and we agree with your statement of it

`jmsync.sh` writes the drop into `public_html/JM_Feed/archive`; your script
reads it and mirrors into `JM_Feed_Repo/archive`. One direction. BVO's rollup
then reads the protected archive read-only. Nothing in this change alters that.

## 3. Something you could not have known — and it was our bug, not yours

**The already-live change** (raw retention 90 → 730 days) interacts with a
defect on our side. Flagging it so you're not surprised if we mention it, and
so the record shows the retention change was correct.

**The mechanism.** Our rollup decided which dates still needed processing by
asking which ones already had rows in `jmv_daily_movement`. But two outcomes
deliberately write *no* movement rows:

- **feed unchanged** — the workbook is byte-identical to the previous day, so
  we record no observation. This is intentional: it stops our charts showing a
  false `$0` demand day.
- **invalid** — row count deviates too far from the median.

Both write to `jmv_snapshot_validity` instead. Neither ever appears in
`jmv_daily_movement` — so those dates were **re-read on every single run,
indefinitely**.

Observed on 2026-09-03: **five of the six archived dates** were reprocessed on
both runs that night.

**Why retention mattered.** `RAW_KEEP_DAYS = 90` was the only thing capping
that. At 90 days the re-read set could never exceed ~90 workbooks. At 730 the
cap is gone — potentially several hundred XLSX files, ~5,200 rows each,
re-parsed nightly against Hostinger's 30-minute process kill limit. A normal
night currently takes about 60 seconds.

It would not have failed tomorrow. It would have failed silently, months out,
as an exit 137 in a log nobody was watching.

**Fixed on our side**, not yours: the "already processed" check now considers
a `jmv_snapshot_validity` row as a completed evaluation, not just a movement
row. Re-reads on a steady-state night go from 5 to 0.

**Your retention increase is right and we want it.** Longer raw retention is
what lets us backfill and re-derive history. The bug was our incremental
filter assuming one table told the whole story.

## 4. Ask — ANSWERED, 2026-09-03

Asked for retained count and oldest retained date in
`state/retention_status.json`. Their reply:

> `oldest_date` is in, both blocks — `YYYY-MM-DD` from the workbook's mtime,
> which the mirror preserves from the original drop, so it's the day the feed
> describes rather than the day it was copied. Null when the directory is
> empty. `count` was already there. No other field changed.

**mtime-derived is the right choice and worth recording why.** The mirror
copies with `touch($dst, filemtime($src))` specifically to preserve the drop
date, so `oldest_date` is the date the feed *describes*. A copy-time date
would have reset on every re-mirror and made the archive look permanently
young — the opposite of the signal we want.

`null` on an empty directory is also correct: it is distinguishable from a
date, so BVO can tell "no archive" from "old archive" instead of coercing one
into the other.

## 4b. Their observation on the failure mode — and why it changes our fix

> the failure would have been gradual rather than sudden: the re-read set
> grows one workbook a day, so the run creeps past 30 minutes months out with
> no single day looking wrong.

This is the more important half of the finding. A failure with **no bad day
before the fatal one** cannot be caught by watching for errors, because there
is nothing to see until the run is already being killed. Alerting on failure
is the wrong instrument for a monotonic trend.

The consequence for BVO: `oldest_date` and `count` should be read as a
**trend**, surfaced next to rollup status, not as a threshold that fires an
alert. The number to watch is archive depth going up, not a run going red.

Same shape as `REFUSE_AGE_HOURS` on the feed side — measure the thing that
degrades, do not wait for the thing that breaks.

## 5. What we changed on our side

- `src/jobs/jmvMovementRollup.js` — date-discovery filter now `UNION`s
  `jmv_daily_movement` and `jmv_snapshot_validity`. Escape hatch preserved:
  `runRollup({ dates: [...] })` bypasses the filter entirely if a workbook is
  ever genuinely replaced.
- Nothing else. We did not modify, and will not modify, anything under
  `jmv_sync/`.
