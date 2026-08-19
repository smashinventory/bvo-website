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
const FROM_EMAIL    = process.env.BREVO_FROM_EMAIL || 'orders@bathroomvanitiesoutlet.com';
const FROM_NAME     = process.env.BREVO_FROM_NAME  || 'BVO — Bathroom Vanities Outlet';

/* ── Variable substitution ────────────────────────────────────── */
function substituteVars(template, vars = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : ''
  );
}

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

  const tpl = await getTemplate(triggerKey);
  if (!tpl) {
    console.warn('[brevo] No active template found for trigger_key:', triggerKey);
    return { skipped: true };
  }

  const subject  = substituteVars(tpl.subject,   vars);
  const htmlBody = substituteVars(tpl.body_html,  vars);

  try {
    const response = await axios.post(
      BREVO_API_URL,
      {
        sender:      { name: FROM_NAME, email: FROM_EMAIL },
        to:          [{ email: toEmail, name: toName || toEmail }],
        subject,
        htmlContent: htmlBody,
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
        to:          [{ email: toEmail, name: toName || toEmail }],
        subject,
        htmlContent: htmlBody,
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
