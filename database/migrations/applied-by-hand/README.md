# Applied by hand

Migrations that were written, run against the live database through
phpMyAdmin, and then left sitting untracked in a root `migrations/`
folder on one laptop. They are in version control now because losing
that folder would have lost the only record of fifteen schema changes.

**The runner does not execute anything in here.** `run.js` reads
`fs.readdirSync(__dirname)` and keeps only entries ending in `.sql` —
a subdirectory is not one, so these are invisible to `npm run migrate`.
That is deliberate: they are already applied, and re-running several of
them would be destructive.

## Why they are not renumbered into the main sequence

Renumbering implies they should run in that order on a fresh database.
They should not — several are one-off repairs against a specific data
state (`repair_blank_shipment_status`, `clear_staging_test_shipments`),
and one is a 976 KB data load (`2026-09-05_erv_load.sql`). Date-prefixed
names say what they are: a dated record of something that happened.

## The one rename

`014_jmv_velocity.sql` → `2026-09-03_jmv_velocity.sql`

It collided with the tracked `014_policy_pages.sql`. Two different
migrations, both numbered 014, in two different folders — with a runner
that sorts by filename, that is an ambiguity waiting to bite. The date
form removes the number entirely rather than picking a winner.

## If you need one of these on a new database

Read it first. Several assume rows that only exist in production.
Copy the parts you need into a new numbered migration in the parent
directory, make it idempotent, and let the runner record it.

## Related

The two genuinely dangerous migrations in the parent directory are now
self-guarded — see the banner comments in `005_refactor_pav_to_attr_key.sql`
and `008_color_refactor.sql`. `run.js` also keeps a `schema_migrations`
ledger so nothing re-runs, but the guards are what protect the
phpMyAdmin paste path, which is how migrations here actually get run.
