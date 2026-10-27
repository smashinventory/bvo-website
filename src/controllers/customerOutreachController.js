'use strict';

/**
 * customerOutreachController — talking to a customer from inside the admin.
 *
 * WHY THIS EXISTS. On 2026-10-05 order 16 failed at checkout: Heather,
 * michael.wesseler@gmail.com, three backsplashes, $657. Checkout had been
 * broken for fourteen days (two bugs, fixed in cbafe9f). She called. The
 * customer record showed no phone number and the screen had no way to
 * email her — no Contact button, no resend, nothing. Whatever was sent
 * afterwards was sent from someone's own Outlook and left no trace here.
 *
 * FOUR THINGS, and the reasoning behind each is at its own handler:
 *
 *   sendMessage   — Contact Customer: a template as a starting point, or a
 *                   blank box. One send path for both.
 *   resendReceipt — the order confirmation again, to the address on file.
 *   correctEmail  — fix a mistyped address on the ORDER and the CUSTOMER,
 *                   then resend. This is the one with teeth: customers.email
 *                   is UNIQUE, so the corrected address may already belong
 *                   to another row, and the only honest resolutions are
 *                   merge or refuse.
 *   mergePreview  — what a merge would move, before anyone agrees to it.
 *
 * ⚠️ EVERY SEND IS LOGGED, including the failures, and the log is written
 * whether the send worked or not. An outreach tool with no record is how
 * "did anyone ever get back to her?" became unanswerable in the first
 * place. There is deliberately no code path here that sends without
 * logging — see logMessage() and the gate that asserts it.
 */

const { bvoPool }   = require('../config/database');
const brevo         = require('../services/brevoService');
const orderEmails   = require('../services/orderEmails');
const emailVerify   = require('../services/emailVerificationService');
const contactLog    = require('../utils/contactLog');

/* Same shape as ordersController uses (line 1023). The session is the only
   identity the admin has; 'admin' is the honest fallback, not a guess. */
const actorOf = req => req.session?.adminUser || 'admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean    = e => String(e || '').trim().toLowerCase();

