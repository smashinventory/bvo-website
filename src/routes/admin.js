'use strict';

const express       = require('express');
const rateLimit     = require('express-rate-limit');
const router        = express.Router();
const ctrl          = require('../controllers/adminController');
const pagesCtrl     = require('../controllers/pagesController');
const blogCtrl      = require('../controllers/blogController');
const menusCtrl     = require('../controllers/menusController');
const ordersCtrl    = require('../controllers/ordersController');
const returnsCtrl   = require('../controllers/returnsController');
const emailTplCtrl  = require('../controllers/emailTemplatesController');
const jmvCtrl       = require('../controllers/jmvReportsController');
const shippingCtrl  = require('../controllers/shippingController');
const { requireAdmin } = require('../middleware/adminAuth');

/* ── Strict rate limit on admin login — 10 attempts / 15 min ── */
const adminLoginLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         'Too many login attempts — please try again in 15 minutes.',
});

/* ── Auth (no middleware guard) ─────────────────────────────── */
router.get ('/login',  ctrl.loginPage);
router.post('/login',  adminLoginLimiter, ctrl.login);
router.post('/logout', ctrl.logout);

/* ── Apply requireAdmin to everything below ─────────────────── */
router.use(requireAdmin);

/* ── Dashboard ──────────────────────────────────────────────── */
router.get('/', ctrl.dashboard);

/* ── Products ───────────────────────────────────────────────── */
router.get ('/products',                                          ctrl.productList);
router.get ('/products/export.csv',                               ctrl.productExport);
router.post('/products/import',    ctrl.productImportMiddleware,    ctrl.productImport);
router.post('/products/import-jm', ctrl.productImportJMMiddleware,  ctrl.productImportJM);
router.post('/products/bulk',                                     ctrl.productBulkAction);
router.get ('/products/bulk-edit',                                ctrl.productBulkEdit);
router.post('/products/bulk-edit',                                ctrl.productBulkEditSave);
router.get ('/products/color-report',              ctrl.colorFamilyReport);
router.post('/products/color-report',              ctrl.colorFamilyApply);
router.post('/products/color-mapping/update',      ctrl.colorMappingUpdate);
router.post('/products/color-mapping/delete',      ctrl.colorMappingDelete);
router.get ('/products/new',                                      ctrl.productNew);
router.post('/products',                                          ctrl.productCreate);
router.get ('/products/:id/edit',                                 ctrl.productEdit);
router.post('/products/:id',                                      ctrl.productUpdate);
router.post('/products/:id/delete',                               ctrl.productDelete);
/* Image management */
router.post('/products/:id/images',                ctrl.productAddImageMiddleware, ctrl.productAddImage);
router.post('/products/:id/images/reorder',        ctrl.productReorderImages);
router.post('/products/:id/images/:imgId/delete',  ctrl.productDeleteImage);
router.post('/products/:id/images/:imgId/primary', ctrl.productSetPrimaryImage);
/* Document management */
router.post('/products/:id/docs',   ctrl.productAddDocumentMiddleware, ctrl.productAddDocument);
router.post('/products/:id/docs/:docId/delete',                   ctrl.productDeleteDocument);
/* Video management */
router.post('/products/:id/videos',              ctrl.productAddVideo);
router.post('/products/:id/videos/:vidId/delete', ctrl.productDeleteVideo);

/* ── Categories ─────────────────────────────────────────────── */
router.get ('/categories',                                          ctrl.categoryList);
router.get ('/categories/new',                                      ctrl.categoryNew);
router.post('/categories',                                          ctrl.categoryCreate);
router.get ('/categories/:id/edit',                                 ctrl.categoryEditPage);
router.post('/categories/:id',                                      ctrl.categoryUpdate);
router.post('/categories/:id/delete',                               ctrl.categoryDelete);
router.post('/categories/:id/image/ajax',   ctrl.categoryImageAjaxMiddleware, ctrl.categorySetImageAjax);
router.post('/categories/:id/image/remove', ctrl.categoryRemoveImage);
router.post('/categories/:id/image',      ctrl.categoryImageMiddleware,      ctrl.categorySetImage);

