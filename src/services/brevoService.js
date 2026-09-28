'use strict';

/**
 * brevoService.js
 * Sends transactional emails using templates stored in the email_templates DB table.
 * Uses Brevo's v3 transactional email API (axios, no SDK required).
 *
 * Usage:
 *   const brevo = require('./brevoService');
 *   await brevo.sendTemplate('order_confirmed', 'customer@example.com', {
 *     customer_first_name: 'Jane',
 *     product_name: 'Amberly 60" Vanity',
 *     order_number: 'BVO-20260001',
 *     estimated_ship_window: '7–10 business days',
 *   });
 */

const axios      = require('axios');
const { bvoPool } = require('../config/database');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
/* support@, NOT orders@.

   Brevo refuses ANY send from an address that is not on its
   verified-senders list, however valid the API key is and however well
   the domain is authenticated — DKIM and DMARC are checked on the
   DOMAIN, the sender ADDRESS is verified separately.

   As of 2026-09-27 the only verified sender on this account is
   support@bathroomvanitiesoutlet.com. The old default here was orders@,
   which is NOT verified — a trap for anyone who runs this without
   BREVO_FROM_EMAIL set, since every send would be rejected silently
   (sendTemplate returns {skipped:true} rather than throwing).

   ⚠️ THIS WAS NOT THE CAUSE OF THE 2026-09-27 FAILURE. BREVO_FROM_EMAIL
   has always been set to support@, and it overrides this line, so the
   bad default was never reached. It is corrected here as a latent trap,
   not as a fix.

   THE ACTUAL CAUSE, RESOLVED 2026-09-27, recorded so it is never
   re-investigated: BREVO_API_KEY held an SMTP RELAY key (xsmtpsib-…)
   rather than a REST API key (xkeysib-…). Brevo answers a valid SMTP key
   on the v3 REST API with `401 {"message":"Key not found"}` — an error
   message that reads like a deleted credential and is nothing of the
   sort. Five plausible theories were tested and discarded before
   /admin/diagnostics/email asked Brevo directly.

   The second cause, uncovered immediately behind it: Brevo's Authorised
   IPs security feature was active and the Hostinger outbound address was
   not on the list. That one at least names itself in the error body.

   BEFORE CHANGING THIS, ADD THE NEW ADDRESS AS A VERIFIED SENDER IN
   BREVO FIRST. The domain being authenticated is not enough.

   NOTE: BREVO_FROM_EMAIL overrides this. If that variable is set to an
   unverified address, editing this line changes nothing. */
const FROM_EMAIL    = process.env.BREVO_FROM_EMAIL || 'support@bathroomvanitiesoutlet.com';
const FROM_NAME     = process.env.BREVO_FROM_NAME  || 'BVO — Bathroom Vanities Outlet';

/* A from-address with no reply path is both a filter signal and a real
   discourtesy: a buyer who hits Reply on an order confirmation deserves
   to reach a human rather than a bounce. Defaults to the sender, which
   is a mailbox we actually read. */
const REPLY_TO      = process.env.BREVO_REPLY_TO   || FROM_EMAIL;

/* ── Variable substitution ────────────────────────────────────── */
function substituteVars(template, vars = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : ''
  );
}