/* ─────────────────────────────────────────────────────────────────────
   THE LOG — one function, so there is one place to break.

   Returns the inserted id, or null. Never throws: a logging failure must
   not turn a message the customer already received into a 500 that makes
   an operator send it twice.

   Written AFTER the send attempt and BEFORE the redirect, with the real
   outcome. Writing it before the attempt would record intentions; writing
   it only on success would hide exactly the rows worth reading.
───────────────────────────────────────────────────────────────────────── */
async function logMessage(fields) {
  try {
    const [r] = await bvoPool.query(
      `INSERT INTO customer_messages
         (customer_id, order_id, to_email, to_name, kind, template_key,
          subject, body_html, sent_ok, outcome, contact_phone, error, actor)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [fields.customerId || null,
       fields.orderId    || null,
       /* ⚠️ `|| null`, ADDED 2026-10-27 WITH THE CALL LOG. Before that
          to_email was NOT NULL and every caller was a send, so an
          undefined here would have thrown — loudly, which was fine. A
          phone-only contact legitimately has no address now, and the
          column accepts NULL, so an undefined must become an explicit
          NULL rather than reaching the driver as undefined. */
       fields.toEmail    || null,
       fields.toName     || null,
       fields.kind,
       fields.templateKey || null,
       String(fields.subject || '').slice(0, 300),
       fields.bodyHtml   || null,
       fields.sentOk ? 1 : 0,
       fields.outcome      || null,
       fields.contactPhone || null,
       fields.error ? String(fields.error).slice(0, 500) : null,
       fields.actor]
    );
    return r.insertId;
  } catch (err) {
    /* Loud, because this is the one failure that makes the feature lie
       about itself. */
    console.error('[outreach] COULD NOT LOG a send to', fields.toEmail,
                  '—', err && err.message);
    return null;
  }
}
exports._logMessage = logMessage;

/* ─────────────────────────────────────────────────────────────────────
   Variables available to a template chosen in the compose box.

   Templates are written with {{placeholders}} (brevoService.substituteVars).
   A template rendered with an empty bag silently becomes "Hi , about order
   — ", so the bag is built from the customer and, when the compose box was
   opened from an order, that order too.

   ⚠️ SUBSTITUTED ONCE, HERE, and the RESULT is what the operator edits and
   what gets sent — via sendRaw, not sendTemplate. Sending through
   sendTemplate would re-read the template from the database and re-render
   it, discarding every edit the operator just made, and would mean the body
   logged was not the body sent.
───────────────────────────────────────────────────────────────────────── */
function varsFor(customer, order) {
  const money = n => `$${Number(n || 0).toLocaleString('en-US',
    { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const first = (customer && customer.first_name)
             || (order && order.ship_first_name) || 'there';
  return {
    customer_first_name: first,
    customer_name: [first, (customer && customer.last_name) ||
                           (order && order.ship_last_name) || '']
                     .join(' ').trim(),
    customer_email: (customer && customer.email) || (order && order.guest_email) || '',
    order_number:   (order && order.order_number) || '',
    order_total:    order ? money(order.total) : '',
    order_date:     order && order.created_at
                      ? new Date(order.created_at).toLocaleDateString('en-US',
                          { year: 'numeric', month: 'long', day: 'numeric' })
                      : '',
  };
}
exports._varsFor = varsFor;

/* ── GET /admin/marketing/outreach/template ──────────────────────────
   Feeds the compose box when the operator picks a template. JSON, because
   switching the dropdown must not throw away whatever they have typed —
   a page reload would.

   Read-only and sends nothing. The operator still has to press Send, and
   the body they send is the body they see.
───────────────────────────────────────────────────────────────────────── */
exports.loadTemplate = async (req, res) => {
  try {
    const key = String(req.query.key || '').trim();
    if (!key) return res.json({ ok: false, error: 'No template selected.' });

    const [[tpl]] = await bvoPool.query(
      'SELECT trigger_key, label, subject, body_html, is_active FROM email_templates WHERE trigger_key = ? LIMIT 1',
      [key]);
    if (!tpl) return res.json({ ok: false, error: 'That template no longer exists.' });

    const customerId = parseInt(req.query.customer_id, 10) || null;
    const orderId    = parseInt(req.query.order_id, 10) || null;

    let customer = null, order = null;
    if (customerId) {
      const [[c]] = await bvoPool.query(
        'SELECT id, email, first_name, last_name FROM customers WHERE id = ? LIMIT 1', [customerId]);
      customer = c || null;
    }
    if (orderId) {
      const [[o]] = await bvoPool.query(
        `SELECT id, order_number, total, created_at, guest_email,
                ship_first_name, ship_last_name
           FROM orders WHERE id = ? LIMIT 1`, [orderId]);
      order = o || null;
    }

    const rendered = brevo.previewTemplate(tpl, varsFor(customer, order));

    /* An inactive template is still offered — an operator sending by hand
       is not the trigger that was switched off — but it is labelled, so
       nobody wonders why the automated version never fires. */
    return res.json({
      ok: true,
      subject:   rendered.subject,
      body_html: rendered.body_html,
      inactive:  String(tpl.is_active) !== '1',
      label:     tpl.label,
    });
  } catch (err) {
    console.error('[outreach.loadTemplate]', err);
    return res.json({ ok: false, error: 'Could not load that template.' });
  }
};

/* ── POST /admin/marketing/customers/:id/message ─────────────────────
   Contact Customer — the Template Response / Blank Response box.

   BOTH go out through sendRaw. The difference between them is only what
   the textarea contained when it was opened; by the time Send is pressed
   there is one subject, one body, and one send path. Two paths would mean
   two places for the log to be forgotten.
───────────────────────────────────────────────────────────────────────── */
exports.sendMessage = async (req, res) => {
  const id    = parseInt(req.params.id, 10);
  const back  = `/admin/marketing/customers/${id}`;
  const actor = actorOf(req);

  try {
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/marketing/customers');

    const [[customer]] = await bvoPool.query(
      'SELECT id, email, first_name, last_name FROM customers WHERE id = ? LIMIT 1', [id]);
    if (!customer) return res.redirect('/admin/marketing/customers');

    /* The operator may be writing about a specific order. Recorded so the
       message shows on that order's timeline too. */
    const orderId = parseInt(req.body.order_id, 10) || null;

    const to      = clean(req.body.to_email) || clean(customer.email);
    const subject = String(req.body.subject || '').trim();
    const body    = String(req.body.body_html || '').trim();
    const key     = String(req.body.template_key || '').trim() || null;
    const kind    = key ? 'template' : 'blank';
    const toName  = [customer.first_name, customer.last_name].join(' ').trim();

    if (!EMAIL_RE.test(to))
      return res.redirect(`${back}?msg_err=${encodeURIComponent('That is not a valid email address.')}`);
    if (!subject)
      return res.redirect(`${back}?msg_err=${encodeURIComponent('A subject is required — a blank subject reads as spam.')}`);
    if (!body)
      return res.redirect(`${back}?msg_err=${encodeURIComponent('The message is empty.')}`);

    /* Blocklist first. Brevo DROPS mail to a blocked address and still
       returns 201, so without this the operator is told it went and the
       customer gets nothing — the precise failure they are phoning about. */
    if (await brevo.isBlocked(to)) {
      const err = `${to} is on the Brevo blocklist (an earlier message ` +
                  'hard-bounced or was marked as spam), so Brevo will ' +
                  'discard this one. Nothing was sent.';
      await logMessage({ customerId: id, orderId, toEmail: to, toName, kind,
                         templateKey: key, subject, bodyHtml: body,
                         sentOk: false, error: err, actor });
      return res.redirect(`${back}?msg_err=${encodeURIComponent(err)}`);
    }

    const r = await brevo.sendRaw(to, subject, body, toName);
    /* sendRaw resolves rather than throwing, and { skipped: true } when
       BREVO_API_KEY is unset. ok must be read, not assumed. */
    const sentOk = !!(r && r.ok);
    const error  = sentOk ? null
      : (r && r.skipped) ? 'BREVO_API_KEY is not set on this server — nothing was sent.'
      : (r && typeof r.error === 'string') ? r.error
      : (r && r.error) ? JSON.stringify(r.error)
      : 'Brevo refused the message and gave no reason.';

    await logMessage({ customerId: id, orderId, toEmail: to, toName, kind,
                       templateKey: key, subject, bodyHtml: body,
                       sentOk, error, actor });

    return res.redirect(sentOk
      ? `${back}?msg_ok=${encodeURIComponent('Sent to ' + to + '.')}`
      : `${back}?msg_err=${encodeURIComponent(error)}`);
  } catch (err) {
    console.error('[outreach.sendMessage]', err);
    return res.redirect(`${back}?msg_err=${encodeURIComponent('Something went wrong — nothing was sent. Check the server log.')}`);
  }
};

/* ── POST /admin/orders/:id/resend-receipt ───────────────────────────
   The order confirmation, again.

   ANY ADMIN, LOGGED, NO LIMIT — the owner's explicit choice. The rate
   limit people reach for here protects against a bored operator spamming a
   customer; the actual risk in this business is a customer who never got
   their receipt and cannot get anyone to send it. The log is the control.

   Reuses orderEmails.resend, so this is byte-for-byte the message the
   webhook sends. A second hand-built "receipt" template would drift from
   the real one and nobody would notice until a customer compared two.
───────────────────────────────────────────────────────────────────────── */
exports.resendReceipt = async (req, res) => {
  const id    = parseInt(req.params.id, 10);
  const back  = `/admin/orders/${id}`;
  const actor = actorOf(req);

  try {
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/orders');

    const [[order]] = await bvoPool.query(
      'SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
    if (!order) return res.redirect('/admin/orders');

    const [items] = await bvoPool.query(
      'SELECT name, qty, line_total FROM order_items WHERE order_id = ?', [id]);

    /* An override address sends to somewhere other than the order without
       changing the order. Used by correctEmail below to send the proof
       BEFORE committing a merge, and available on its own for a one-off
       ("send it to my work address too") that should not rewrite a record. */
    const override = clean(req.body.to_email);
    if (override && !EMAIL_RE.test(override))
      return res.redirect(`${back}?rr_err=${encodeURIComponent('That is not a valid email address.')}`);

    /* ⚠️ A FRESH TOKEN, not the original one.
       emailVerify.issueOrderToken replaces any outstanding token for this
       order, so the link in the new message works and the link in the old
       message stops working. That is the correct behaviour when the address
       was wrong: the old link went to a stranger's inbox, and a confirm
       link that still works there would let them mark someone else's
       address verified. Returns null rather than throwing; a null simply
       renders no button. */
    let token = null;
    try {
      token = await emailVerify.issueOrderToken(id);
    } catch (e) {
      console.error('[outreach.resendReceipt] token mint failed:', e && e.message);
    }

    const r = await orderEmails.resend(order, items, token, override || null);

    await logMessage({
      customerId:  order.customer_id || null,
      orderId:     id,
      toEmail:     r.to,
      toName:      [order.ship_first_name, order.ship_last_name].join(' ').trim(),
      kind:        'receipt_resend',
      templateKey: 'order_confirmed',
      subject:     `Order confirmation — ${order.order_number}`,
      /* The body is rendered inside Brevo from the stored template, so the
         exact HTML is not available to snapshot here without rendering it
         twice. What IS recorded is which template, which address, and the
         outcome — enough to answer "what did we send and did it land". */
      bodyHtml:    null,
      sentOk:      r.ok,
      error:       r.error || null,
      actor,
    });

    return res.redirect(r.ok
      ? `${back}?rr_ok=${encodeURIComponent('Receipt resent to ' + r.to + '.')}`
      : `${back}?rr_err=${encodeURIComponent(r.error || 'Nothing was sent.')}`);
  } catch (err) {
    console.error('[outreach.resendReceipt]', err);
    return res.redirect(`${back}?rr_err=${encodeURIComponent('Something went wrong — nothing was sent. Check the server log.')}`);
  }
};

/* ─────────────────────────────────────────────────────────────────────
   What a merge would do, counted before anyone agrees to it.

   Shared by mergePreview (the GET the UI calls) and correctEmail (which
   re-counts rather than trusting numbers that travelled through a form —
   the operator may have sat on the confirm screen for ten minutes).
───────────────────────────────────────────────────────────────────────── */
/* `db` is the pool for the read-only preview and the TRANSACTION's own
   connection when called from correctEmail. Counting through the pool mid
   transaction would read a different snapshot than the one being written,
   so the number recorded in customer_merges could disagree with the number
   of rows actually moved. */
async function mergeImpact(keepId, mergeId, db) {
  const q = db || bvoPool;
  const [[o]] = await q.query(
    'SELECT COUNT(*) AS n FROM orders WHERE customer_id = ?', [mergeId]);
  const [[a]] = await q.query(
    'SELECT COUNT(*) AS n FROM customer_addresses WHERE customer_id = ?', [mergeId]);
  const [[m]] = await q.query(
    'SELECT COUNT(*) AS n FROM customer_messages WHERE customer_id = ?', [mergeId]);
  return { orders: Number(o.n), addresses: Number(a.n), messages: Number(m.n),
           keepId, mergeId };
}

/* ── GET /admin/marketing/customers/:id/merge-preview?email=… ──────── */
exports.mergePreview = async (req, res) => {
  try {
    const id    = parseInt(req.params.id, 10);
    const email = clean(req.query.email);
    if (!Number.isInteger(id) || !EMAIL_RE.test(email))
      return res.json({ ok: false, error: 'Invalid request.' });

    const [[other]] = await bvoPool.query(
      'SELECT id, email, first_name, last_name, created_at FROM customers WHERE email = ? LIMIT 1',
      [email]);

    if (!other || other.id === id) return res.json({ ok: true, collision: false });

    return res.json({
      ok: true, collision: true, other,
      impact: await mergeImpact(id, other.id),
    });
  } catch (err) {
    console.error('[outreach.mergePreview]', err);
    return res.json({ ok: false, error: 'Could not check that address.' });
  }
};

/* ── POST /admin/orders/:id/correct-email ────────────────────────────
   Fix a mistyped address, then resend.

   THE OWNER'S CHOICE, stated: "Order + customer record, always." Not an
   option on the form — correcting one and not the other is how a customer
   ends up with a working receipt and a broken account, and the next
   receipt goes to the typo again.

   ⚠️ customers.email IS UNIQUE (`UNIQUE KEY email`, verified against the
   schema). So the corrected address may ALREADY belong to another customer
   row — which is likely, not exotic: the buyer who typed gmail.con has
   probably ordered from us before with the real address. The UPDATE then
   fails ER_DUP_ENTRY, and there are only two honest answers:

     merge   — move that row's orders, addresses and messages onto the
               existing customer, delete the empty row, record it in
               customer_merges. Requires confirm=1 from the operator, who
               has seen the counts.
     refuse  — say what collided and change nothing.

   It never silently picks one.

   ONE TRANSACTION over the whole correction. A half-applied correction —
   order fixed, customer not; or orders moved and the old row still there —
   is worse than no correction, because it looks done.
───────────────────────────────────────────────────────────────────────── */
exports.correctEmail = async (req, res) => {
  const id    = parseInt(req.params.id, 10);
  const back  = `/admin/orders/${id}`;
  const actor = actorOf(req);
  const fail  = m => res.redirect(`${back}?ce_err=${encodeURIComponent(m)}`);

  if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/orders');

  const next = clean(req.body.to_email);
  if (!EMAIL_RE.test(next)) return fail('That is not a valid email address.');

  const conn = await bvoPool.getConnection();
  let merged = null;

  try {
    await conn.beginTransaction();

    const [[order]] = await conn.query(
      'SELECT id, order_number, guest_email, customer_id FROM orders WHERE id = ? FOR UPDATE', [id]);
    if (!order) { await conn.rollback(); return res.redirect('/admin/orders'); }

    const previous = clean(order.guest_email);
    if (previous === next) { await conn.rollback(); return fail('That is already the address on this order.'); }

    /* ── the order ─────────────────────────────────────────────────── */
    await conn.query('UPDATE orders SET guest_email = ? WHERE id = ?', [next, id]);

    /* ── the customer record ───────────────────────────────────────── */
    let customerId = order.customer_id || null;

    if (customerId) {
      const [[collision]] = await conn.query(
        'SELECT id, email FROM customers WHERE email = ? AND id <> ? LIMIT 1',
        [next, customerId]);

      if (collision) {
        if (String(req.body.confirm) !== '1') {
          /* Refuse, loudly and specifically, and change NOTHING — the
             order update above is rolled back with everything else. The
             operator gets the counts from mergePreview and comes back. */
          await conn.rollback();
          const n = await mergeImpact(collision.id, customerId);
          return fail(
            `${next} already belongs to customer #${collision.id}. Merging ` +
            `would move ${n.orders} order(s), ${n.addresses} address(es) and ` +
            `${n.messages} message(s) off this record and delete it. ` +
            'Nothing was changed — tick "merge these customers" to proceed.');
        }

        /* MERGE. Direction matters: the row carrying the CORRECT address
           is the one that survives, because other rows already point at
           it and its address is the one that works. The typo'd row is the
           one that goes. */
        const keepId  = collision.id;
        const mergeId = customerId;

        const [[snapshot]] = await conn.query(
          'SELECT * FROM customers WHERE id = ? LIMIT 1', [mergeId]);
        const counts = await mergeImpact(keepId, mergeId, conn);

        /* ⚠️⚠️ RE-POINT EVERYTHING BEFORE THE DELETE, AND KEEP THIS LIST
           COMPLETE. The foreign keys on customers are ON DELETE CASCADE
           (fk_addr_customer, fk_device_customer, fk_fav_customer — only
           fk_order_customer is SET NULL). So a table missing from this
           list is NOT a loud error: the DELETE below silently destroys
           those rows. Forgetting `favorites` here would quietly wipe a
           customer's saved products as a side effect of fixing a typo in
           their email address.

           gate_customer_outreach.js reads every CREATE TABLE in the schema
           for a customer_id column and fails if one is not handled here. */
        await conn.query('UPDATE orders             SET customer_id = ? WHERE customer_id = ?', [keepId, mergeId]);
        await conn.query('UPDATE customer_addresses SET customer_id = ? WHERE customer_id = ?', [keepId, mergeId]);
        await conn.query('UPDATE customer_messages  SET customer_id = ? WHERE customer_id = ?', [keepId, mergeId]);
        await conn.query('UPDATE favorites          SET customer_id = ? WHERE customer_id = ?', [keepId, mergeId]);
        await conn.query('UPDATE saved_bundles      SET customer_id = ? WHERE customer_id = ?', [keepId, mergeId]);

        /* Carry over anything the surviving row is missing. A name or
           phone captured on the typo'd row is still the same person's. */
        await conn.query(
          `UPDATE customers k
             SET k.first_name = CASE WHEN (k.first_name IS NULL OR k.first_name = '') THEN ? ELSE k.first_name END,
                 k.last_name  = CASE WHEN (k.last_name  IS NULL OR k.last_name  = '') THEN ? ELSE k.last_name  END,
                 k.phone      = CASE WHEN (k.phone      IS NULL OR k.phone      = '') THEN ? ELSE k.phone      END
           WHERE k.id = ?`,
          [snapshot.first_name || null, snapshot.last_name || null,
           snapshot.phone || null, keepId]);

        /* ⚠️ NOT re-pointed, and each for its own reason:

           customer_auth_codes is keyed by EMAIL, not customer_id — it has
           no customer_id column at all, so an UPDATE here would be a SQL
           error, and none is needed: the surviving row keeps the address
           those codes were issued against. (Codes live minutes; any in
           flight expire on their own.)

           customer_devices is a set of REMEMBERED BROWSERS, tied to the
           row being deleted by fk_device_customer ON DELETE CASCADE. They
           are deliberately allowed to cascade away rather than be carried
           over: a device trusted under a mistyped address is a weaker
           claim than one trusted under the real one, and the cost of
           dropping it is that the customer gets one more sign-in code. */

        await conn.query('DELETE FROM customers WHERE id = ?', [mergeId]);

        await conn.query(
          `INSERT INTO customer_merges
             (kept_id, kept_email, merged_id, merged_email,
              merged_snapshot, moved_counts, actor, reason)
           VALUES (?,?,?,?,?,?,?,?)`,
          [keepId, next, mergeId, previous,
           JSON.stringify(snapshot), JSON.stringify(counts), actor,
           `email correction on order ${order.order_number}`]);

        customerId = keepId;
        merged     = { keepId, mergeId, counts };
      } else {
        await conn.query('UPDATE customers SET email = ? WHERE id = ?', [next, customerId]);
      }
    }

    await conn.query(
      `INSERT INTO order_events (order_id, event_type, actor, notes)
       VALUES (?, 'email_corrected', ?, ?)`,
      [id, actor,
       `${previous || '(blank)'} → ${next}` +
       (merged ? ` (merged customer #${merged.mergeId} into #${merged.keepId})` : '')]);

    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch { /* already gone */ }
    console.error('[outreach.correctEmail]', err);
    /* ER_DUP_ENTRY reaching here means a collision appeared between the
       check and the write — two operators, or a signup mid-transaction. */
    return fail(err && err.code === 'ER_DUP_ENTRY'
      ? 'That address was taken by another record while this was being saved. Nothing was changed — try again.'
      : 'The correction failed and nothing was changed. Check the server log.');
  } finally {
    conn.release();
  }

  /* ── and only now, the resend ───────────────────────────────────────
     OUTSIDE the transaction, deliberately. An email cannot be rolled back.
     Sending inside the transaction and then failing to commit would put a
     receipt in someone's inbox for a correction that never happened. */
  const note = merged
    ? ` Customer #${merged.mergeId} was merged into #${merged.keepId}: ` +
      `${merged.counts.orders} order(s) moved.`
    : '';

  /* ⚠️ MUST BE EQUAL TO '1', not "not equal to '0'".
     An UNCHECKED checkbox sends no field at all — the browser omits it, so
     req.body.resend is undefined, not '0'. Testing for '0' would have made
     unticking "resend the receipt" do nothing: the mail would go anyway. */
  if (String(req.body.resend) !== '1')
    return res.redirect(`${back}?ce_ok=${encodeURIComponent('Address corrected to ' + next + '.' + note)}`);

  /* Re-read the order rather than reusing the row from above: it is the
     COMMITTED guest_email that must be sent to, and no override is passed,
     so the send target and the stored record cannot disagree. */
  const [[order]] = await bvoPool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [id]);
  const [items]   = await bvoPool.query(
    'SELECT name, qty, line_total FROM order_items WHERE order_id = ?', [id]);

  let token = null;
  try { token = await emailVerify.issueOrderToken(id); }
  catch (e) { console.error('[outreach.correctEmail] token mint failed:', e && e.message); }

  const r = await orderEmails.resend(order, items, token, null);

  await logMessage({
    customerId:  order.customer_id || null,
    orderId:     id,
    toEmail:     r.to,
    toName:      [order.ship_first_name, order.ship_last_name].join(' ').trim(),
    kind:        'receipt_resend',
    templateKey: 'order_confirmed',
    subject:     `Order confirmation — ${order.order_number}`,
    bodyHtml:    null,
    sentOk:      r.ok,
    error:       r.error || null,
    actor,
  });

  return res.redirect(r.ok
    ? `${back}?ce_ok=${encodeURIComponent('Address corrected to ' + next + ' and the receipt resent.' + note)}`
    : `${back}?ce_err=${encodeURIComponent('Address corrected to ' + next + '.' + note +
        ' The resend FAILED: ' + (r.error || 'no reason given') + '. Use Resend receipt to try again.')}`);
};

/* ─────────────────────────────────────────────────────────────────────
   logContact — record a phone call or an internal note.

   WHY THIS IS NOT A SEND. Everything else in this file tries to deliver
   something and then records what happened. This records something that
   already happened out in the world, on a phone. Three consequences, and
   each one is a thing a gate asserts:

     1. NOTHING IS EMAILED. No brevo call, no template lookup. A handler
        that both logs a call and fires a "sorry we missed you" email
        would mail people who declined marketing — order 23 is exactly
        that person, and she is the reason this feature exists.

     2. sent_ok = 1 ALWAYS. The column means "the thing we recorded
        actually occurred". A call that happened is a true row. Writing 0
        would make every call look like a failed email in the timeline and
        in customerAnalyticsController's counts.

     3. IT IS LOGGED WHETHER OR NOT ANYONE WAS REACHED. "No answer" is the
        row that stops the next person dialling the same number ten
        minutes later. An outcome-gated log would record only the
        successful calls, which are the ones least needing a record.
───────────────────────────────────────────────────────────────────────── */
exports.logContact = async (req, res) => {
  const id    = parseInt(req.params.id, 10);
  const back  = `/admin/orders/${id}`;
  const actor = actorOf(req);
  const fail  = m => res.redirect(`${back}?cl_err=${encodeURIComponent(m)}`);

  try {
    if (!Number.isInteger(id) || id < 1) return res.redirect('/admin/orders');

    const [[order]] = await bvoPool.query(
      `SELECT o.id, o.customer_id, o.ship_first_name, o.ship_last_name,
              o.ship_phone, COALESCE(c.email, o.guest_email) AS email,
              c.phone AS customer_phone
         FROM orders o
         LEFT JOIN customers c ON c.id = o.customer_id
        WHERE o.id = ? LIMIT 1`, [id]);
    if (!order) return res.redirect('/admin/orders');

    const kind    = String(req.body.kind || 'call').trim();
    const outcome = String(req.body.outcome || '').trim();
    const note    = String(req.body.note || '').trim();

    if (!contactLog.CONTACT_KINDS.includes(kind))
      return fail('Unknown contact type.');

    /* ⚠️ VALIDATED AGAINST THE SHARED LIST, not re-typed here. The column
       is a VARCHAR precisely so this list can change without an ALTER —
       which only holds if there is ONE list and this is the thing that
       reads it. */
    if (kind === 'call' && !contactLog.isValidOutcome(outcome))
      return fail('Pick what happened on the call.');

    if (kind === 'note' && !note)
      return fail('A note needs something in it.');

    /* The number as dialled. ship_phone first: that is the number on the
       order the operator was looking at when they picked up the phone.
       customers.phone is the fallback for an order placed before the
       2026-10-19 backfill. */
    const phone = String(req.body.contact_phone || order.ship_phone ||
                         order.customer_phone || '').trim() || null;

    await logMessage({
      customerId: order.customer_id || null,
      orderId:    id,
      /* ⚠️ POPULATED EVEN THOUGH NOTHING WAS EMAILED. This is what joins a
         call to an email about the same person when customer_id is NULL,
         which is every guest order. See the migration's note on what
         to_email means now. NULL only when we genuinely have no address. */
      toEmail:    clean(order.email) || null,
      toName:     [order.ship_first_name, order.ship_last_name].join(' ').trim() || null,
      kind,
      templateKey: null,
      subject:     contactLog.subjectFor(kind, outcome),
      bodyHtml:    note ? `<p>${escapeHtml(note)}</p>` : null,
      sentOk:      true,
      error:       null,
      outcome:     kind === 'call' ? outcome : 'note',
      contactPhone: phone,
      actor,
    });

    return res.redirect(`${back}?cl_ok=${encodeURIComponent(
      kind === 'note' ? 'Note saved.'
                      : `Logged: ${contactLog.outcomeLabel(outcome).toLowerCase()}.`)}`);
  } catch (err) {
    console.error('[outreach.logContact]', err && err.message);
    return fail('Could not save that — check the server log.');
  }
};

/* Minimal, and only ever applied to a note the operator typed. The note is
   rendered inside the admin timeline, so an unescaped apostrophe is
   cosmetic but an unescaped <script> is not. */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Exported for the gate, which exercises the real functions rather than a
   restatement of them. */
exports._internals = { EMAIL_RE, clean, varsFor, mergeImpact, logMessage, actorOf, escapeHtml };