/* ── Model Groups ───────────────────────────────────────────── */
router.get ('/models',                                         ctrl.modelList);
router.get ('/models/new',                                     ctrl.modelNew);
router.post('/models',                                         ctrl.modelCreate);
router.get ('/models/:id/edit',                                ctrl.modelEditPage);
router.post('/models/:id',                                     ctrl.modelUpdate);
router.post('/models/:id/delete',                              ctrl.modelDelete);
router.post('/models/:id/featured',                            ctrl.modelToggleFeatured);
router.post('/models/:id/image/ajax', ctrl.modelImageAjaxMiddleware, ctrl.modelSetImageAjax);
router.post('/models/:id/image/remove',                        ctrl.modelRemoveImage);

/* ── Orders ─────────────────────────────────────────────────── */
router.get ('/orders',                              ordersCtrl.list);
router.get ('/orders/shipments',                    ordersCtrl.shipmentsView);
router.get ('/orders/reports',                      ordersCtrl.reportsView);
router.get ('/orders/:id',                          ordersCtrl.detail);
router.post('/orders/:id/status',                   ordersCtrl.updateStatus);
router.post('/orders/:id/vendor-order',             ordersCtrl.sendVendorOrder);
router.post('/orders/:id/vendor-confirm',           ordersCtrl.confirmVendorOrder);
router.post('/orders/:id/shipping/quote',           ordersCtrl.getShippingQuotes);
router.post('/orders/:id/shipping/book',            ordersCtrl.bookShipment);
router.post('/orders/:id/notes',                    ordersCtrl.addNote);
router.post('/orders/:id/documents',  ordersCtrl.documentUploadMiddleware, ordersCtrl.uploadDocument);
router.post('/orders/:id/capture',                  ordersCtrl.capturePayment);
router.post('/orders/:orderId/returns',             returnsCtrl.openReturn);

/* ── Returns ─────────────────────────────────────────────────── */
router.get ('/returns',              returnsCtrl.list);
router.post('/returns/:id/approve',  returnsCtrl.approve);
router.post('/returns/:id/deny',     returnsCtrl.deny);
router.post('/returns/:id/receive',  returnsCtrl.receive);
router.post('/returns/:id/resolve',  returnsCtrl.resolve);

/* ── Email Templates ─────────────────────────────────────────── */
router.get ('/settings/email-templates',           emailTplCtrl.list);
router.get ('/settings/email-templates/:id/edit',  emailTplCtrl.editForm);
router.post('/settings/email-templates/:id/toggle',emailTplCtrl.toggle);
router.post('/settings/email-templates/:id',       emailTplCtrl.save);

/* ── Pages (CMS) ─────────────────────────────────────────────── */
router.get ('/pages',                      pagesCtrl.adminList);
router.get ('/pages/new',                  pagesCtrl.adminNew);
router.post('/pages',                      pagesCtrl.adminCreate);
router.get ('/pages/:id/edit',             pagesCtrl.adminEdit);
router.post('/pages/:id/delete',           pagesCtrl.adminDelete);
router.post('/pages/:id/toggle',           pagesCtrl.adminToggle);
router.post('/pages/:id',                  pagesCtrl.adminUpdate);

/* ── Blog ────────────────────────────────────────────────────── */
router.get ('/blog',                       blogCtrl.adminList);
router.get ('/blog/new',                   blogCtrl.adminNew);
router.post('/blog',                       blogCtrl.adminCreate);
router.get ('/blog/:id/edit',              blogCtrl.adminEdit);
router.post('/blog/:id/delete',            blogCtrl.adminDelete);
router.post('/blog/:id/toggle',            blogCtrl.adminToggle);
router.post('/blog/:id',                   blogCtrl.adminUpdate);

/* ── Menus ───────────────────────────────────────────────────── */
router.get ('/menus',                                        menusCtrl.adminList);
router.post('/menus/:handle/items',                          menusCtrl.adminAddItem);
router.post('/menus/:handle/items/:itemId/delete',           menusCtrl.adminDeleteItem);
router.post('/menus/:handle/items/:itemId',                  menusCtrl.adminUpdateItem);
router.post('/menus/:handle/reorder',                        menusCtrl.adminReorder);

/* ── Marketing / JMV Demand Reports ─────────────────────────── */
router.get ('/marketing/jmv',                jmvCtrl.dashboard);
router.post('/marketing/jmv/run-rollup',     jmvCtrl.triggerRollup);
router.get ('/marketing/jmv/stockout',       jmvCtrl.stockoutDrilldown);
router.get ('/marketing/jmv/new-arrivals',   jmvCtrl.newArrivalsDrilldown);
router.get ('/marketing/jmv/financials',     jmvCtrl.getFinancials);

