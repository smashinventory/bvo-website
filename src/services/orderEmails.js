'use strict';

/**
 * orderEmails.js — the order confirmation, in ONE place.
 *
 * MOVED VERBATIM from checkoutController.sendConfirmation (line 2168) on
 * 2026-10-19. The body below is byte-for-byte the function that shipped
 * every receipt since the Stripe cutover; gate_customer_outreach proves it,
 * the same way gate_erv_inventory_sync proves utils/inventory.js and
 * cartPricing.js were provable no-ops when they were extracted.
 *
 * WHY IT MOVED. It was a private function inside a 2,300-line controller,
 * called once from the Stripe webhook. Nothing else could reach it, so
 * there was no way to re-send a receipt — and "my receipt never arrived"
 * is one of the most common support requests on the sister sites, almost
 * always because the buyer mistyped their own address at checkout.
 *
 * TWO ENTRY POINTS, deliberately different:
 *
 *   send()   — fire-and-forget, for checkout. The authorisation already
 *              exists; a mail failure must not look like an order failure.
 *              This is the original behaviour and must not change.
 *
 *   resend() — AWAITED, for the admin. An operator who clicks "Resend
 *              receipt" while the customer is on the phone needs to be
 *              told whether it actually went. Swallowing the error there
 *              would be the same silent-failure pattern that cost a day
 *              on 2026-10-19.
 */

const brevo       = require('./brevoService');
/* ⚠️ '../services/emailVerificationService', NOT '../utils/emailVerify'.
   The controller aliases it to `emailVerify`, which reads like a util and
   is not one. Only TOKEN_TTL_DAYS (7) is used here, inside the confirm
   block's expiry sentence — a bad path would throw at REQUIRE time, so
   the checkout route would 500 on load rather than at send time. */
const emailVerify = require('./emailVerificationService');

/* ── the shared body ─────────────────────────────────────────────── */
function buildVars(order, items, confirmToken) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const money = n => `$${Number(n || 0).toLocaleString('en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rows = items.map(it => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #e5e0d8">${esc(it.name)}${it.qty > 1 ? ` &times;${it.qty}` : ''}</td>
      <td style="padding:8px 0;border-bottom:1px solid #e5e0d8;text-align:right;white-space:nowrap">${money(it.line_total)}</td>
    </tr>`).join('');

  /* ── THE CONFIRM-YOUR-EMAIL BLOCK ────────────────────────────────
     Built here as WHOLE HTML, not as a bare URL, so that a missing
     token produces an empty string and the email renders clean rather
     than showing a button that goes nowhere.

     SITE_URL, not a request host: this runs from the Stripe webhook,
     where there is no buyer request to read a host from.

     The wording sells the BENEFIT — tracking and delivery updates —
     because that is what confirming actually buys the buyer. It must
     not read as a demand or imply the order is incomplete.

     The link is a GET to a page with a button, never a one-click
     confirm. Mail scanners follow links, and a scanner that
     auto-confirmed would destroy the only signal this flag carries. */
  const base = (require('../utils/siteUrl').base()).replace(/\/+$/, '');
  const confirmHtml = confirmToken
    ? `<div style="border:1px solid #e5e0d8;border-radius:8px;padding:18px 20px;margin:0 0 24px;background:#faf8f5">
  <p style="margin:0 0 12px;font-size:15px"><strong>Want delivery updates and tracking?</strong><br>
  Confirm this is your email and we will keep you posted the whole way.</p>
  <p style="margin:0 0 10px">
    <a href="${base}/orders/confirm?t=${encodeURIComponent(confirmToken)}"
       style="display:inline-block;background:#182840;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:700;font-size:14px">Confirm my email</a>
  </p>
  <p style="margin:0;font-size:12px;color:#7a7264">Optional &mdash; your order is already placed either way. This link works for ${emailVerify.TOKEN_TTL_DAYS} days.</p>
</div>`
    : '';

  return {
    vars: {
      confirm_button_html: confirmHtml,
      customer_first_name: order.ship_first_name || 'there',
      order_number:        order.order_number,
      order_date:          new Date().toLocaleDateString('en-US',
                             { year: 'numeric', month: 'long', day: 'numeric' }),
      order_items_html:    `<table style="width:100%;border-collapse:collapse">${rows}</table>`,
      order_total:         money(order.total),
    },
    toName: `${order.ship_first_name || ''} ${order.ship_last_name || ''}`.trim(),
  };
}