/* ── HTML → plain text ────────────────────────────────────────────
   Every send used to be HTML-only. A message with no text/plain
   alternative is a long-standing spam signal, and on 2026-09-27 the
   first real send landed in Gmail's junk folder — which on a
   passwordless site is not cosmetic, because a sign-in code nobody
   finds is an account nobody can reach.

   DERIVED, NEVER AUTHORED. The alternative was a second body column on
   email_templates for staff to fill in, which guarantees the two drift
   apart the first time someone edits the HTML and forgets. It also
   would have meant editing all nine templates, and template edits are
   deferred to cutover. Deriving costs a little fidelity and cannot go
   stale.

   Order matters below: strip script/style bodies BEFORE stripping
   tags, or their contents survive as visible text — CSS rules in the
   plain-text part of an email look exactly like the obfuscation that
   spam filters hunt for, so getting this backwards would make the
   problem it is meant to fix worse. */
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    /* Block-level boundaries become real line breaks, so the result
       reads as prose rather than one unbroken paragraph. */
    .replace(/<\/(p|div|tr|h[1-6]|li|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    /* Entities last: decoding &lt; before tag-stripping would invent
       tags out of escaped text and delete the content after them. */
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi,  '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi,   '<')
    .replace(/&gt;/gi,   '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n').map(l => l.trim()).join('\n')
    .trim();
}

/* Brevo rejects an empty textContent, and a template that is nothing
   but an image would derive to ''. Falling back to the subject keeps
   the part present and truthful. */
function textFor(html, subject) {
  const t = htmlToText(html);
  return t || String(subject || '').trim() || 'This message requires an HTML-capable email client.';
}

/* ═══════════════════════════════════════════════════════════════════
   TRANSACTIONAL BLOCKLIST

   Brevo attaches a List-Unsubscribe header to EVERY message. On non-
   Enterprise plans this cannot be turned off, and the List-Help
   alternative that produces no clickable button is Enterprise-only. So
   Gmail shows "This message is from a mailing list — Unsubscribe" above
   a six-digit sign-in code, and one click blocklists that contact
   AGAINST THIS SENDER.

   On a passwordless site that is an account lockout. Every message
   leaves from one address, so the same click also stops their order
   confirmations and delivery appointments. Nothing in the send path
   reveals it: Brevo accepts the request and simply does not deliver.

   WHY A CACHED LIST RATHER THAN A LOOKUP

   GET /v3/smtp/blockedContacts has no by-address filter — it returns a
   paginated list. Fetching it on every sign-in would put a network round
   trip in front of the login button. The list is small for a shop this
   size and changes rarely, so it is fetched in pages and memoised
   briefly.

   AND WHY IT FAILS OPEN

   If Brevo is unreachable, the list is truncated at the page cap, or
   anything else is uncertain, isBlocked() answers FALSE. A wrong "you
   are blocked" turns a working login into a dead end with a confusing
   explanation. A missed block leaves the buyer exactly where they are
   today — no worse — and the attempt is logged either way.
   ═══════════════════════════════════════════════════════════════════ */

const BLOCKLIST_TTL_MS   = 5 * 60 * 1000;
const BLOCKLIST_PAGE      = 100;    // Brevo's per-request maximum
const BLOCKLIST_MAX_PAGES = 20;     // 2000 addresses; beyond that, partial

let _blocklistCache = { at: 0, set: null, partial: false };

/**
 * Every blocked/unsubscribed transactional contact, paged.
 * @returns {Promise<{ok:boolean, contacts?:Array, partial?:boolean, error?:*}>}
 */
async function fetchBlockedContacts() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: 'BREVO_API_KEY not set' };

  const contacts = [];
  let partial = false;

  try {
    for (let page = 0; page < BLOCKLIST_MAX_PAGES; page++) {
      const r = await axios.get('https://api.brevo.com/v3/smtp/blockedContacts', {
        params:  { limit: BLOCKLIST_PAGE, offset: page * BLOCKLIST_PAGE },
        headers: { 'api-key': apiKey, Accept: 'application/json' },
        timeout: 8000,
      });
      const batch = (r.data && r.data.contacts) || [];
      contacts.push(...batch);
      if (batch.length < BLOCKLIST_PAGE) break;
      /* Hit the cap with a full final page — there may be more. Marked
         partial so isBlocked() knows not to trust a negative answer. */
      if (page === BLOCKLIST_MAX_PAGES - 1) partial = true;
    }
    return { ok: true, contacts, partial };
  } catch (err) {
    return { ok: false, error: err.response?.data || err.message };
  }
}
exports.fetchBlockedContacts = fetchBlockedContacts;

/**
 * Is this address blocked from receiving our transactional mail?
 * FAILS OPEN — see the header above. Never throws.
 */
exports.isBlocked = async function isBlocked(email) {
  const addr = String(email || '').trim().toLowerCase();
  if (!addr) return false;

  try {
    const fresh = _blocklistCache.set && (Date.now() - _blocklistCache.at) < BLOCKLIST_TTL_MS;
    if (!fresh) {
      const r = await fetchBlockedContacts();
      /* A failed fetch does NOT poison the cache — the previous good
         list, if any, keeps serving until its TTL runs out. */
      if (!r.ok) return false;
      _blocklistCache = {
        at: Date.now(),
        set: new Set(r.contacts.map(c => String(c.email || '').toLowerCase())),
        partial: !!r.partial,
      };
    }
    return _blocklistCache.set.has(addr);
  } catch (err) {
    console.error('[brevo] isBlocked failed (failing open):', err && err.message);
    return false;
  }
};

