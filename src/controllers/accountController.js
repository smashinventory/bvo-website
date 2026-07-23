'use strict';

const Customer = require('../models/Customer');

/* ── GET /account/login ─────────────────────────────────────────── */
exports.loginPage = (req, res) => {
  if (req.session.customerId) return res.redirect('/account');
  res.render('pages/account/login', {
    pageTitle: 'Sign In | BathroomVanitiesOutlet.com',
    metaDesc:  '',
    error: null,
    returnTo: req.session.returnTo || '/account',
  });
};

/* ── POST /account/login ────────────────────────────────────────── */
exports.login = async (req, res, next) => {
  try {
    const { email, password, return_to } = req.body;
    const customer = await Customer.findByEmail(email);

    if (!customer || !customer.password_hash) {
      return res.render('pages/account/login', {
        pageTitle: 'Sign In | BathroomVanitiesOutlet.com',
        metaDesc:  '',
        error: 'Invalid email or password.',
        returnTo: return_to || '/account',
      });
    }

    const valid = await Customer.verifyPassword(password, customer.password_hash);
    if (!valid) {
      return res.render('pages/account/login', {
        pageTitle: 'Sign In | BathroomVanitiesOutlet.com',
        metaDesc:  '',
        error: 'Invalid email or password.',
        returnTo: return_to || '/account',
      });
    }

    // Regenerate session ID to prevent session fixation attacks
    await new Promise((resolve, reject) =>
      req.session.regenerate(err => err ? reject(err) : resolve())
    );
    req.session.customerId = customer.id;
    req.session.customer   = { id: customer.id, firstName: customer.first_name, email: customer.email };
    await Customer.updateLastLogin(customer.id);

    res.redirect(return_to && return_to.startsWith('/') ? return_to : '/account');
  } catch (err) { next(err); }
};

/* ── GET /account/register ──────────────────────────────────────── */
exports.registerPage = (req, res) => {
  if (req.session.customerId) return res.redirect('/account');
  res.render('pages/account/register', {
    pageTitle: 'Create Account | BathroomVanitiesOutlet.com',
    metaDesc:  '',
    error: null,
    query: req.query,
  });
};

/* ── POST /account/register ─────────────────────────────────────── */
exports.register = async (req, res, next) => {
  try {
    const { email, first_name, last_name, password, password2, accepts_marketing } = req.body;

    // Guard missing / non-string fields before any .length or .toLowerCase() call
    const emailStr    = (email    || '').trim();
    const passwordStr = (password || '');
    const password2Str= (password2|| '');

    if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
      return res.render('pages/account/register', {
        pageTitle: 'Create Account | BathroomVanitiesOutlet.com',
        metaDesc:  '',
        error: 'Please enter a valid email address.',
        query: req.query,
      });
    }
    if (passwordStr !== password2Str) {
      return res.render('pages/account/register', {
        pageTitle: 'Create Account | BathroomVanitiesOutlet.com',
        metaDesc:  '',
        error: 'Passwords do not match.',
        query: req.query,
      });
    }
    if (passwordStr.length < 8) {
      return res.render('pages/account/register', {
        pageTitle: 'Create Account | BathroomVanitiesOutlet.com',
        metaDesc:  '',
        error: 'Password must be at least 8 characters.',
        query: req.query,
      });
    }

    const existing = await Customer.findByEmail(emailStr);
    if (existing) {
      return res.render('pages/account/register', {
        pageTitle: 'Create Account | BathroomVanitiesOutlet.com',
        metaDesc:  '',
        error: 'An account with that email already exists.',
      });
    }

    const id = await Customer.create({
      email: emailStr, firstName: (first_name || '').trim(), lastName: (last_name || '').trim(),
      password: passwordStr, acceptsMarketing: !!accepts_marketing,
    });

    req.session.customerId = id;
    req.session.customer   = { id, firstName: (first_name || '').trim(), email: emailStr };
    res.redirect('/account');
  } catch (err) { next(err); }
};

/* ── GET /account ── Dashboard ──────────────────────────────────── */
exports.dashboard = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.session.customerId);
    const orders   = await Customer.getOrders(req.session.customerId, 5);
    res.render('pages/account/dashboard', {
      pageTitle: 'My Account | BathroomVanitiesOutlet.com',
      metaDesc:  '',
      customer,
      orders,
    });
  } catch (err) { next(err); }
};

/* ── GET /account/orders ────────────────────────────────────────── */
exports.orders = async (req, res, next) => {
  try {
    const orders = await Customer.getOrders(req.session.customerId, 50);
    res.render('pages/account/orders', {
      pageTitle: 'My Orders | BathroomVanitiesOutlet.com',
      metaDesc:  '',
      orders,
    });
  } catch (err) { next(err); }
};

/* ── GET /account/favorites ─────────────────────────────────────── */
exports.favoritesPage = async (req, res, next) => {
  try {
    const products = await Customer.getFavoriteProducts(req.session.customerId);
    res.render('pages/account/favorites', {
      pageTitle: 'My Saved Items | BathroomVanitiesOutlet.com',
      metaDesc:  '',
      products,
    });
  } catch (err) { next(err); }
};

/* ── POST /account/favorites/toggle ─────────────────────────────── */
exports.toggleFavorite = async (req, res, next) => {
  try {
    const productId = parseInt(req.body.productId, 10);
    if (!productId) return res.status(400).json({ error: 'Invalid productId' });
    const result = await Customer.toggleFavorite(req.session.customerId, productId);
    res.json(result);
  } catch (err) { next(err); }
};

/* ── POST /account/logout ───────────────────────────────────────── */
exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/'));
};

/* ── POST /account/newsletter ───────────────────────────────────── */
// Accepts { email } JSON from the homepage newsletter form.
// Always returns { ok: true } — never reveals whether an account exists.
exports.newsletter = async (req, res) => {
  const { bvoPool } = require('../config/database');
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email.' });
    }

    // Mark existing customer as accepting marketing
    await bvoPool.query(
      'UPDATE customers SET accepts_marketing=1 WHERE email=?', [email]
    ).catch(() => {});

    // Best-effort insert into newsletter_signups (table may not exist yet)
    await bvoPool.query(
      `INSERT IGNORE INTO newsletter_signups (email, source, created_at)
       VALUES (?, 'homepage', NOW())`, [email]
    ).catch(() => {});

    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // never leak internal errors
  }
};