/* ── checkout: fire-and-forget, unchanged ────────────────────────── */
function send(order, items, confirmToken) {
  const { vars, toName } = buildVars(order, items, confirmToken);
  brevo.sendTemplate('order_confirmed', order.guest_email, vars, toName)
    .catch(err => console.error('[checkout] confirmation email failed for',
                                order.order_number, '—', err?.message || err));
}

/* ── admin: awaited, so the operator learns the truth ────────────── */
/**
 * @param {object} order  the order row (guest_email is the DEFAULT target)
 * @param {Array}  items  order_items rows
 * @param {string} [confirmToken]
 * @param {string} [toEmail] send somewhere ELSE than order.guest_email —
 *        used when correcting a typo, so the preview and the send agree
 *        even before the correction is committed.
 * @returns {Promise<{ok:boolean, to:string, error?:string}>} never throws
 */
async function resend(order, items, confirmToken, toEmail) {
  const to = String(toEmail || order.guest_email || '').trim();
  if (!to) return { ok: false, to: '', error: 'No email address on this order.' };

  /* Brevo keeps a blocklist — a hard bounce or a complaint lands an address
     on it and every later send to that address is DROPPED SILENTLY by
     Brevo. sendTemplate would return 201 and the customer would still get
     nothing, which is precisely the failure they are phoning about. So it
     is checked up front and reported as a refusal, not a success.

     isBlocked() already fails open by contract (brevoService.js:146) — an
     unreachable Brevo answers false rather than throwing, so a blocklist
     outage degrades to "send anyway", never to "refuse everything". The
     try/catch is belt-and-braces against that contract changing. */
  try {
    if (await brevo.isBlocked(to)) {
      return { ok: false, to,
               error: `${to} is on the Brevo blocklist — a previous send ` +
                      'hard-bounced or was marked spam, so Brevo will drop ' +
                      'this one too. Unblock it, or correct the address if ' +
                      'this one is wrong.' };
    }
  } catch (e) {
    console.error('[orderEmails.resend] blocklist check failed:', e?.message || e);
  }

  const { vars, toName } = buildVars(order, items, confirmToken);

  /* ⚠️ sendTemplate DOES NOT THROW. By contract (brevoService.js:272,
     "Nothing in this function may throw") it RESOLVES with one of:

         { ok: true,  messageId }      sent
         { ok: false, error }          Brevo or the network refused
         { skipped: true }             no BREVO_API_KEY, or the template
                                       row is missing or is_active = 0

     So a try/catch alone proves nothing: `await` succeeds in all three
     cases, and an early draft of this function returned { ok: true }
     unconditionally — reporting a confident success to the operator on
     exactly the failures they are standing at the screen to diagnose.
     The result OBJECT has to be read, not just awaited. */
  let r;
  try {
    r = await brevo.sendTemplate('order_confirmed', to, vars, toName);
  } catch (err) {
    /* Contract says unreachable. Belt-and-braces, because the cost of
       being wrong here is a 500 on an admin click. */
    return { ok: false, to, error: err?.message || String(err) };
  }

  if (r && r.ok) return { ok: true, to, messageId: r.messageId || null };

  if (r && r.skipped) {
    return { ok: false, to,
             error: 'Nothing was sent: either BREVO_API_KEY is not set on ' +
                    'this server, or the "order_confirmed" template is ' +
                    'missing or inactive in Email Templates.' };
  }

  const detail = r && r.error;
  return { ok: false, to,
           error: typeof detail === 'string' ? detail
                : detail ? JSON.stringify(detail)
                : 'Brevo refused the message and gave no reason.' };
}

module.exports = { send, resend, buildVars };