/** Remove an address from the transactional blocklist. */
exports.unblockContact = async function unblockContact(email) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) return { ok: false, error: 'BREVO_API_KEY not set' };
  const addr = String(email || '').trim().toLowerCase();
  if (!addr) return { ok: false, error: 'No address supplied' };

  try {
    await axios.delete(
      /* URL-encoded: a '+' in an address is legal and would otherwise
         arrive at Brevo decoded as a space. */
      `https://api.brevo.com/v3/smtp/blockedContacts/${encodeURIComponent(addr)}`,
      { headers: { 'api-key': apiKey, Accept: 'application/json' }, timeout: 8000 }
    );
    _blocklistCache = { at: 0, set: null, partial: false };   // force a refetch
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      status: err.response?.status || null,
      error: err.response?.data || err.message,
    };
  }
};

/** Exposed so the diagnostics page can show a stale-free view. */
exports.clearBlocklistCache = () => { _blocklistCache = { at: 0, set: null, partial: false }; };

/* ── Fetch template from DB by trigger key ────────────────────── */
async function getTemplate(triggerKey) {
  const [rows] = await bvoPool.query(
    'SELECT * FROM email_templates WHERE trigger_key = ? AND is_active = 1 LIMIT 1',
    [triggerKey]
  );
  return rows[0] || null;
}

/* ── Main send function ───────────────────────────────────────── */
exports.sendTemplate = async (triggerKey, toEmail, vars = {}, toName = '') => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('[brevo] BREVO_API_KEY not set — email skipped:', triggerKey);
    return { skipped: true };
  }

  /* The DB read lives INSIDE the try. It used to sit above it, so a
     missing or unreachable email_templates table threw out of
     sendTemplate rather than being caught here. That is tolerable for the
     admin-triggered sends, but checkoutController now calls this after the
     card is authorized — an exception escaping at that point would turn a
     Brevo or DB hiccup into a failed order that has already been charged
     a hold. Nothing in this function may throw. */
  try {
    const tpl = await getTemplate(triggerKey);
    if (!tpl) {
      console.warn('[brevo] No active template found for trigger_key:', triggerKey);
      return { skipped: true };
    }

    const subject  = substituteVars(tpl.subject,   vars);
    const htmlBody = substituteVars(tpl.body_html, vars);

    const response = await axios.post(
      BREVO_API_URL,
      {
        sender:      { name: FROM_NAME, email: FROM_EMAIL },
        replyTo:     { name: FROM_NAME, email: REPLY_TO },
        to:          [{ email: toEmail, name: toName || toEmail }],
        subject,
        htmlContent: htmlBody,
        textContent: textFor(htmlBody, subject),
        /* Brevo segments its transactional log by tag. Without this the
           log is one undifferentiated stream, so "are login codes
           going out?" cannot be answered separately from "are order
           confirmations going out?" — which is exactly the question
           that took all of 2026-09-27 to answer. */
        tags:        [String(triggerKey)],
      },
      {
        headers: {
          'api-key':      apiKey,
          'Content-Type': 'application/json',
          'Accept':       'application/json',
        },
        timeout: 8000,
      }
    );
    console.log(`[brevo] Sent "${triggerKey}" to ${toEmail} — messageId:`, response.data?.messageId);
    return { ok: true, messageId: response.data?.messageId };
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error(`[brevo] Failed to send "${triggerKey}" to ${toEmail}:`, detail);
    return { ok: false, error: detail };
  }
};

