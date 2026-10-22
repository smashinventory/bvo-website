/* ═══════════════════════════════════════════════════════════════════════════
   tradeController.js — the Platinum Trade application.

   TRADE_PROGRAM_SPEC.md §3 and §4 are the artifact of record. The sequence
   the owner fixed on 2026-10-21 is:

       business card upload -> scroll the trade terms -> acknowledge
       -> account created / application submitted

   ⚠️ DOCUMENTS DO NOT GO IN public/. NOT A PREFERENCE.
   Spec: "business licences can carry personal data, and sole proprietors
   sometimes use an SSN as the tax ID... Do NOT store them in a publicly
   reachable uploads directory." A business card is lower risk than a
   licence, but a resale certificate carries the tax ID, and the same
   directory holds both. Anything under public/ is served by express.static
   to anyone who guesses the filename — no auth, no log, no expiry.

   ⚠️ APPROVAL IS MANUAL AND NEVER DEPENDS ON MARKETING CONSENT.
   Spec §4: for Platinum Member the tick IS the claim; for trade the
   consideration is a legitimate business, not an email permission.
   Conditioning a trade account on accepting marketing would put off
   exactly the professionals worth having.
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const multer = require('multer');

function pool() { return require('../config/database').bvoPool; }

const tiers = require('../utils/tiers');
/* ⚠️ REQUIRED AT THE TOP, NOT INSIDE THE HANDLER. node --check passes on a
   missing require — it is a ReferenceError at RUNTIME, and the notify code
   runs AFTER the application row is committed. The applicant would have
   seen a 500 on a submission that actually succeeded, and applied again. */
const brevo = require('../services/brevoService');

/* The version of the terms copy. Stored on every application so an
   acceptance says WHAT was agreed, not merely that something was. Bump it
   when the copy changes. Same discipline as consent_copy_version. */
const TERMS_VERSION = 'trade-terms-2026-10-21';

/* ⚠️ OUTSIDE public/, AND THE DEFAULT MATTERS MORE THAN THE ENV VAR.
   If TRADE_DOCS_PATH is unset the fallback must STILL be private — a
   default under public/ would mean one missing environment variable
   silently publishes every uploaded document. storage/ is not served by
   any express.static mount. */
/* ⚠️ THE DEFAULT IS INSIDE THE DEPLOY DIRECTORY, AND THAT DIRECTORY MOVES.
   Hostinger deploys this app into a UUID-named folder:

     /home/.../bathroomvanitiesoutlet.com/<uuid>/nodejs/storage/trade-docs/

   The UUID changes with the deploy. So anything written here is orphaned
   by the next push — the files are stranded in an abandoned release folder
   that nothing points at, and nothing cleans up. For business cards and
   resale certificates, which can carry an SSN, "scattered copies across
   old deploy folders" is a retention problem, not just a broken link.

   SET TRADE_DOCS_PATH IN THE HOSTINGER ENV PANEL to a directory OUTSIDE
   the deploy folder, e.g.

     /home/u222311468/domains/bathroomvanitiesoutlet.com/trade-docs

   It must not sit under public_html — these documents are deliberately not
   reachable over HTTP; they are served only through the authenticated
   /admin/trade/:id/doc/:which route.

   Until that variable is set this falls back to the deploy-local path and
   uploads will not survive a deploy. docsPathWarning() below surfaces that
   rather than letting it be discovered by a missing document. */
