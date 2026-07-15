'use strict';
/**
 * CLI shim — delegates to src/jobs/importJamesMartinFeed.js
 *
 * NOTE: Run on the SERVER only. Local .env has DB_HOST=127.0.0.1
 * which has no MySQL. Use the admin UI at /admin/products/import-jm
 * to trigger imports from your browser instead.
 */
require('./src/jobs/importJamesMartinFeed');
