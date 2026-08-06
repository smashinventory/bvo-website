'use strict';

require('dotenv').config();

// ── Critical startup guards ──────────────────────────────────────
// Fail fast with a clear message rather than silently using insecure defaults.
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.error('FATAL: SESSION_SECRET must be set to at least 32 characters in .env');
  process.exit(1);
}
if (!process.env.ADMIN_USER || !process.env.ADMIN_PW_B64) {
  // Warn but don't crash — admin login will safely return false if hash is missing.
  console.warn('[WARN] ADMIN_USER or ADMIN_PW_B64 not set — admin login will be disabled');
}

const express        = require('express');
const expressLayouts = require('express-ejs-layouts');
const session        = require('express-session');
const MySQLStore     = require('express-mysql-session')(session);
const { bvoPool }   = require('./config/database');
const helmet         = require('helmet');
const compression    = require('compression');
const morgan         = require('morgan');
const rateLimit      = require('express-rate-limit');
const path           = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy (Hostinger, nginx) so secure cookies work over HTTPS
app.set('trust proxy', 1);

// ── Ensure upload directory exists ───────────────────────────────
// UPLOADS_IMG_PATH env var points to a persistent directory outside the git
// repo on production (Hostinger), so uploaded images survive git deployments.
// Falls back to public/images/uploads for local dev.
const fs = require('fs');
const uploadDir = process.env.UPLOADS_IMG_PATH
  || path.join(__dirname, '..', 'public', 'images', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── CSP nonce — generated per request, must run before helmet ────
// res.locals.cspNonce is available in all EJS templates as <%= cspNonce %>
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// ── Security / performance middleware ────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // YouTube iframes don't send CORP headers; COEP: require-corp blocks them
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, // sends origin to YouTube so it knows the embedding domain
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      [
                         // Nonce: CSP3 browsers allow only nonce-bearing scripts +
                         // scripts they spawn (strict-dynamic). 'unsafe-inline' and
                         // 'https:' are ignored by CSP3 but serve as CSP2 fallback.
                         (req, res) => `'nonce-${res.locals.cspNonce}'`,
                         "'strict-dynamic'",
                         "'unsafe-inline'",
                         "https:",
                       ],
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:         ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc:     ["'self'", 'https://www.google-analytics.com',
                       'https://analytics.google.com', 'https://widget.tidio.co'],
      frameSrc:       ["'self'", 'https://www.youtube-nocookie.com', 'https://www.youtube.com'],
      objectSrc:      ["'none'"],
    },
  },
}));

// Allow compute-pressure API — Tidio uses it to throttle itself under CPU load.
// Helmet blocks it by default; appending here preserves all other Helmet restrictions.
app.use((req, res, next) => {
  const pp = res.getHeader('Permissions-Policy');
  if (pp) res.setHeader('Permissions-Policy', `${pp}, compute-pressure=*`);
  next();
});

app.use(compression());

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting — 200 req / 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  standardHeaders: true,
  legacyHeaders:   false,
}));

// ── Session ──────────────────────────────────────────────────────
// MySQL-backed store so sessions survive app restarts and work across
// all PM2 cluster workers. Uses the same bvoPool connection as the app.
const _sessionStore = new MySQLStore({
  expiration:          7 * 24 * 60 * 60 * 1000, // 7 days (ms) — matches cookie maxAge
  createDatabaseTable: true,                     // auto-creates sessions table if absent
  schema: {
    tableName:   'sessions',
    columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' },
  },
}, bvoPool);

app.use(session({
  secret:            process.env.SESSION_SECRET,
  resave:            false,
  saveUninitialized: false,
  store:             _sessionStore,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',  // blocks cross-site POST CSRF; 'strict' would break OAuth flows
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ── CSRF token generation ────────────────────────────────────────
// Generate a random token per session and make it available to templates.
const crypto = require('crypto');
app.use((req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
});

// ── Body parsers ─────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
// extended:false uses Node's built-in querystring, which keeps bracket-notation
// keys as literal strings (e.g. "nav.links[0].label"). extended:true uses qs,
// which silently collapses them into nested objects/arrays, breaking our
// dot-path parsing and corrupting theme settings arrays (nav.vanities_mega.links
// becomes a URL string, crashing _vmlAdmin.forEach on every theme editor load).
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// ── Static assets ────────────────────────────────────────────────
// Serve uploaded images and documents from the persistent upload directory.
// On production this may be outside public/ (set via UPLOADS_IMG_PATH).
app.use('/docs/uploads', express.static(uploadDir, {
  maxAge: '7d',
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  },
}));
app.use('/images/uploads', express.static(uploadDir, {
  maxAge: '7d',
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  },
}));

app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '7d',
  setHeaders(res) {
    // All public assets are versioned via ?v= query string — safe to cache long-term.
    // Unconditional (no extension check) so the header is always sent, even if a
    // proxy/LiteSpeed strips the maxAge-derived header from the send module.
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
  },
}));

// ── Prevent proxy from caching HTML responses ─────────────────────
// Static assets above have their own long-lived Cache-Control headers.
// Dynamic HTML must never be served from a proxy/CDN cache (Hostinger
// nginx/LiteSpeed may cache responses that lack explicit cache directives).
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

// ── EJS + layouts ────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// ── Auth helpers in every template ───────────────────────────────
app.use(require('./middleware/auth').loadCustomer);

