'use strict';

/** Redirect to login if not authenticated */
exports.requireAuth = (req, res, next) => {
  if (req.session && req.session.customerId) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/account/login');
};

/** Make customer session available in all templates */
exports.loadCustomer = (req, res, next) => {
  res.locals.customer   = req.session.customer || null;
  res.locals.isLoggedIn = !!req.session.customerId;
  next();
};