/* ── Send a raw email (subject + htmlBody passed directly) ────── */
exports.sendRaw = async (toEmail, subject, htmlBody, toName = '') => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('[brevo] BREVO_API_KEY not set — raw email skipped');
    return { skipped: true };
  }
  try {
    const response = await axios.post(
      BREVO_API_URL,
      {
        sender:      { name: FROM_NAME, email: FROM_EMAIL },
        replyTo:     { name: FROM_NAME, email: REPLY_TO },
        to:          [{ email: toEmail, name: toName || toEmail }],
        subject,
        htmlContent: htmlBody,
        textContent: textFor(htmlBody, subject),
      },
      {
        headers: {
          'api-key':      apiKey,
          'Content-Type': 'application/json',
          'Accept':       'application/json',
        },
        timeout: 8000,
      }
    );
    return { ok: true, messageId: response.data?.messageId };
  } catch (err) {
    console.error('[brevo] sendRaw error:', err.response?.data || err.message);
    return { ok: false, error: err.response?.data || err.message };
  }
};

/* ─────────────────────────────────────────────────────────────────
   Send a raw email WITH file attachments.

   Brevo v3 takes attachments as:
     attachment: [{ content: '<base64>', name: 'file.pdf' }]
   `content` is base64 WITHOUT a data: URI prefix.

   Used for internal distribution of shipping paperwork (BOL, pallet
   label, packing list) to our own stores. This is BVO-originated mail
   and is entirely separate from WWEX — WWEX has no API to email a BOL,
   and their carrier tracking alerts are a different thing altogether.

   Recipients may be a single address or an array.

   Brevo caps total message size around 10 MB. Shipping PDFs are far
   smaller, but the guard below keeps a pathological case from producing
   an opaque API error.
─────────────────────────────────────────────────────────────────── */
const MAX_ATTACHMENT_BYTES = 9 * 1024 * 1024;   // ~9 MB, under Brevo's ceiling

exports.sendWithAttachments = async (toEmails, subject, htmlBody, attachments = []) => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn('[brevo] BREVO_API_KEY not set — attachment email skipped');
    return { ok: false, error: 'Email is not configured on this server (BREVO_API_KEY missing).' };
  }

  const list = (Array.isArray(toEmails) ? toEmails : [toEmails])
    .map(e => String(e || '').trim())
    .filter(Boolean);
  if (!list.length) return { ok: false, error: 'No recipient address supplied.' };

  const files = attachments.filter(a => a && a.content && a.name);
  if (!files.length) return { ok: false, error: 'No documents were retrieved to attach.' };

  // base64 inflates ~4/3; approximate the decoded size for the guard.
  const bytes = files.reduce((s, f) => s + Math.floor(f.content.length * 0.75), 0);
  if (bytes > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: `Attachments total ~${Math.round(bytes / 1024 / 1024)} MB, over the ~9 MB email limit. Send fewer documents.` };
  }

  try {
    const response = await axios.post(
      BREVO_API_URL,
      {
        sender:      { name: FROM_NAME, email: FROM_EMAIL },
        replyTo:     { name: FROM_NAME, email: REPLY_TO },
        to:          list.map(email => ({ email })),
        subject,
        htmlContent: htmlBody,
        textContent: textFor(htmlBody, subject),
        attachment:  files.map(f => ({ content: f.content, name: f.name })),
      },
      {
        headers: {
          'api-key':      apiKey,
          'Content-Type': 'application/json',
          'Accept':       'application/json',
        },
        timeout: 20000,   // larger payload than a plain send
      }
    );
    console.log(`[brevo] Sent ${files.length} attachment(s) to ${list.join(', ')} — messageId:`,
                response.data?.messageId);
    return { ok: true, messageId: response.data?.messageId, recipients: list };
  } catch (err) {
    const d = err.response?.data;
    const msg = (d && (d.message || d.code)) ? `${d.code || ''} ${d.message || ''}`.trim()
              : (err.message || 'Unknown error');
    console.error('[brevo] sendWithAttachments failed:', d || err.message);
    return { ok: false, error: msg };
  }
};

/* ── List all templates (for admin UI) ───────────────────────── */
exports.listTemplates = async () => {
  const [rows] = await bvoPool.query(
    'SELECT id, trigger_key, label, subject, is_active, updated_at FROM email_templates ORDER BY id ASC'
  );
  return rows;
};

/* ── Preview a template with sample vars ─────────────────────── */
exports.previewTemplate = (tpl, vars = {}) => ({
  subject:  substituteVars(tpl.subject,  vars),
  body_html: substituteVars(tpl.body_html, vars),
});
