'use strict';

require('dotenv').config();

const express        = require('express');
const expressLayouts = require('express-ejs-layouts');
const session        = require('express-session');
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
const fs = require('fs');
const uploadDir = path.join(__dirname, '..', 'public', 'images', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Security / performance middleware ────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", 'https://www.googletagmanager.com',
                       'https://www.google-analytics.com', 'https://code.tidio.co',
                       'https://widget.tidio.co', 'https://fonts.googleapis.com'],
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:        ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:         ["'self'", 'data:', 'https:', 'blob:'],
      connectSrc:     ["'self'", 'https://www.google-analytics.com',
                       'https://analytics.google.com', 'https://widget.tidio.co'],
      frameSrc:       ["'self'"],   // allow same-origin iframe for theme preview
      objectSrc:      ["'none'"],
    },
  },
}));

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
app.use(session({
  secret:            process.env.SESSION_SECRET || 'bvo-dev-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
  },
}));

// ── Body parsers ─────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
// extended:false uses Node's built-in querystring, which keeps bracket-notation
// keys as literal strings (e.g. "nav.links[0].label"). extended:true uses qs,
// which silently collapses them into nested objects/arrays, breaking our
// dot-path parsing and corrupting theme settings arrays (nav.vanities_mega.links
// becomes a URL string, crashing _vmlAdmin.forEach on every theme editor load).
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// ── Static assets ────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '365d',   // safe: all static assets are ?v= versioned
  immutable: true,  // tells CDN/browser the file never changes at this URL
}));

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

// ── Dynamic mega menu data (sizes + cabinet colors) ──────────────
// Populates res.locals.megaMenuSizes + res.locals.megaMenuColorFamilies
// on every request from a 10-min cached DB query. See middleware/megaMenuData.js.
app.use(require('./middleware/megaMenuData'));

// ── Routes ───────────────────────────────────────────────────────
app.use('/',            require('./routes/index'));
app.use('/products',    require('./routes/products'));
app.use('/collections', require('./routes/collections'));
app.use('/cart',        require('./routes/cart'));
app.use('/account',     require('./routes/account'));
app.use('/admin',       require('./routes/admin'));
app.use('/api',         require('./routes/api'));

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