/* ── Shipping (WWEX SpeedShip) ────────────────────────────────── */
router.get ('/shipping',                  shippingCtrl.index);
router.get ('/shipping/dashboard',        shippingCtrl.dashboard);
router.get ('/shipping/track-search',     shippingCtrl.trackPage);
router.get ('/shipping/invoices',         shippingCtrl.invoices);
router.get ('/shipping/create',           shippingCtrl.createForm);
router.post('/shipping/rates',            shippingCtrl.getRates);
router.post('/shipping/book',             shippingCtrl.bookShipment);
router.post('/shipping/cancel',           shippingCtrl.cancelShipment);
router.get ('/shipping/document',         shippingCtrl.getDocument);
router.post('/shipping/email-documents',  shippingCtrl.emailDocuments);
router.post('/shipping/run-poll',         shippingCtrl.runStatusPoll);
router.get ('/shipping/track/:bol',       shippingCtrl.trackShipment);
router.post('/shipping/validate-address', shippingCtrl.validateAddress);
router.get ('/shipping/open-orders',      shippingCtrl.openOrders);

/* ── Theme Editor ───────────────────────────────────────────── */
router.get ('/theme',          ctrl.themeEditor);
router.post('/theme',          ctrl.themeSave);
router.post('/theme/preview',  ctrl.themeSavePreview);
router.post('/theme/reorder',    ctrl.themeSaveOrder);
router.post('/theme/duplicate',  ctrl.themeDuplicate);

/* ── Image / Video Upload (theme editor) ────────────────────── */
router.post('/upload',        ctrl.uploadMiddleware,      ctrl.uploadImage);
router.post('/upload/video',  ctrl.uploadVideoMiddleware, ctrl.uploadVideo);
router.get ('/upload/probe',  ctrl.uploadProbe);  // diagnostic: check upload dir

/* ══════════════════════════════════════════════════════════════════════
   RFLPOS SYNC — PARKED, NOT ABANDONED

   WHY IT IS OFF (corrected 2026-09-03)
     rflpos.com came under a malicious attack on 2026-07-28. BVO was NOT
     compromised and there was no incident on this side. Syncing was not
     live at the time — the one-way sync had been stood up and tested but
     was not in production use — so it was disconnected pre-emptively, out
     of caution, rather than in response to anything reaching BVO.

   WHY THE CODE IS STILL HERE
     Deliberate. The handlers in adminController remain because this feature
     is coming back, not because anyone forgot to delete them. Do not treat
     them as dead code.

   WHAT IT IS FOR
     BVO and RFLPOS can list the same physical item. Without a sync, the
     same unit can sell twice — once on each side — and one of those
     customers gets an apology instead of a vanity. Preventing that double
     sale is the whole point.

   WHEN IT COMES BACK — THE CONSTRAINT THAT MATTERS
     BVO PULLS. RFLPOS NEVER PUSHES.

     No inbound endpoint RFLPOS can call, no webhook, no credential held on
     the RFLPOS side that reaches BVO. BVO initiates on a schedule, fetches,
     validates against an expected schema and sane bounds, then writes.

     That keeps the blast radius one-way no matter what happens over there:
     a compromised RFLPOS can serve bad DATA — which validation catches —
     but has no path to execute anything here. It holds even if the sync
     later becomes bidirectional at the business level; "BVO writes to
     RFLPOS" is still BVO initiating an outbound call, not RFLPOS reaching in.

     The original design was already one-way, so re-enabling should mean
     confirming that property rather than rebuilding for it.

   The route registrations below stay commented until that review is done.
   ══════════════════════════════════════════════════════════════════════ */
// router.get ('/sync/probe',        ctrl.syncProbe);
// router.get ('/sync',              ctrl.syncPage);
// router.post('/sync/run',          ctrl.syncRun);
// router.post('/sync/approve/:id',  ctrl.syncApprove);
// router.post('/sync/skip/:id',     ctrl.syncSkip);
// router.post('/sync/approve-all',  ctrl.syncApproveAll);
// router.post('/sync/settings',     ctrl.syncSaveSettings);
router.all('/sync*', (req, res) => res.status(503).render('pages/error', {
  pageTitle: 'Sync Unavailable',
  message:   'RFLPOS sync is temporarily disabled.',
}));

module.exports = router;