function docsDir() {
  const dir = process.env.TRADE_DOCS_PATH
    || path.join(__dirname, '../../storage/trade-docs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
  return dir;
}

/** True when uploads are going somewhere a deploy will orphan. */
function docsPathIsEphemeral() {
  return !process.env.TRADE_DOCS_PATH;
}
exports._docsPathIsEphemeral = docsPathIsEphemeral;

/**
 * Resolve a stored document reference to a path on disk.
 *
 * ⚠️ ACCEPTS BOTH SHAPES ON PURPOSE. Rows written before 2026-10-22 hold
 * an ABSOLUTE path into whichever deploy folder was live at upload time.
 * Those paths can never resolve again, so taking the basename turns a
 * misleading "Refused" (which reads like a permissions bug) into an honest
 * "File missing" — the file genuinely is not there. New rows store the
 * bare filename and resolve correctly for as long as docsDir() is stable.
 */
function resolveDoc(stored) {
  if (!stored) return null;
  return path.join(docsDir(), path.basename(String(stored)));
}
exports._resolveDoc = resolveDoc;

/* Images and PDFs only. A business card is a photo or a scan; anything
   else is either a mistake or an attempt. */
const ALLOWED_EXT  = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.pdf']);
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf',
]);

const _storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, docsDir()),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    /* ⚠️ RANDOM, NOT THE ORIGINAL NAME. Two reasons: the uploaded name can
       carry a path traversal or a second extension, and a predictable name
       would make these documents guessable even behind the admin route. */
    cb(null, `trade-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const _upload = multer({
  storage: _storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    /* BOTH extension and mimetype. The mimetype is client-supplied and can
       be forged; the extension is what the filesystem and any later viewer
       act on. Requiring both means a forged header alone is not enough. */
    if (ALLOWED_EXT.has(ext) && ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPG, PNG, WEBP, HEIC or PDF files are accepted.'));
  },
});

exports.uploadMiddleware = _upload.fields([
  { name: 'card_doc',   maxCount: 1 },
  { name: 'resale_doc', maxCount: 1 },
]);

/* ── GET /trade/apply ──────────────────────────────────────────── */
exports.applyPage = async (req, res, next) => {
  try {
    let existing = null;
    if (req.session.customerId) {
      const [rows] = await pool().query(
        `SELECT id, status, created_at, reviewed_at
           FROM trade_applications
          WHERE customer_id = ?
          ORDER BY id DESC LIMIT 1`,
        [req.session.customerId]
      ).catch(() => [[]]);
      existing = (rows && rows[0]) || null;
    }
    res.render('pages/trade-apply', {
      pageTitle: 'Trade Account Application | BathroomVanitiesOutlet.com',
      metaDesc:  'Apply for a BVO trade account: free freight on most orders, plus trade pricing.',
      /* noindex: this is a form behind a decision, not a landing page, and
         an indexed application form attracts bot submissions. */
      noindex:   true,
      existing,
      termsVersion: TERMS_VERSION,
      flash: req.session.flash || null,
      old:   req.session.tradeOld || {},
    });
    delete req.session.flash;
    delete req.session.tradeOld;
  } catch (err) { next(err); }
};

/** Remove a file that was accepted by multer before validation rejected the
 *  submission. Without this, a failed application still leaves personal
 *  documents on disk with no row pointing at them and no retention clock. */
function discard(files) {
  if (!files) return;
  for (const key of Object.keys(files)) {
    for (const f of files[key] || []) {
      fs.unlink(f.path, () => {});
    }
  }
}

/* States that mean "there is already an application in play". A DECLINED
   application is deliberately absent — a business that fixes whatever got
   it declined must be able to apply again. */
const BLOCKING_STATUSES = ['pending', 'approved'];

/**
 * Is there already a live application for this person?
 * Pure apart from the query it is handed — the caller executes, so a gate
 * can test the rule without a database. Rule 14.
 */
function _blockingApplication(rows) {
  const row = (rows && rows[0]) || null;
  return (row && BLOCKING_STATUSES.includes(row.status)) ? row : null;
}
exports._blockingApplication = _blockingApplication;
exports._BLOCKING_STATUSES   = BLOCKING_STATUSES;

/* ── POST /trade/apply ─────────────────────────────────────────── */
exports.submit = async (req, res, next) => {
  const files = req.files || {};
  try {
    const b = req.body || {};
    const email        = String(b.email || '').trim().toLowerCase();
    const businessName = String(b.business_name || '').trim();
    const businessType = String(b.business_type || '').trim();
    const phone        = String(b.phone || '').trim();
    const intendedUse  = String(b.intended_use || '').trim();
    const wantsTaxEx   = b.wants_tax_exempt ? 1 : 0;
    const taxId        = String(b.tax_id || '').trim();
    /* Optional on this path, and approval must never depend on it. */
    const acceptsMkt   = b.accepts_marketing ? 1 : 0;

    const errors = [];
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('A valid email address is required.');
    if (!businessName) errors.push('Business name is required.');

    const cardFile = (files.card_doc || [])[0] || null;
    if (!cardFile) errors.push('A business card is required — it is what qualifies the account.');

    /* ⚠️ SCROLL-GATED ACKNOWLEDGEMENT, CHECKED SERVER-SIDE.
       Owner: "terms and agreements they must scroll through/read then
       click an acknowledgement after biz card upload but before account
       is set up." The scroll gate is enforced in the browser; this is the
       check that matters, because the browser one can be bypassed with
       devtools in about four seconds. */
    if (!b.terms_ack) errors.push('You must read and accept the trade terms.');

    if (wantsTaxEx && !taxId) {
      errors.push('A tax ID is required to claim sales-tax exemption. Leave the box unticked if you do not need it.');
    }

    if (errors.length) {
      discard(files);
      req.session.flash = { type: 'error', msg: errors.join(' ') };
      /* The file inputs cannot be repopulated by the browser, so the rest
         of the form is carried back rather than making them retype it. */
      req.session.tradeOld = {
        email, business_name: businessName, business_type: businessType,
        phone, intended_use: intendedUse,
        wants_tax_exempt: wantsTaxEx, tax_id: taxId,
        accepts_marketing: acceptsMkt,
      };
      return res.redirect('/trade/apply');
    }

    /* ⚠️ DUPLICATE GUARD — SERVER-SIDE, AFTER VALIDATION, BEFORE THE INSERT.
       The page hides the form when an application is pending, but the form
       being hidden is not a guard: a double-click, a back-button resubmit
       or a direct POST all reach here. Without this, every resubmit writes
       another row AND stores ANOTHER COPY OF THE DOCUMENTS.

       The duplicate row is a nuisance. The duplicate documents are not —
       business cards and resale certificates can carry an SSN, which is
       why they live outside the web root, and holding extra copies works
       directly against the retention promise in the trade terms. discard()
       removes the files this attempt uploaded. */
    const matchedBy = req.session.customerId ? 'customer_id = ?' : 'email = ?';
    const matchVal  = req.session.customerId || email;
    const [dupRows] = await pool().query(
      `SELECT id, status FROM trade_applications
        WHERE ${matchedBy} ORDER BY id DESC LIMIT 1`,
      [matchVal]
    ).catch(() => [[]]);

    const blocking = _blockingApplication(dupRows);
    if (blocking) {
      discard(files);
      req.session.flash = {
        type: blocking.status === 'approved' ? 'success' : 'info',
        msg: blocking.status === 'approved'
          ? 'Your trade account is already approved — no need to apply again.'
          : 'You already have an application with us and it is still being reviewed. There is nothing more you need to do.',
      };
      return res.redirect('/trade/apply');
    }

    const resaleFile = (files.resale_doc || [])[0] || null;
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
            || req.socket.remoteAddress || null;

    await pool().query(
      `INSERT INTO trade_applications
         (customer_id, email, business_name, business_type, phone, intended_use,
          card_doc_path, card_doc_name,
          wants_tax_exempt, tax_id, resale_doc_path, resale_doc_name,
          terms_version, terms_accepted_at, terms_ip,
          accepts_marketing, status)
       VALUES (?,?,?,?,?,?, ?,?, ?,?,?,?, ?,NOW(),?, ?, 'pending')`,
      [
        req.session.customerId || null, email, businessName, businessType || null,
        phone || null, intendedUse || null,
        /* The PATH is stored, never a URL. There is no URL — the file is
           not reachable over HTTP by design. */
        /* ⚠️ THE FILENAME, NOT multer's ABSOLUTE PATH. Storing the absolute
           path bound every row to the deploy folder that happened to be
           live at upload time; one push later the path pointed at a
           directory that no longer existed and adminDoc answered
           "Refused". The filename plus docsDir() at read time is portable
           across deploys. See resolveDoc(). */
        path.basename(cardFile.path), cardFile.originalname || null,
        wantsTaxEx, taxId || null,
        resaleFile ? path.basename(resaleFile.path) : null,
        resaleFile ? (resaleFile.originalname || null) : null,
        TERMS_VERSION, ip,
        acceptsMkt,
      ]
    );

    /* ⚠️ applied_at, NOT tier. Applying is not approval — spec: "Pending
       accounts see retail pricing until approved." Writing the tier here
       would hand out 15% on submission to anyone with a photo. */
    if (req.session.customerId) {
      await pool().query(
        'UPDATE customers SET trade_applied_at = COALESCE(trade_applied_at, NOW()) WHERE id = ?',
        [req.session.customerId]
      ).catch(err => console.error('[trade] applied_at FAILED:', err.message));

      if (acceptsMkt) {
        await pool().query(
          `UPDATE customers
              SET accepts_marketing        = 1,
                  marketing_consent_at     = COALESCE(marketing_consent_at, NOW()),
                  marketing_consent_source = COALESCE(marketing_consent_source, 'trade_application'),
                  marketing_consent_ip     = COALESCE(marketing_consent_ip, ?),
                  consent_copy_version     = COALESCE(consent_copy_version, ?)
            WHERE id = ?`,
          [ip, TERMS_VERSION, req.session.customerId]
        ).catch(err => console.error('[trade] marketing consent FAILED:', err.message));
      }
    }

    /* ── TELL SOMEBODY ────────────────────────────────────────────────
       ⚠️ UNTIL 2026-10-22 THIS SENT NOTHING AT ALL. An application landed
       in trade_applications and that was it — no mail to support@, none to
       the applicant. The page promised "we usually come back within one
       business day" while the only way to learn an application existed was
       to open /admin/trade and look. The owner routes support@ to their
       phone precisely so nothing is missed, and this route walked straight
       past it.

       ⚠️ NEITHER SEND MAY BLOCK OR BREAK THE SUBMISSION. The application is
       already committed. If Brevo is down, the applicant must still get
       their confirmation page — a 500 here would tell them it failed when
       it did not, and they would apply again. Hence await + catch on each,
       and failures are logged loudly rather than thrown. */
    const adminTo = process.env.TRADE_NOTIFY_EMAIL
                 || process.env.BREVO_FROM_EMAIL
                 || 'support@bathroomvanitiesoutlet.com';
    const esc = s => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    try {
      const rows = [
        ['Business',  businessName],
        ['Type',      businessType || '—'],
        ['Email',     email],
        ['Phone',     phone || '—'],
        ['Intended use', intendedUse || '—'],
        ['Tax exemption requested', wantsTaxEx ? `Yes — tax ID ${esc(taxId)}` : 'No'],
        ['Resale certificate', resaleFile ? 'Attached' : 'Not supplied'],
        ['Marketing opt-in', acceptsMkt ? 'Yes' : 'No'],
      ].map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0"><strong>${esc(k)}</strong></td><td>${esc(v)}</td></tr>`).join('');

      /* ⚠️ THE DOCUMENTS ARE NOT ATTACHED, DELIBERATELY. They can contain
         an SSN. They stay outside the web root and are viewed through the
         authenticated admin route; emailing them would copy that data into
         a mailbox with a different retention and access story. */
      await brevo.sendRaw(adminTo,
        `New trade application — ${businessName}`,
        `<p>A trade application has been submitted and is waiting for review.</p>
         <table style="border-collapse:collapse;font-family:system-ui,sans-serif">${rows}</table>
         <p style="margin-top:16px"><a href="${(process.env.SITE_URL || 'https://www.bathroomvanitiesoutlet.com')}/admin/trade?status=pending">Review it in the admin</a></p>
         <p style="color:#6E7682;font-size:13px">Uploaded documents are not attached — open the application in the admin to view them.</p>`);
    } catch (err) {
      console.error('[trade] ADMIN NOTIFY FAILED — application', email,
        'is in the queue but nobody was told:', err && err.message);
    }

    /* The applicant's own copy. Templated so the wording is editable in the
       admin, with a raw fallback — sendTemplate returns {skipped} rather
       than throwing when the template row is missing, and a silent nothing
       is exactly how this route behaved before today. Same idiom as
       accountController.sendCode. */
    try {
      let sent = await brevo.sendTemplate('trade_application_received', email, {
        business_name: businessName,
      }, businessName);
      if (!sent || sent.skipped) {
        await brevo.sendRaw(email, 'We have your trade application',
          `<p>Thanks — we have your application for a BVO trade account${businessName ? ' for ' + esc(businessName) : ''}.</p>
           <p>We review these by hand, usually within one business day. There is nothing more you need to do; we will email you either way.</p>
           <p>Questions in the meantime: <a href="mailto:support@bathroomvanitiesoutlet.com">support@bathroomvanitiesoutlet.com</a>.</p>`,
          businessName);
      }
    } catch (err) {
      console.error('[trade] applicant ack failed for', email, '-', err && err.message);
    }

    req.session.flash = {
      type: 'success',
      msg: 'Application received. We review these by hand and usually come back within one business day. A confirmation is on its way to your email.',
    };
    res.redirect('/trade/apply');
  } catch (err) {
    discard(files);
    next(err);
  }
};

