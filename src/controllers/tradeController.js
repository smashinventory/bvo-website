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

   ⚠️ MARKETING CONSENT IS REQUIRED. THIS REVERSES SPEC §4, DELIBERATELY.
   Spec §4 said "approval must never depend on it" — for Platinum Member
   the tick IS the claim, and for trade the consideration was meant to be
   a legitimate business rather than an email permission, on the reasoning
   that conditioning the account on marketing would put off exactly the
   professionals worth having.

   Owner reversed that on 2026-10-23: a trade account IS the mailing list.
   Tier pricing, stock notices and programme changes reach trade by email
   or not at all, so an account that refuses mail is an account BVO cannot
   actually serve.

   ⚠️ HOW IT IS COLLECTED — ONE TICK, NOT TWO. Shipped first as a second
   mandatory checkbox (328b6d2), changed the same day: with both boxes
   required the second was an obstacle rather than a choice, and it sprang
   a new condition on the applicant only after they had uploaded a business
   card. So the consent is now DISCLOSED as clause 8 of the scroll-gated
   terms and CARRIED by the single terms acknowledgement, whose label names
   the email term explicitly.

   That makes two things in the view load-bearing, and neither is obvious
   from reading this file: clause 8 must stay in the terms box, and the
   acknowledgement label must keep naming email. Lose either and
   accepts_marketing becomes a silent opt-in. gate_trade_application
   section 7 asserts both; do not "tidy" that copy.

   Approval itself is still MANUAL — the consent is a precondition of
   applying, not a substitute for reviewing the business.

   ⚠️ THE SIDE EFFECT TO WATCH, SO IT IS NOT REDISCOVERED THE HARD WAY.
   Brevo attaches List-Unsubscribe to every message and it cannot be
   disabled below Enterprise. So a trade customer who unsubscribes from a
   promotion also stops receiving order confirmations and sign-in codes —
   the same hazard recorded in deviceService's header. Requiring the tick
   puts more trade accounts in front of that button. If trade accounts
   start going dark on transactional mail, this is the first place to look.
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
/* The trade application creates the customer account when there is not
   one yet — see submit(). Required at the top, not inside the handler: a
   missing require is a runtime ReferenceError, not a syntax error, and it
   would fire mid-submission. That exact mistake cost a fix earlier today. */
const Customer = require('../models/Customer');

/* The version of the terms copy. Stored on every application so an
   acceptance says WHAT was agreed, not merely that something was. Bump it
   when the copy changes. Same discipline as consent_copy_version. */
/* 2026-10-23: bumped from trade-terms-2026-10-21 because clause 8 (email
   is how the trade programme runs) was ADDED to the copy. Anyone who
   accepted -10-21 agreed to seven clauses, not eight — which is the whole
   point of storing the version rather than just a boolean. */
const TERMS_VERSION = 'trade-terms-2026-10-23';

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

/* Every status the admin queue can show. Exported so the view renders the
   tabs from one list and a gate can check the controller agrees with it. */
const QUEUE_STATUSES = ['pending', 'approved', 'declined', 'fraud', 'closed'];
exports._QUEUE_STATUSES = QUEUE_STATUSES;

/* Single-file upload for replacing a document on an existing application.
   Same storage, limits and filter as the public form — one definition of
   what an acceptable document is, so the admin path cannot accept
   something the applicant path would have rejected. */
exports.replaceDocMiddleware = _upload.fields([
  { name: 'card',   maxCount: 1 },
  { name: 'resale', maxCount: 1 },
]);

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
/* ⚠️ 'fraud' BLOCKS, 'closed' AND 'declined' DO NOT, AND THE DIFFERENCE IS
   THE WHOLE POINT OF HAVING FOUR WORDS INSTEAD OF TWO.

     declined — we said no on the evidence. Fix it and apply again.
     closed   — THEY asked us to stop. They may change their mind.
     fraud    — we believe this was an attempt to deceive us. Letting that
                account simply reapply would make the whole review
                pointless, so it stays blocked.

   Leaving 'fraud' out of this list would mean a flagged applicant could
   resubmit the same day and land back in the queue looking new. */
