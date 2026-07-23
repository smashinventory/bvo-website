'use strict';

/** Block non-admin users from /admin routes */
exports.requireAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) return next();
  // For AJAX / fetch requests return 401 JSON instead of redirecting — otherwise
  // the browser follows the redirect to the login page and the caller gets HTML
  // instead of JSON, causing a "JSON parse error" in the UI.
  // Regular form POSTs do NOT set X-Requested-With, so they still redirect.
  // Multipart uploads (image upload) also never set this header, so we check both.
  const isAjax =
    req.headers['x-requested-with'] === 'XMLHttpRequest' ||
    (req.method !== 'GET' && (req.headers['content-type'] || '').includes('multipart'));
  if (isAjax) {
    return res.status(401).json({ ok: false, error: 'Session expired — please reload the page and log in again.' });
  }
  res.redirect('/admin/login');
};