/* ── ADMIN ─────────────────────────────────────────────────────── */
const LAYOUT = { layout: 'layouts/admin' };

exports.adminQueue = async (req, res, next) => {
  try {
    const status = ['pending', 'approved', 'declined'].includes(req.query.status)
      ? req.query.status : 'pending';
    const [rows] = await pool().query(
      `SELECT ta.*, c.email AS customer_email
         FROM trade_applications ta
         LEFT JOIN customers c ON c.id = ta.customer_id
        WHERE ta.status = ?
        ORDER BY ta.created_at ASC`,
      [status]
    ).catch(err => {
      console.error('[trade] adminQueue FAILED:', err.code, err.sqlMessage || err.message);
      return [[]];
    });
    res.render('pages/admin/trade-applications', {
      ...LAYOUT,
      pageTitle: 'Trade Applications | BVO Admin',
      activePage: 'trade',
      applications: rows || [],
      status,
      /* ⚠️ A STANDING WARNING, NOT A ONE-OFF. While TRADE_DOCS_PATH is
         unset, every document uploaded is written inside the Hostinger
         deploy folder and is orphaned by the next push. That is invisible
         until somebody opens an application and finds the card gone —
         which is exactly how it was found on 2026-10-22. Surfacing it on
         the queue means it is noticed before an applicant is affected. */
      docsEphemeral: docsPathIsEphemeral(),
      flash: req.session.flash || null,
    });
    delete req.session.flash;
  } catch (err) { next(err); }
};

