'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   /notify-me — back-in-stock request capture.

   One POST. No account, no password, no confirmation step. The whole point is
   that somebody standing on a dead-end out-of-stock page can leave an address
   in two seconds; any friction added here defeats the feature.

   ⚠️ THIS ENDPOINT ALWAYS REPORTS SUCCESS TO THE BROWSER.

   Not out of laziness — deliberately. The responses must not differ between
   "saved", "already on the list", and "that is not a real address", because a
   differing response turns this into an oracle: submit an address, read the
   reply, learn whether that person is already waiting on a product. That is a
   privacy leak on a public endpoint with no auth in front of it.

   Genuine failures are logged server-side where they can be fixed, and the
   customer sees the same calm confirmation either way. The cost is that a
   typo'd address fails silently; the benefit is that the endpoint cannot be
   mined. For a one-email-per-product notice that is the right trade.
   ═══════════════════════════════════════════════════════════════════════════ */

const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();

const rules = require('../config/stockNotify');

function pool() { return require('../config/database').bvoPool; }

/* IP is hashed, never stored raw. It exists only to throttle abuse, and a
   plain IP column is personal data we would then have to defend, retain and
   delete on request for no operational gain. */
function hashIp(req) {
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + '|bvo-notify').digest('hex').slice(0, 64);
}

/* ⚠️ THE SAME ANSWER IN TWO SHAPES, NEVER TWO ANSWERS.
   With JS the form posts by fetch and wants JSON. Without JS the browser does
   a normal form POST, and replying with JSON would paint `{"ok":true}` as a
   bare page — the customer's last impression being a line of machine output.
   So a non-AJAX caller is redirected back to the product page it came from
   with ?notified=1, which the template turns into the same confirmation line.

   Both paths still say exactly one thing, success, for the reasons in the
   header. Nothing here may start reporting failure to one and not the other. */
function replyOk(req, res) {
  const wantsJson =
    req.xhr ||
    (req.get('x-requested-with') || '').toLowerCase() === 'xmlhttprequest' ||
    (req.get('accept') || '').includes('application/json');

  if (wantsJson) return res.json({ ok: true });

  /* Only ever back to our own product pages — a referer is attacker-supplied,
     so echoing it into a redirect unchecked is an open-redirect. */
  const ref = String(req.get('referer') || '');
  const safe = /^https?:\/\/(www\.)?bathroomvanitiesoutlet\.com\/products\/[a-z0-9._-]+\/?$/i.test(ref)
    ? ref.split('?')[0]
    : '/';
  return res.redirect(303, `${safe}?notified=1`);
}

router.post('/', async (req, res) => {
  const ok = () => replyOk(req, res);

  try {
    const { product_id, sku, email, marketing_opt_in, company } = req.body || {};

    /* Honeypot. A human never sees this field, so anything in it is a bot.
       Answer normally so the bot cannot tell it was caught. */
    if (company) return ok();

    const clean = rules.normaliseEmail(email);
    const pid   = Number(product_id);

    if (!rules.isPlausibleEmail(clean) || !Number.isInteger(pid) || pid <= 0) {
      console.warn('[notify-me] rejected submission', { pid, hasEmail: Boolean(email) });
      return ok();            // same answer as success — see header
    }

    /* ⚠️ sku comes from the form, so it is not trusted for anything that
       matters — it is denormalised for reporting only. The product_id is
       what the job joins on, and the INSERT fails on the foreign key if the
       id is invented. */
    await pool().query(
      `INSERT INTO stock_notifications
         (product_id, sku, email, marketing_opt_in, source_url, user_agent, ip_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         /* Asking again is not a second request — it is the same person
            re-confirming. Refresh the clock so a long-dormant request does not
            expire out from under somebody who just asked again, and let them
            upgrade (never downgrade) the marketing choice. */
         created_at       = NOW(),
         marketing_opt_in = GREATEST(marketing_opt_in, VALUES(marketing_opt_in))`,
      [
        pid,
        String(sku || '').slice(0, 64),
        clean,
        rules.wantsMarketing(marketing_opt_in) ? 1 : 0,
        String(req.get('referer') || '').slice(0, 512) || null,
        String(req.get('user-agent') || '').slice(0, 255) || null,
        hashIp(req),
      ]
    );

    return ok();
  } catch (err) {
    /* Logged, never surfaced. A raw err.message in a JSON response is how
       table names end up in somebody's browser console. */
    console.error('[notify-me] save failed:', err.message);
    return ok();
  }
});

module.exports = router;
