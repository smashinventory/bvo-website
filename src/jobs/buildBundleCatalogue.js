'use strict';
/* ═══════════════════════════════════════════════════════════════════
   buildBundleCatalogue — the nightly bundle-builder catalogue build.

   Runs after the JM feed has landed and writes one row to
   bundle_catalogue. Nothing a visitor does ever triggers a build; the
   page only ever reads that row.

   SCHEDULE (UTC — the feed chain, from jmv_rollup.sh):

       04:30  jmsync.sh            JM feed -> BVO DB
       04:59  gvssync.sh           mirror
       05:30  jmv_rollup.sh        movement rollup
       06:30  THIS JOB             two hours after the feed

   06:30 UTC is 02:30 US Eastern. The gap is not arbitrary: this reads
   products, product_attribute_values and product_components, all of
   which jmsync rewrites. Running it while the import is mid-flight
   would snapshot a half-written catalogue and — because the writer
   refuses to store an EMPTY one but cannot detect a merely INCOMPLETE
   one — could persist something subtly wrong for a whole day.

   TWO TRIGGERS, ON PURPOSE. node-cron inside the app fires this, and
   bundle_catalogue.sh can fire it from system cron. jmv_rollup.sh
   documents exactly why that redundancy is worth having: its system
   cron was failing on a missing node PATH for weeks, and nobody noticed
   because the in-app schedule was quietly covering. Here the reverse is
   the bigger risk — the app can be idle or restarting at 06:30 and
   node-cron simply will not fire. Either one alone has a blind spot.

   Re-running is harmless: the writer upserts a single row.
   ═══════════════════════════════════════════════════════════════════ */

const { rebuildAndStore } = require('../controllers/bundleController');

/**
 * @param {'cron'|'admin'|'boot'|'manual'} source
 * @returns {Promise<{ok:boolean, ms:number, error?:string}>}
 */
async function runBundleCatalogueBuild(source = 'cron') {
  const t0 = Date.now();
  try {
    await rebuildAndStore(source);
    return { ok: true, ms: Date.now() - t0 };
  } catch (err) {
    /* Resolve rather than throw. The caller is a scheduler; an unhandled
       rejection in node-cron takes the process down, and a failed
       catalogue build must never do that — the page keeps serving the
       previous row, which is the whole point of storing it. */
    console.error('[bundle-cron] build FAILED:', err.message);
    return { ok: false, ms: Date.now() - t0, error: err.message };
  }
}

module.exports = { runBundleCatalogueBuild };

/* Allow `node src/jobs/buildBundleCatalogue.js` from a shell wrapper. */
if (require.main === module) {
  runBundleCatalogueBuild(process.argv[2] || 'cron').then(r => {
    console.log(r.ok
      ? `[bundle-cron] ok in ${r.ms}ms`
      : `[bundle-cron] failed after ${r.ms}ms: ${r.error}`);
    process.exit(r.ok ? 0 : 1);
  });
}