/* ── GET /admin/trade/:id/doc/:which ───────────────────────────────
   The ONLY way these files are readable. Behind admin auth, streamed from
   outside the web root, never linked publicly. */
exports.adminDoc = async (req, res, next) => {
  try {
    const which = req.params.which === 'resale' ? 'resale_doc_path' : 'card_doc_path';
    const [rows] = await pool().query(
      `SELECT ${which} AS p FROM trade_applications WHERE id = ? LIMIT 1`,
      [req.params.id]
    );
    const p = rows && rows[0] && rows[0].p;
    if (!p) return res.status(404).send('Not found');

    /* ⚠️ CONFINE TO THE DOCS DIRECTORY. resolveDoc already reduces the
       stored value to a basename, so traversal is removed before we get
       here — but the check stays, because the confinement must hold even
       if resolveDoc is ever changed to pass paths through. Defence that
       depends on another function staying correct is not defence. */
    const resolved = path.resolve(resolveDoc(p));
    if (!resolved.startsWith(path.resolve(docsDir()))) {
      console.error('[trade] adminDoc refused a path outside the docs dir:',
        resolved, '| docsDir:', docsDir());
      return res.status(403).send('Refused');
    }

    if (!fs.existsSync(resolved)) {
      /* ⚠️ SAY WHICH FAILURE THIS IS. "File missing" on its own sent us
         hunting a permissions bug when the real cause was that the deploy
         folder had rotated and taken the file with it. A row written
         before 2026-10-22 holds an absolute path into a dead release, and
         the upload is genuinely gone — the applicant has to send it again.
         An ephemeral docsDir means it will happen to the next one too. */
      const looksLegacy = String(p).includes('/');
      console.error('[trade] adminDoc file missing for application', req.params.id,
        '| stored:', p,
        '| looked in:', resolved,
        looksLegacy
          ? '| LEGACY ABSOLUTE PATH — uploaded into a deploy folder that no longer exists; this document is unrecoverable and must be re-requested.'
          : '',
        docsPathIsEphemeral()
          ? '| TRADE_DOCS_PATH IS NOT SET — uploads are being written inside the deploy folder and will be lost on the next push.'
          : '');
      return res.status(404).send(looksLegacy
        ? 'This document was stored before the upload path was made deploy-safe and is no longer on disk. Ask the applicant to re-send it.'
        : 'File missing');
    }

    /* Never inline: an HTML or SVG masquerading as an upload would execute
       in the admin's session if the browser rendered it. */
    res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(resolved) + '"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(resolved);
  } catch (err) { next(err); }
};

