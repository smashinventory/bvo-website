'use strict';

const express       = require('express');
const router        = express.Router();
const ctrl          = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/adminAuth');

/* ── Auth (no middleware guard) ─────────────────────────────── */
router.get ('/login',  ctrl.loginPage);
router.post('/login',  ctrl.login);
router.post('/logout', ctrl.logout);

/* ── Apply requireAdmin to everything below ─────────────────── */
router.use(requireAdmin);

/* ── Dashboard ──────────────────────────────────────────────── */
router.get('/', ctrl.dashboard);

/* ── Products ───────────────────────────────────────────────── */
router.get ('/products',          ctrl.productList);
router.get ('/products/new',      ctrl.productNew);
router.post('/products',          ctrl.productCreate);
router.get ('/products/:id/edit', ctrl.productEdit);
router.post('/products/:id',      ctrl.productUpdate);
router.post('/products/:id/delete', ctrl.productDelete);

/* ── Orders ─────────────────────────────────────────────────── */
router.get ('/orders',            ctrl.orderList);
router.post('/orders/:id/status', ctrl.orderUpdateStatus);

/* ── Theme Editor ───────────────────────────────────────────── */
router.get ('/theme',          ctrl.themeEditor);
router.post('/theme',          ctrl.themeSave);
router.post('/theme/preview',  ctrl.themeSavePreview);
router.post('/theme/reorder',  ctrl.themeSaveOrder);

/* ── Image Upload ───────────────────────────────────────────── */
router.post('/upload', ctrl.uploadMiddleware, ctrl.uploadImage);

/* ── RFLPOS Sync ─────────────────────────────────────────────── */
router.get ('/sync/probe',        ctrl.syncProbe);
router.get ('/sync',              ctrl.syncPage);
router.post('/sync/run',          ctrl.syncRun);
router.post('/sync/approve/:id',  ctrl.syncApprove);
router.post('/sync/skip/:id',     ctrl.syncSkip);
router.post('/sync/approve-all',  ctrl.syncApproveAll);
router.post('/sync/settings',     ctrl.syncSaveSettings);

module.exports = router;