// ── Theme settings in every template ─────────────────────────────
// In preview mode (?te_preview=1 from admin iframe) use session draft
const themeSettings = require('./services/themeSettings');
app.use((req, res, next) => {
  const isPreview = req.query.te_preview === '1' && req.session.isAdmin && req.session.tePreviewSettings;
  res.locals.settings    = isPreview ? req.session.tePreviewSettings : themeSettings.get();
  res.locals.isTePreview = !!isPreview;
  next();
});

// ── Template globals ─────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.ga4Id      = process.env.GA4_ID      || '';
  res.locals.gtmId      = process.env.GTM_ID      || '';
  res.locals.tidioKey   = process.env.TIDIO_PUBLIC_KEY || '';
  res.locals.gmcId      = process.env.GMC_MERCHANT_ID  || '';
  res.locals.cart       = req.session.cart || { items: [], count: 0 };
  res.locals.pageTitle  = 'BathroomVanitiesOutlet.com';
  res.locals.metaDesc   = 'Premium bathroom vanities, mirrors, faucets and accessories at outlet prices. Free shipping on all orders.';
  // SEO defaults — controllers override these as needed
  const siteUrl = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';
  res.locals.siteUrl      = siteUrl;
  res.locals.canonicalUrl = `${siteUrl}${req.path}`;
  res.locals.noindex      = false;   // true → <meta name="robots" content="noindex,follow">
  next();
});

// ── CSRF validation ──────────────────────────────────────────────
// Reject state-changing requests that don't carry the session token.
// Exempts /api routes (they use their own bearer-token auth).
const _CSRF_SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
app.use((req, res, next) => {
  if (_CSRF_SAFE.has(req.method)) return next();
  if (req.path.startsWith('/api/')) return next(); // API uses own auth
  const token = (req.body && req.body._csrf) || req.headers['x-csrf-token'];
  if (!token || token !== req.session.csrfToken) {
    const wantsJson = req.headers.accept?.includes('application/json')
      || req.headers['x-requested-with'] === 'XMLHttpRequest'
      || (req.method !== 'GET' && (req.headers['content-type'] || '').includes('multipart'));
    if (wantsJson) return res.status(403).json({ ok: false, error: 'Invalid CSRF token' });
    return res.status(403).render('pages/error', {
      pageTitle: 'Security Error | BathroomVanitiesOutlet.com',
      message: 'Your session may have expired. Please go back and try again.',
    });
  }
  next();
});

// ── Dynamic mega menu data (sizes + cabinet colors) ──────────────
// Populates res.locals.megaMenuSizes + res.locals.megaMenuColorFamilies
// on every request from a 10-min cached DB query. See middleware/megaMenuData.js.
app.use(require('./middleware/megaMenuData'));

// ── Auth-specific rate limiters ──────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many attempts from this IP. Please try again in 15 minutes.',
  skipSuccessfulRequests: true,
});

const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many admin login attempts. Please try again in 15 minutes.',
  skipSuccessfulRequests: true,
});

// ── Routes ───────────────────────────────────────────────────────
app.use('/',            require('./routes/index'));
app.use('/products',    require('./routes/products'));
app.use('/collections', require('./routes/collections'));
app.use('/cart',        require('./routes/cart'));
app.use('/checkout',    require('./routes/checkout'));
app.use('/account/login',    authLimiter);
app.use('/account/register', authLimiter);
app.use('/account',     require('./routes/account'));
app.use('/admin/login',      adminAuthLimiter);
app.use('/admin',       require('./routes/admin'));
app.use('/api',         require('./routes/api'));
app.use('/bundle-builder', require('./routes/bundle'));

// ── Public CMS routes ────────────────────────────────────────
// Must come before the 404 handler
const pagesCtrl = require('./controllers/pagesController');
const blogCtrl  = require('./controllers/blogController');
app.get('/pages/:slug', pagesCtrl.publicPage);
app.get('/blog',        blogCtrl.publicList);
app.get('/blog/:slug',  blogCtrl.publicPost);

// ── Inspiration / Style Guide routes ─────────────────────────
// Evergreen pillar pages at /inspiration/:slug
// Served from `pages` table where page_type = 'inspiration'
const inspirationCtrl = require('./controllers/inspirationController');
app.get('/inspiration',       inspirationCtrl.hub);
app.get('/inspiration/:slug', inspirationCtrl.guide);

// ── SEO / crawler files ──────────────────────────────────────────
const sitemapCtrl = require('./controllers/sitemapController');
app.get('/sitemap.xml', sitemapCtrl.xml);

// robots.txt — allow everything except admin and API
app.get('/robots.txt', (req, res) => {
  const siteUrl = process.env.SITE_URL || 'https://bathroomvanitiesoutlet.com';
  res.type('text/plain').send(
`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /cart
Disallow: /account/

Sitemap: ${siteUrl}/sitemap.xml
`);
});

// ── 404 handler ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('pages/404', {
    pageTitle: '404 — Page Not Found | BathroomVanitiesOutlet.com',
  });
});

// ── Global error handler ─────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(err.status || 500).render('pages/error', {
    pageTitle: 'Something went wrong | BathroomVanitiesOutlet.com',
    message:   process.env.NODE_ENV === 'production'
                 ? 'An unexpected error occurred.'
                 : err.message,
  });
});

// ── Start ────────────────────────────────────────────────────────
// initFromDb() runs before we accept connections:
//   • If theme_settings.json exists  → syncs it to DB (so DB stays current).
//   • If theme_settings.json missing → restores it from DB (handles fresh Hostinger deploys).
// The .catch() is non-fatal; server always starts regardless.
themeSettings.initFromDb()
  .catch(e => console.error('[theme] initFromDb error:', e.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`\n  BVO website running → http://localhost:${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  });

module.exports = app; // for testing