const BLOCKING_STATUSES = ['pending', 'approved', 'fraud'];

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
    /* ⚠️ DERIVED FROM THE TERMS TICK, NOT A FIELD OF ITS OWN.
       Clause 8 of the terms is the disclosure and the acknowledgement
       label names it, so accepting the terms IS the email consent. See the
       header note for why there is no longer a second checkbox.

       It is still STORED separately — its own column, timestamp, source and
       IP — so unsubscribing can flip it without disturbing the record of
       what terms they accepted. Derived at the point of consent, not
       conflated with it. */
    const acceptsMkt   = b.terms_ack ? 1 : 0;

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

    /* ⚠️ acceptsMkt IS DELIBERATELY NOT VALIDATED SEPARATELY.
       It is derived from terms_ack, checked on the line above, so a second
       check could never fail — and a check that cannot fail is worse than
       none, because it reads like enforcement while enforcing nothing.

       What actually holds this together lives in the VIEW: clause 8 must
       stay inside the scroll-gated terms box, and the acknowledgement label
       must keep naming the email term. Edit either away and this derivation
       silently becomes a consent the applicant never saw — the pre-ticked
       box problem, arrived at from a different direction. Both are asserted
       in gate_trade_application section 7. */

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
    /* ⚠️ THE APPLICATION CREATES THE ACCOUNT. IT MUST NOT ASSUME ONE.
       This used to store `req.session.customerId || null`. Anyone who
       found the trade page and applied — which is everyone, because
       nothing told them otherwise — produced a row with customer_id NULL.
       The tier lives on `customers`, so approval had nothing to write to:
       the admin saw "Approved", the applicant saw retail prices, and
       neither had any way to connect the two.

       Expecting a visitor to work out that they must create a separate
       account BEFORE applying, with no prompt anywhere saying so, is not
       a workflow. The form already collects the email, the business name
       and the phone — everything an account needs.

       findOrCreateByEmail is the house helper: it returns the existing
       customer when there is one (keeping their original signup_source,
       so this does not rewrite acquisition history) and creates the row
       when there is not. No password — this site signs in by emailed
       code, so an account with just an address is a complete account. */
    let customerId = req.session.customerId || null;
    let accountCreated = false;
    if (!customerId) {
      const cust = await Customer.findOrCreateByEmail(email, 'trade_application')
        .catch(err => {
          console.error('[trade] findOrCreateByEmail FAILED for', email, '-', err && err.message);
          return null;
        });
      if (cust) { customerId = cust.id; accountCreated = !!cust.created; }
    }

    /* The duplicate check now always keys on customer_id, because by this
       point there is always a customer. The email fallback remains for the
       case where account resolution failed outright — better to refuse a
       possible duplicate than to lose the guard entirely. */
    const matchedBy = customerId ? 'customer_id = ?' : 'email = ?';
    const matchVal  = customerId || email;
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
        /* The RESOLVED id, not the session's. This is the line that used
           to store NULL for every logged-out applicant. */
        customerId, email, businessName, businessType || null,
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
    /* ⚠️ customerId, NOT req.session.customerId. These two updates were
       gated on the session, so an applicant who was not signed in got
       neither trade_applied_at nor their marketing consent recorded —
       even though they had just ticked the box. The consent record is the
       evidence that they opted in; losing it for exactly the people who
       are new to the site is the worst possible subset to lose. */
    if (customerId) {
      await pool().query(
        'UPDATE customers SET trade_applied_at = COALESCE(trade_applied_at, NOW()) WHERE id = ?',
        [customerId]
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
          [ip, TERMS_VERSION, customerId]
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
        /* ⚠️ TELL THEM THE ACCOUNT EXISTS AND HOW TO REACH IT. Trade
           pricing only renders to a signed-in customer (MAP). So an
           approved applicant who never signs in sees retail forever and
           concludes the program is fake. The account was just created for
           them; the one thing they need to know is that it is there. */
        await brevo.sendRaw(email, 'We have your trade application',
          `<p>Thanks — we have your application for a BVO trade account${businessName ? ' for ' + esc(businessName) : ''}.</p>
           <p>We review these by hand, usually within one business day. There is nothing more you need to do; we will email you either way.</p>
           <p><strong>Your account is set up under this email address.</strong> There is no password — sign in at
           <a href="${esc(process.env.SITE_URL || 'https://www.bathroomvanitiesoutlet.com')}/account">bathroomvanitiesoutlet.com/account</a>
           and we email you a code. <strong>Trade pricing only shows while you are signed in</strong>, so once you are approved, sign in and the discount appears in your cart automatically.</p>
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
    /* ⚠️ 'fraud' AND 'closed' MUST BE HERE OR THEY BECOME INVISIBLE.
       The filter falls back to 'pending' for anything unrecognised, so a
       status the queue does not list is a status whose rows cannot be
       viewed at all — the same way the whole queue was unreachable until
       it got a nav link. Adding a status to the model means adding it
       here, and gate_trade_application checks that the two agree. */
    const status = QUEUE_STATUSES.includes(req.query.status)
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
      /* One list, rendered as the tabs AND used as the filter whitelist. */
      queueStatuses: QUEUE_STATUSES,
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

    /* ── VIEW IN THE BROWSER, SAFELY ──────────────────────────────────
       This was attachment-only, with good reason: a file NAMED .png that
       actually contains HTML would execute in the admin's session if the
       browser rendered it. Downloading every card and opening it locally
       is not a review workflow though, so the answer is to make inline
       viewing safe rather than to drop the concern.

       Three things make it safe, and all three are needed:

         1. CONTENT-TYPE FROM THE EXTENSION WE CONTROL. Never from
            file.mimetype — that is client-supplied and forgeable. The
            extension is what multer's filter validated and what we wrote.

         2. nosniff. With an explicit image/* type, a file full of HTML
            cannot be re-interpreted as a document. It simply fails to
            render as an image. This is the header that actually defuses
            the masquerade.

         3. CSP sandbox. Belt and braces: the response becomes an opaque
            origin with scripts disabled, so even a content-type mistake
            cannot reach the admin session. PDFs still render — the
            viewer is the browser's, not the page's.

       HEIC is forced to download regardless: no browser renders it, so
       "view" would be a blank tab. An iPhone photo of a business card is
       the most likely upload on this route, so this case is not rare. */
    const ext = path.extname(resolved).toLowerCase();
    const INLINE_TYPES = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.png': 'image/png',  '.webp': 'image/webp',
      '.pdf': 'application/pdf',
    };
    const inlineType = INLINE_TYPES[ext];
    const wantsDownload = req.query.download === '1' || !inlineType;

    if (wantsDownload) {
      res.setHeader('Content-Disposition',
        'attachment; filename="' + path.basename(resolved) + '"');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      /* ⚠️ EXPRESS DEFAULTS THIS TO "public, max-age=0" AND THAT IS WRONG
         HERE. Found by reading the response headers rather than assuming
         them. These are business cards and resale certificates — "public"
         permits a shared proxy to hold a copy. Both paths get no-store. */
      res.setHeader('Cache-Control', 'private, no-store');
      return res.sendFile(resolved);
    }

    res.setHeader('Content-Type', inlineType);
    res.setHeader('Content-Disposition',
      'inline; filename="' + path.basename(resolved) + '"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; object-src 'none'");
    /* These are personal documents behind an admin login. Nothing should
       cache them to disk on a shared machine or in a proxy. */
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(resolved);
  } catch (err) { next(err); }
};

/* ── ADMIN: REPLACE A DOCUMENT ON AN EXISTING APPLICATION ───────────
   An applicant sends a clearer photo, or a resale certificate expires and
   they send the new one. Before this, the only route was asking them to
   submit a whole new application — which the duplicate guard now (rightly)
   refuses. */
const DOC_FIELDS = Object.freeze({
  card:   { col: 'card_doc_path', nameCol: 'card_doc_name',   label: 'Business card' },
  resale: { col: 'resale_doc_path', nameCol: 'resale_doc_name', label: 'Resale certificate' },
});

/** Unlink a stored document and return whether a file was actually removed. */
function unlinkDoc(stored) {
  const p = resolveDoc(stored);
  if (!p) return false;
  try {
    if (fs.existsSync(p)) { fs.unlinkSync(p); return true; }
  } catch (err) {
    /* ⚠️ A FAILED UNLINK MUST NOT ABORT THE ACTION. The DB column is about
       to be cleared either way; if the file lingers, the row no longer
       points at it and the log says so. Throwing here would leave the row
       and the disk disagreeing, which is worse than an orphan we know
       about. */
    console.error('[trade] unlink failed for', p, '-', err && err.message);
  }
  return false;
}

exports.adminReplaceDoc = async (req, res, next) => {
  const files = req.files || {};
  try {
    const id    = req.params.id;
    const which = DOC_FIELDS[req.params.which] ? req.params.which : null;
    if (!which) { discard(files); return res.status(400).send('Unknown document type'); }
    const f = DOC_FIELDS[which];

    const incoming = (files[which] || [])[0] || null;
    if (!incoming) {
      req.session.flash = { type: 'error', msg: 'No file was selected.' };
      return res.redirect('/admin/trade?status=' + (req.body.back_status || 'pending'));
    }

    const [rows] = await pool().query(
      `SELECT ${f.col} AS old FROM trade_applications WHERE id = ? LIMIT 1`, [id]);
    if (!rows || !rows[0]) {
      discard(files);
      req.session.flash = { type: 'error', msg: 'Application not found.' };
      return res.redirect('/admin/trade');
    }

    /* ⚠️ WRITE THE ROW FIRST, THEN DELETE THE OLD FILE. The reverse order
       means a crash between the two leaves the row pointing at a file that
       is already gone. This way the worst case is one orphaned file, which
       is recoverable; a row pointing at nothing is not. */
    await pool().query(
      `UPDATE trade_applications SET ${f.col} = ?, ${f.nameCol} = ? WHERE id = ?`,
      [path.basename(incoming.path), incoming.originalname || null, id]);

    const old = rows[0].old;
    if (old && path.basename(String(old)) !== path.basename(incoming.path)) unlinkDoc(old);

    req.session.flash = { type: 'success', msg: `${f.label} replaced.` };
    res.redirect('/admin/trade?status=' + (req.body.back_status || 'pending'));
  } catch (err) { discard(files); next(err); }
};

/* ── ADMIN: FRAUD / CLOSE ───────────────────────────────────────────
   ⚠️ TWO ACTIONS, NOT ONE DELETE BUTTON, AND THE DIFFERENCE IS THE POINT.

     fraud  — we believe this was an attempt to deceive us. Trade pricing
              is revoked and the account is blocked from reapplying, but
              THE DOCUMENTS ARE KEPT. They are the evidence. Destroying
              them on our own say-so removes the only proof we had if the
              applicant disputes a charge or returns under another name.

     closed — THE CUSTOMER asked us to stop. The documents are PURGED,
              because continuing to hold someone's business card and
              resale certificate after they asked you to close the account
              is the thing they were asking you to stop doing. The
              application row and their order history remain: tax and
              transaction records are not ours to delete on request.

   Getting these backwards is expensive in both directions — no evidence
   when you need it, or personal documents retained against an explicit
   request. Hence separate verbs with separate buttons. */
const REVOKE_ACTIONS = Object.freeze({
  fraud:  { status: 'fraud',  purge: false, msg: 'Flagged as fraudulent. Trade pricing revoked; documents kept as evidence.' },
  closed: { status: 'closed', purge: true,  msg: 'Account closed at the customer\'s request. Documents deleted; order history kept.' },
});
exports._REVOKE_ACTIONS = REVOKE_ACTIONS;

exports.adminRevoke = async (req, res, next) => {
  try {
    const id  = req.params.id;
    const act = REVOKE_ACTIONS[req.body.action];
    if (!act) { return res.status(400).send('Unknown action'); }

    /* STRING, not an object. This read used to be
       `(req.session.adminUser && req.session.adminUser.email)`, which was
       the only .email-shaped read in the codebase and therefore always
       resolved to 'admin' once adminUser was finally set to a string at
       login. Corrected 2026-10-24; gate_admin_actor.js keeps all 17 reads
       one shape. */
    const who  = req.session?.adminUser || 'admin';
    const note = String(req.body.review_note || '').trim();

    const [rows] = await pool().query(
      `SELECT customer_id, card_doc_path, resale_doc_path
         FROM trade_applications WHERE id = ? LIMIT 1`, [id]);
    const app = rows && rows[0];
    if (!app) {
      req.session.flash = { type: 'error', msg: 'Application not found.' };
      return res.redirect('/admin/trade');
    }

    if (act.purge) {
      unlinkDoc(app.card_doc_path);
      unlinkDoc(app.resale_doc_path);
      /* NULLing the columns IS the record that the documents are gone.
         reviewed_at below timestamps when, and review_note says why. */
      await pool().query(
        `UPDATE trade_applications
            SET card_doc_path = NULL, card_doc_name = NULL,
                resale_doc_path = NULL, resale_doc_name = NULL
          WHERE id = ?`, [id]);
    }

    const stamped = `[${act.status} by ${who} ${new Date().toISOString().slice(0, 16).replace('T', ' ')}]`
      + (act.purge ? ' documents purged.' : ' documents retained as evidence.')
      + (note ? ' ' + note : '');

    await pool().query(
      `UPDATE trade_applications
          SET status = ?, review_note = CONCAT(COALESCE(CONCAT(review_note, '\n'), ''), ?),
              reviewed_by = ?, reviewed_at = NOW()
        WHERE id = ?`,
      [act.status, stamped, who, id]);

    /* ⚠️ ONLY DEMOTE A TRADE TIER. A Platinum MEMBER enrolment is a
       separate retail grant and is not ours to remove here — same rule
       adminDecide follows when declining. */
    if (app.customer_id) {
      await pool().query(
        `UPDATE customers SET tier = CASE WHEN tier = ? THEN ? ELSE tier END WHERE id = ?`,
        [tiers.STORED.PLATINUM_TRADE, tiers.STORED.NONE, app.customer_id]);
    }

    req.session.flash = { type: 'success', msg: act.msg };
    res.redirect('/admin/trade?status=' + act.status);
  } catch (err) { next(err); }
};

exports.adminDecide = async (req, res, next) => {
  try {
    const id = req.params.id;
    const approve = req.body.decision === 'approve';
    const note = String(req.body.review_note || '').trim() || null;
    /* STRING, not an object. This read used to be
       `(req.session.adminUser && req.session.adminUser.email)`, which was
       the only .email-shaped read in the codebase and therefore always
       resolved to 'admin' once adminUser was finally set to a string at
       login. Corrected 2026-10-24; gate_admin_actor.js keeps all 17 reads
       one shape. */
    const who  = req.session?.adminUser || 'admin';

    const [rows] = await pool().query(
      'SELECT customer_id, email FROM trade_applications WHERE id = ? LIMIT 1', [id]
    );
    const app = rows && rows[0];
    if (!app) {
      req.session.flash = { type: 'error', msg: 'Application not found.' };
      return res.redirect('/admin/trade');
    }

    /* ⚠️ LINK BY EMAIL WHEN THE APPLICATION ARRIVED UNLINKED.
       submit() stores `req.session.customerId || null`, so anyone who
       applies BEFORE signing in produces a row with customer_id NULL. The
       tier is a column on `customers`, so with nothing to point at,
       approval used to update exactly nothing — while still reporting
       "Approved — the account is now Platinum Trade."

       That is how BVO approved reno4less on 2026-10-22, saw the success
       message, and then found full price in the cart. The approval was
       real; the discount had nowhere to land.

       Matching on email is exact and case-folded the same way submit()
       stores it (trimmed, lowercased). A customer who signed up later
       with the same address is the same business — that is the whole
       point of the address being the identity on this site. */
    let customerId = app.customer_id;
    let linkedNow  = false;
    if (approve && !customerId && app.email) {
      const [cust] = await pool().query(
        'SELECT id FROM customers WHERE email = ? LIMIT 1',
        [String(app.email).trim().toLowerCase()]
      ).catch(err => {
        console.error('[trade] link-by-email lookup FAILED:', err.code, err.sqlMessage || err.message);
        return [[]];
      });
      if (cust && cust[0]) {
        customerId = cust[0].id;
        linkedNow  = true;
        await pool().query(
          'UPDATE trade_applications SET customer_id = ? WHERE id = ?', [customerId, id]);
      }
    }

    await pool().query(
      `UPDATE trade_applications
          SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = NOW()
        WHERE id = ?`,
      [approve ? 'approved' : 'declined', note, who, id]
    );

    if (approve && customerId) {
      /* ⚠️ platinum_trade ONLY. elite_trade is computed from rolling spend
         and must never be written — see src/utils/tiers.js. An admin
         cannot grant 20%; the customer earns it by spending $20,000. */
      await pool().query(
        `UPDATE customers
            SET tier = ?, trade_approved_at = COALESCE(trade_approved_at, NOW())
          WHERE id = ?`,
        [tiers.STORED.PLATINUM_TRADE, customerId]
      );
    }
    if (!approve && customerId) {
      /* Declining removes trade pricing but leaves a Platinum Member
         enrolment alone — they are separate grants. */
      await pool().query(
        `UPDATE customers SET tier = CASE WHEN tier = ? THEN ? ELSE tier END WHERE id = ?`,
        [tiers.STORED.PLATINUM_TRADE, tiers.STORED.NONE, customerId]
      );
    }

    /* ⚠️ THE MESSAGE MUST MATCH WHAT ACTUALLY HAPPENED.
       The old copy claimed the tier was set unconditionally. When there
       was no customer row it set nothing, said it had, and the first
       anyone knew was a trade account paying full price at checkout. A
       success message that cannot be false is the cheapest guard there
       is; this one just had to stop lying. */
    let msg;
    if (!approve) {
      msg = 'Declined.';
    } else if (customerId) {
      msg = linkedNow
        ? 'Approved — matched to the existing account for that email and set to Platinum Trade. They may need to sign out and back in for the cart to pick it up.'
        : 'Approved — the account is now Platinum Trade.';
    } else {
      msg = 'Approved, but NO CUSTOMER ACCOUNT exists for ' + app.email
          + ' yet, so no trade pricing has been applied. They must create an account with that exact email, then re-approve this application to grant it.';
    }

    req.session.flash = { type: approve && !customerId ? 'error' : 'success', msg };
    res.redirect('/admin/trade?status=' + (approve ? 'approved' : 'declined'));
  } catch (err) { next(err); }
};

module.exports.TERMS_VERSION = TERMS_VERSION;
module.exports.docsDir = docsDir;
module.exports.ALLOWED_EXT = ALLOWED_EXT;
module.exports.ALLOWED_MIME = ALLOWED_MIME;