exports.adminDecide = async (req, res, next) => {
  try {
    const id = req.params.id;
    const approve = req.body.decision === 'approve';
    const note = String(req.body.review_note || '').trim() || null;
    const who  = (req.session.adminUser && req.session.adminUser.email) || 'admin';

    const [rows] = await pool().query(
      'SELECT customer_id FROM trade_applications WHERE id = ? LIMIT 1', [id]
    );
    const app = rows && rows[0];
    if (!app) {
      req.session.flash = { type: 'error', msg: 'Application not found.' };
      return res.redirect('/admin/trade');
    }

    await pool().query(
      `UPDATE trade_applications
          SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW()
        WHERE id = ?`,
      [approve ? 'approved' : 'declined', note, who, id]
    );

    if (approve && app.customer_id) {
      /* ⚠️ platinum_trade ONLY. elite_trade is computed from rolling spend
         and must never be written — see src/utils/tiers.js. An admin
         cannot grant 20%; the customer earns it by spending $20,000. */
      await pool().query(
        `UPDATE customers
            SET tier = ?, trade_approved_at = COALESCE(trade_approved_at, NOW())
          WHERE id = ?`,
        [tiers.STORED.PLATINUM_TRADE, app.customer_id]
      );
    }
    if (!approve && app.customer_id) {
      /* Declining removes trade pricing but leaves a Platinum Member
         enrolment alone — they are separate grants. */
      await pool().query(
        `UPDATE customers SET tier = CASE WHEN tier = ? THEN ? ELSE tier END WHERE id = ?`,
        [tiers.STORED.PLATINUM_TRADE, tiers.STORED.NONE, app.customer_id]
      );
    }

    req.session.flash = {
      type: 'success',
      msg: approve ? 'Approved — the account is now Platinum Trade.' : 'Declined.',
    };
    res.redirect('/admin/trade');
  } catch (err) { next(err); }
};

module.exports.TERMS_VERSION = TERMS_VERSION;
module.exports.docsDir = docsDir;
module.exports.ALLOWED_EXT = ALLOWED_EXT;
module.exports.ALLOWED_MIME = ALLOWED_MIME;
