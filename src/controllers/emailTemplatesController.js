'use strict';

/**
 * emailTemplatesController.js
 * Admin CRUD for email_templates — view, edit, preview, save.
 *
 * Admin routes:
 *   GET  /admin/settings/email-templates             — list all templates
 *   GET  /admin/settings/email-templates/:id/edit   — edit form
 *   POST /admin/settings/email-templates/:id        — save subject + body
 *   POST /admin/settings/email-templates/:id/toggle — toggle is_active
 */

const { bvoPool } = require('../config/database');
const brevo       = require('../services/brevoService');

/* ── Sample vars for live preview ─────────────────────────────── */
const PREVIEW_VARS = {
  customer_first_name: 'Jane',
  product_name:        'Amberly 60" Double Vanity in White',
  order_number:        'BVO-20260001',
  estimated_ship_window: '7–10 business days',
  transit_days:        '5–7',
  tracking_url:        'https://wwex.com/track/1Z999AA10123456784',
  carrier:             'Estes Express (via WWEX)',
  estimated_delivery:  'August 26, 2026',
  google_review_url:   'https://g.page/r/YOUR_PLACE_ID/review',
  cross_sell_url:      '/collections/mirrors',
  ra_number:           'RA-ABC123XYZ',
  resolution_type:     'Full Refund',
  refund_timeline:     '5–7',
  resolution_detail:   'Full Refund of $1,249.00',
  refund_amount:       '1249.00',
};

/* ═══════════════════════════════════════════════════════════════
   LIST
   ═══════════════════════════════════════════════════════════════ */
exports.list = async (req, res) => {
  try {
    const templates = await brevo.listTemplates();
    res.render('pages/admin/settings/email-templates', {
      activePage: 'email-templates',
      pageTitle:  'Email Templates',
      templates,
      flash:      req.query.saved ? 'Template saved.' : null,
    });
  } catch (err) {
    console.error('[emailTemplatesController.list]', err);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: 'Could not load templates.' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   EDIT FORM
   ═══════════════════════════════════════════════════════════════ */
exports.editForm = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [[tpl]] = await bvoPool.query('SELECT * FROM email_templates WHERE id = ?', [id]);
    if (!tpl) return res.status(404).render('pages/error', { pageTitle: '404', message: 'Template not found.' });

    const preview = brevo.previewTemplate(tpl, PREVIEW_VARS);

    res.render('pages/admin/settings/email-template-edit', {
      activePage:   'email-templates',
      pageTitle:    `Edit: ${tpl.label}`,
      tpl,
      preview,
      previewVars:  PREVIEW_VARS,
    });
  } catch (err) {
    console.error('[emailTemplatesController.editForm]', err);
    res.status(500).render('pages/error', { pageTitle: 'Error', message: 'Could not load template.' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   SAVE
   ═══════════════════════════════════════════════════════════════ */
exports.save = async (req, res) => {
  try {
    const id      = parseInt(req.params.id);
    const subject = (req.body.subject || '').trim();
    const body    = (req.body.body_html || '').trim();

    if (!subject || !body) return res.status(400).json({ ok: false, error: 'Subject and body are required.' });

    await bvoPool.query(
      'UPDATE email_templates SET subject = ?, body_html = ? WHERE id = ?',
      [subject, body, id]
    );

    // JSON vs redirect depending on caller
    if (req.headers['x-requested-with'] === 'XMLHttpRequest' || req.headers.accept?.includes('application/json')) {
      return res.json({ ok: true });
    }
    return res.redirect('/admin/settings/email-templates?saved=1');
  } catch (err) {
    console.error('[emailTemplatesController.save]', err);
    return res.status(500).json({ ok: false, error: 'Save failed.' });
  }
};

/* ═══════════════════════════════════════════════════════════════
   TOGGLE ACTIVE
   ═══════════════════════════════════════════════════════════════ */
exports.toggle = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await bvoPool.query(
      'UPDATE email_templates SET is_active = 1 - is_active WHERE id = ?', [id]
    );
    const [[tpl]] = await bvoPool.query('SELECT is_active FROM email_templates WHERE id = ?', [id]);
    return res.json({ ok: true, is_active: tpl?.is_active });
  } catch (err) {
    console.error('[emailTemplatesController.toggle]', err);
    return res.status(500).json({ ok: false, error: 'Toggle failed.' });
  }
};
