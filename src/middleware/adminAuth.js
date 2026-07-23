'use strict';

/** Block non-admin users from /admin routes */
exports.requireAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) return next();
  // For AJAX / fetch requests (uploads, previews, etc.) return 401 JSON so the
  // browser shows a useful error instead of trying to parse the login page HTML.
  const isAjax = req.method !== 'GET' && (
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    (req.headers['content-type'] || '').includes('multipart') ||
    (req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')
  );
  if (isAjax) {
    return res.status(401).json({ ok: false, error: 'Session expired — please reload the page and log in again.' });
  }
  res.redirect('/admin/login');
};
