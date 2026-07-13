'use strict';

/** Block non-admin users from /admin routes */
exports.requireAdmin = (req, res, next) => {
  if (req.session && req.session.isAdmin) return next();
  res.redirect('/admin/login');
};
