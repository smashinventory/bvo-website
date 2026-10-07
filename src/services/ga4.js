'use strict';

/* ga4.js — read-only traffic figures from the GA4 Data API.
 *
 * NO DEPENDENCY, ON PURPOSE. The official @google-analytics/data client
 * pulls google-gax, gRPC and protobuf - tens of megabytes of native-ish
 * tree - and node_modules is gitignored, so Hostinger runs npm install on
 * every deploy. A failed or slow install of that tree would mean a
 * top-level require() throwing and the ENTIRE STOREFRONT down, to render
 * four numbers on an admin page. The Data API is plain REST and a service
 * account JWT is 40 lines of crypto that ships with Node.
 *
 * FAIL-SOFT LIKE siteEvents. Nothing here throws to a caller: every public
 * function resolves to { ok:false, reason } instead. The dashboard renders
 * its first-party funnel either way - GA being down must never cost the
 * admin the numbers we own.
 *
 * CONFIGURED BY ENV, not by settings, because a private key does not belong
 * in a database row that the theme editor can read:
 *   GA4_PROPERTY_ID   numeric property id (NOT the G- measurement id)
 *   GA4_SA_EMAIL      service-account address, ...iam.gserviceaccount.com
 *   GA4_SA_KEY        its private key, PEM. \n escapes are accepted.
 */

const crypto = require('crypto');

const TOKEN_URL  = 'https://oauth2.googleapis.com/token';
const SCOPE      = 'https://www.googleapis.com/auth/analytics.readonly';
const API        = 'https://analyticsdata.googleapis.com/v1beta';

/* GA4 quotas are per-property-per-day and an admin refreshing a dashboard
   is the easiest way to burn them. Ten minutes is fresh enough for a page
   nobody watches second by second. */
const TTL_MS = 10 * 60 * 1000;
const _cache = new Map();
let _token = null;   // { value, expiresAt }

function config() {
  const id    = (process.env.GA4_PROPERTY_ID || '').trim();
  const email = (process.env.GA4_SA_EMAIL    || '').trim();
  let   key   = (process.env.GA4_SA_KEY      || '').trim();
  /* Env vars cannot hold real newlines on most panels, so the key is
     normally pasted with literal backslash-n. Both forms are accepted;
     a PEM without newlines will not parse. */
  if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
  if (key.startsWith('"') && key.endsWith('"')) key = key.slice(1, -1);

  /* THE MEASUREMENT ID IS NOT THE PROPERTY ID, and this codebase already
     has the other one in env as GA4_ID (G-PLBNP2YD9K), one word away from
     GA4_PROPERTY_ID. The page tag wants G-...; the Data API wants the
     numeric property id from GA4 > Admin > Property details. Pasting the
     G- value here would otherwise fail deep inside the API with an opaque
     403, so it is named here instead. */
  const looksLikeMeasurementId = /^(G|UA|AW|GT)-/i.test(id);
  const looksNumeric           = /^\d+$/.test(id);

  return {
    id, email, key,
    ready: !!(id && email && key) && looksNumeric,
    idProblem: !id ? null
      : looksLikeMeasurementId
        ? 'GA4_PROPERTY_ID is set to ' + id + ', which is a Measurement ID. '
          + 'The Data API needs the numeric Property ID from GA4 > Admin > '
          + 'Property details. The G- value belongs in GA4_ID, where it already is.'
      : !looksNumeric
        ? 'GA4_PROPERTY_ID should be digits only, got: ' + id
        : null,
  };
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* Service-account flow: sign a JWT asserting who we are and what we want,
   trade it for a short-lived access token. */
async function accessToken() {
  const cfg = config();
  if (!cfg.ready) return null;
  if (_token && _token.expiresAt > Date.now() + 60000) return _token.value;

  const now    = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim  = b64url(JSON.stringify({
    iss: cfg.email, scope: SCOPE, aud: TOKEN_URL,
    iat: now, exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(header + '.' + claim);
  const jwt = header + '.' + claim + '.' + b64url(signer.sign(cfg.key));

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    /* The body carries the real reason - wrong key, clock skew, API not
       enabled - and it is the only way to debug this from a log. */
    throw new Error('token ' + res.status + ': ' + (json.error_description || json.error || 'no token'));
  }
  _token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 };
  return _token.value;
}

async function runReport(body) {
  const cfg = config();
  const token = await accessToken();
  const res = await fetch(`${API}/properties/${encodeURIComponent(cfg.id)}:runReport`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json.error && json.error.message) || ('HTTP ' + res.status);
    throw new Error(msg);
  }
  return json;
}

const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };

/**
 * Traffic for the last `days` days. Resolves to
 *   { ok:true, users, newUsers, sessions, views, avgEngagementSec,
 *     engagementRate, topPages:[], channels:[], cached }
 * or { ok:false, reason, configured } — never rejects.
 */
async function traffic(days) {
  const cfg = config();
  if (!cfg.ready) {
    /* A wrong-shaped id is a CONFIGURED failure, not an absent one: the
       page should say "you pasted the wrong id" rather than "not set up". */
    if (cfg.idProblem) return { ok: false, configured: true, reason: cfg.idProblem };
    return { ok: false, configured: false,
             reason: 'GA4_PROPERTY_ID, GA4_SA_EMAIL and GA4_SA_KEY are not all set' };
  }

  const key = 'traffic:' + days;
  const hit = _cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return { ...hit.value, cached: true };

  const range = [{ startDate: `${days}daysAgo`, endDate: 'today' }];
  try {
    const [totals, pages, channels] = await Promise.all([
      runReport({ dateRanges: range, metrics: [
        { name: 'totalUsers' }, { name: 'newUsers' }, { name: 'sessions' },
        { name: 'screenPageViews' }, { name: 'averageSessionDuration' },
        { name: 'engagementRate' },
      ]}),
      runReport({ dateRanges: range,
        dimensions: [{ name: 'pagePath' }],
        metrics: [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
        orderBys: [{ desc: true, metric: { metricName: 'screenPageViews' } }],
        limit: 15 }),
      runReport({ dateRanges: range,
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ desc: true, metric: { metricName: 'sessions' } }],
        limit: 10 }),
    ]);

    const row = (totals.rows && totals.rows[0] && totals.rows[0].metricValues) || [];
    const value = {
      ok: true, configured: true,
      users:            num(row[0] && row[0].value),
      newUsers:         num(row[1] && row[1].value),
      sessions:         num(row[2] && row[2].value),
      views:            num(row[3] && row[3].value),
      avgEngagementSec: Math.round(num(row[4] && row[4].value)),
      engagementRate:   Math.round(num(row[5] && row[5].value) * 1000) / 10,
      topPages: (pages.rows || []).map(r => ({
        path:    (r.dimensionValues[0] || {}).value || '',
        views:   num((r.metricValues[0] || {}).value),
        avgSec:  Math.round(num((r.metricValues[1] || {}).value)),
      })),
      channels: (channels.rows || []).map(r => ({
        name:     (r.dimensionValues[0] || {}).value || '(unknown)',
        sessions: num((r.metricValues[0] || {}).value),
      })),
      fetchedAt: new Date(),
    };
    _cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
    return { ...value, cached: false };
  } catch (err) {
    console.error('[ga4] traffic failed (ignored):', err && err.message);
    /* Serve stale rather than nothing: a ten-minute-old number beats an
       error box, and the page labels it. */
    if (hit) return { ...hit.value, cached: true, stale: true };
    return { ok: false, configured: true, reason: err && err.message };
  }
}

module.exports = { traffic, config };
