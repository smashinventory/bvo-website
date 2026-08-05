# BVO Change Log Brief
*Last updated: 2026-08-05*

---

## Security Hardening Sprint — LOW fixes + Autocomplete sweep
**Date:** 2026-08-05
**Audit source:** `BVO_SECURITY_AUDIT.md` (LOW-1, LOW-2, LOW-4, LOW-5, LOW-7, LOW-8, LOW-9)

### LOW-1 · `res.redirect('back')` removed
**File:** `src/controllers/adminController.js:603, 609`
**Problem:** `redirect('back')` trusts the client-supplied `Referer` header — an attacker could set `Referer: https://evil.com` and redirect an admin there after bulk action.
**Fix:** Changed both `activate` and `deactivate` bulk-action redirects to the explicit safe path `/admin/products`.

---

### LOW-2 · XLSX formula injection disabled
**File:** `src/controllers/adminController.js:1259`
**Problem:** `_xlsxLib.read()` with default options parses and caches formula strings. A malicious XLSX with `=HYPERLINK(...)` or similar could exfiltrate data when the formula is later serialized.
**Fix:** Added `cellFormula: false` to the `_xlsxLib.read()` call — formulas are now stripped at parse time.

---

### LOW-4 · DB_PASS startup guard
**File:** `src/config/database.js`
**Problem:** `process.env.DB_PASS || ''` silently connected to MySQL with an empty password if the env var was missing, opening the DB to unauthenticated local connections.
**Fix:** Added `process.exit(1)` guard at module load if `DB_PASS` is absent — same pattern as `SESSION_SECRET` in `server.js`.

---

### LOW-5 · Password complexity increased
**Files:** `src/controllers/accountController.js`, `views/pages/account/register.ejs`
**Problem:** Minimum of 8 characters with no complexity requirement allows trivially brute-forced passwords.
**Fix:** Registration now requires ≥12 characters + at least one digit + at least one non-alphanumeric character. `minlength` attribute on the form input updated to 12. Error message updated accordingly.

---

### LOW-7 · Unused `csv-parse` dependency removed
**File:** `package.json`
**Problem:** `csv-parse ^5.4.0` was listed as a production dependency but had zero `require()` calls anywhere in `src/`. Dead dependencies increase attack surface and supply-chain risk.
**Fix:** Removed the dependency. Run `npm install` after deploy to clean `node_modules`.

---

### LOW-8 · Raw `err.message` no longer returned to admin browser
**File:** `src/controllers/adminController.js` (all 500-level JSON error responses)
**Problem:** Database error messages, file-system paths, and stack fragments were forwarded directly to the admin browser in JSON error bodies, leaking internal implementation details.
**Fix:** Replaced all `res.status(500).json({ ok: false, error: err.message })` and `res.json({ ok: false, error: err.message })` with `'An unexpected error occurred.'`. Full errors are still logged server-side via the existing `console.error` calls. 400-level multer/input-validation errors were left unchanged (those messages are safe and useful to the admin).

---

### LOW-9 · CHIP_SQL parameter binding documented
**File:** `src/controllers/bundleController.js:30`
**Problem:** `CHIP_SQL` contains a positional `?` placeholder for `brand`. Every query that embeds it must supply `brand` as its first bind param. This was undocumented, making refactors fragile.
**Fix:** Added explicit comment on the `CHIP_SQL` constant documenting the required parameter position.

---

### Autocomplete DevTools sweep
**Files:** `views/pages/admin/product-edit.ejs`, `views/pages/admin/category-edit.ejs`, `views/pages/admin/model-edit.ejs`
**Problem:** Browser flagged admin data-entry fields (`name`, `brand`, `color`, `material`, etc.) as missing `autocomplete` attributes. User-facing forms (login, register, checkout) already had correct `autocomplete` values.
**Fix:** Added `autocomplete="off"` to the `<form>` element of all three admin edit forms. This suppresses browser autofill on data fields where it makes no sense and clears the DevTools violation.

---

## Security Hardening Sprint — CRIT / HIGH / MED fixes
**Date:** 2026-08-05
**Audit source:** `BVO_SECURITY_AUDIT.md`

### CRIT-5 · Stored XSS in header.ejs
**File:** `views/partials/header.ejs` lines 106, 108
**Problem:** Promo bar used `<%-` (unescaped output) for `_vmp.title` and `_vmp.cta`. Any admin-entered promo text containing `<script>` would execute in every visitor's browser.
**Fix:** Changed both to `<%= %>` (HTML-escaped). Also removed `<br>` from the default fallback string since `<%=` encodes angle brackets.
**To reverse:** Change `<%= _vmp.title %>` back to `<%- _vmp.title %>` (not recommended).

---

### HIGH-1 · Full CSRF Protection
**Files:** `src/server.js`, `views/layouts/main.ejs`, `views/layouts/admin.ejs`, all form-containing view files (28 forms total)
**Problem:** No CSRF tokens anywhere — any malicious site could silently POST to authenticated routes on behalf of logged-in admins or customers.
**Fix:**
- `src/server.js`: Added token-generation middleware (after session) — generates `crypto.randomBytes(32).toString('hex')` per session, stored as `req.session.csrfToken`, exposed as `res.locals.csrfToken`.
- `src/server.js`: Added validation middleware (before routes) — rejects all non-GET/HEAD/OPTIONS requests to non-`/api/` paths if token is missing or mismatched. Returns 403 JSON for AJAX, 403 HTML error page for form POSTs.
- `/api/*` routes exempted (they use their own auth).
- `views/layouts/main.ejs` + `views/layouts/admin.ejs`: Added `<meta name="csrf-token">` tag + global `fetch` interceptor that auto-attaches `X-CSRF-Token` header to all non-GET fetch calls.
- All 28 forms: Added `<input type="hidden" name="_csrf" value="<%= csrfToken %>">`.

**Forms covered:**
`account/login`, `account/register`, `account/dashboard`, `account/favorites`, `account/orders`, `admin/login`, `checkout`, `cart` (×2), `product`, `cart-drawer` (×2), `admin/models` (×2), `admin/theme`, `admin/category-edit` (×2), `admin/bulk-edit`, `admin/product-edit` (×2), `admin/color-report` (×2), `admin/categories`, `admin/products` (×3 + delete), `admin/model-edit` (×2), `admin/orders`

**Bug fixed during implementation:** Automated regex script matched `%>` inside EJS action URLs as form-tag end, injecting the hidden input mid-attribute. Manually corrected 9 malformed injections in: `product-edit.ejs`, `models.ejs` (×2), `category-edit.ejs` (×2), `categories.ejs`, `model-edit.ejs` (×2).

**To reverse:** Remove the two middleware blocks from `server.js`. Remove `<meta name="csrf-token">` and the fetch interceptor script from both layouts. Remove `_csrf` hidden inputs from all forms.

---

### Bulk Edit Save Bug Fix
**File:** `src/controllers/adminController.js` — `productBulkEditSave()`
**Problem:** `express.urlencoded({ extended: false })` does not parse bracket-notation keys (`rows[0][price]`) into nested objects — treats them as literal string keys. `req.body.rows` was always `undefined`, so bulk edit saved 0 products every time.
**Fix:** Manually parse the flat bracket-notation keys from `req.body` using a regex: `/^rows\[(\d+)\]\[([^\]]+)\]$/`. Builds the expected `{ idx: { field: value } }` structure before the save loop.
**Root cause note:** `extended: false` was intentional — `extended: true` (qs) mangles dot-path keys in theme settings (`nav.links[0].label` collapses to a URL string). The fix is in the controller, not the body parser.

---

### HIGH-2 · Rate Limiting on Auth Routes
**File:** `src/server.js`
**Problem:** No rate limiting on login/register — brute-force attacks against customer passwords or admin panel were unrestricted.
**Fix:** Added two `express-rate-limit` limiters (package already in `package.json`):
- `authLimiter`: 10 failed attempts / 15 min per IP on `POST /account/login` and `POST /account/register`
- `adminAuthLimiter`: 5 failed attempts / 15 min per IP on `POST /admin/login`
- Both use `skipSuccessfulRequests: true` — successful logins do not count toward the limit.
- Applied as route-prefix middleware before the router mounts: `app.use('/account/login', authLimiter)` etc.

**Bug during deploy:** Duplicate `const rateLimit = require('express-rate-limit')` — package was already required at line 24. Fixed by removing the second declaration added inside the routes block.

---

### HIGH-4 · File Upload Security
**File:** `src/controllers/adminController.js` lines 16–84 + 5 middleware wrappers + `productImportMiddleware`
**Problem:** All three multer instances (`_upload`, `_docUpload`, `_videoUpload`) relied on `file.mimetype` alone for filtering — trivially spoofed by the client. No extension whitelist. `productImportMiddleware` (CSV) had no filter at all.
**Fix:**
- Added extension whitelists as `Set` constants:
  - `ALLOWED_IMAGE_EXTS`: `.jpg .jpeg .png .gif .webp`
  - `ALLOWED_DOC_EXTS`: `.pdf .doc .docx .jpg .jpeg .png`
  - `ALLOWED_VIDEO_EXTS`: `.mp4 .webm .mov`
- Updated all three `fileFilter` callbacks to check extension AND MIME type.
- Added `_imageMagicOk(file)` helper: reads first 8 bytes from disk after upload; validates against known magic byte signatures (JPEG `FF D8 FF`, PNG `89 50 4E 47…`, GIF `47 49 46 38`, WebP `52 49 46 46`). Returns `false` if extension unknown or bytes don't match.
- Added magic byte check to all 5 image upload middleware wrappers: `productAddImageMiddleware`, `uploadMiddleware`, `categoryImageAjaxMiddleware`, `categoryImageMiddleware`, `modelImageAjaxMiddleware`. If check fails, file is deleted from disk and 400 returned.
- `productImportMiddleware` (CSV): added `fileFilter` rejecting any extension other than `.csv`.

**To reverse:** Remove `ALLOWED_*_EXTS` constants, `_IMG_MAGIC` object, and `_imageMagicOk()` function. Revert the three `fileFilter` callbacks to MIME-only checks. Remove magic check calls from the 5 middleware wrappers. Remove CSV fileFilter.

---

### HIGH-5 · Clover Redirect Domain Validation
**File:** `src/controllers/checkoutController.js`
**Problem:** Server blindly redirected to whatever URL Clover's API returned in `data.href` — an open redirect if the response were ever tampered with.
**Fix:** Validate `data.href` starts with one of three known Clover domains before redirecting: `https://checkout.clover.com/`, `https://sandbox.dev.clover.com/`, `https://scl.clover.com/`. Throws an error (caught by the existing try/catch) if the domain doesn't match.
**Note:** Clover is not yet configured. This code path is unreachable until `CLOVER_API_KEY` is set in Hostinger env vars.

---

### HIGH-6 · Typesense filter_by Injection via catSlug
**File:** `src/routes/search.js` line 42
**Problem:** `req.query.category` was embedded directly into the Typesense `filter_by` string: `` `category_slug:${catSlug} && in_stock:true` ``. An attacker could inject arbitrary Typesense filter conditions via the query string.
**Fix:** Validate `catSlug` against `/^[a-z0-9-]+$/` before use. Any value that doesn't match is treated as `null` (no category filter applied). The MySQL fallback already used parameterized queries and was safe.

---

### MED-4 · syncSettings.js Wrong Data Path
**File:** `src/services/syncSettings.js` line 11
**Problem:** `path.join(__dirname, '../data/sync_settings.json')` resolves to `src/data/sync_settings.json` — one level too shallow. The `data/` directory is at the project root, not inside `src/`. `themeSettings.js` correctly uses `../../data/`.
**Fix:** Changed to `path.join(__dirname, '../../data/sync_settings.json')`.

---

### MED-5 · require() Inside Exported Function Body
**File:** `src/controllers/accountController.js` line 178 (before fix)
**Problem:** `const { bvoPool } = require('../config/database')` was inside `exports.newsletter` — called on every newsletter POST. Node.js caches `require()` calls so this is functionally harmless, but it's an anti-pattern that makes dependencies invisible and complicates static analysis.
**Fix:** Moved `const { bvoPool } = require('../config/database')` to the top of the file with the other imports. Removed the inline require from the function body.

---

### MED-6 · No Length Validation on Customer String Fields
**Files:** `src/controllers/accountController.js`, `src/controllers/checkoutController.js`
**Problem:** `first_name`, `last_name`, and `phone` from user input were passed directly to DB queries and external APIs (Clover) with no length cap. A sufficiently long string could corrupt DB column values or cause unexpected API behavior.
**Fix:**
- `accountController.js` (registration): `first_name` and `last_name` capped at 100 chars via `.trim().slice(0, 100)` before `Customer.create()` call.
- `checkoutController.js` (Clover payload): `first_name` / `last_name` capped at 100 chars, `phone` capped at 30 chars, all trimmed before the Clover API payload is built.

---

### MED-7 · megaMenuData Middleware Silently Swallows DB Errors
**File:** `src/middleware/megaMenuData.js` line 71
**Problem:** The `catch` block returned empty arrays silently — if the mega menu DB query failed repeatedly, there would be no log trace to diagnose it.
**Fix:** Changed `} catch {` to `} catch (err) {` and added `console.error('[megaMenuData] DB error:', err.message)`. The graceful degradation (empty arrays) is preserved; errors are now visible in Hostinger's Node.js log panel.

---

---

## Task #66–70 — Cart Page 500 Error Fix
**Date:** 2026-08-01

### Problem
Visiting `/cart` after adding bundle builder items showed "Something went wrong / An unexpected error occurred." Cart count badge correctly showed N items, but the cart page crashed with a 500.

### Root Cause — FormData vs urlencoded (primary bug)
`bundle-builder.ejs` `addToCart()` used `new FormData()` to POST items to `/cart/add`. `FormData` sends `Content-Type: multipart/form-data`. Express's `express.urlencoded()` middleware **only** parses `application/x-www-form-urlencoded` — it silently ignores multipart bodies. As a result:

- `req.body` was `{}` for every bundle add request
- `product_id`, `name`, `price`, `slug`, `image` were all `undefined`
- `parseFloat(undefined)` = `NaN`
- `recalc()` computed `subtotal = parseFloat(NaN.toFixed(2))` = NaN
- `JSON.stringify(NaN)` = `null` (JS spec: NaN serialises to null in JSON)
- Session stored `{ items: [{ product_id: null, price: null, ... }], subtotal: null }`
- On `/cart` GET, `cart.subtotal.toLocaleString(...)` threw `TypeError: Cannot read properties of null (reading 'toLocaleString')` → 500

The AJAX response still returned `{ ok: true, count: 1 }` (count from `recalc`), so the cart badge showed "1", masking the underlying data corruption.

### Why it wasn't caught locally
- Local test (node -e with ejs.render) proved the template was fine with valid data
- Full server test couldn't run in the sandbox (express-mysql-session not installed)
- The bug only manifested end-to-end via AJAX add → redirect to /cart

### How to detect recurrence
- Cart badge shows items but `/cart` crashes → check for null prices in session
- `console.error('[ERROR]', err.stack)` in the error handler will log the full stack to PM2 logs on Hostinger (check via Hostinger panel → Node.js → Logs)
- Look for: `TypeError: Cannot read properties of null (reading 'toLocaleString')`

### How to unwind
If session data is poisoned (nulls in cart items), users need to clear their cart. There's no admin purge UI. Options:
1. User clears browser cookies/session (easiest)
2. Admin can run: `DELETE FROM sessions WHERE data LIKE '%"price":null%';` in phpMyAdmin
3. The defensive guards added in this fix (`parseFloat(x)||0`) mean poisoned sessions now render correctly with $0.00 rather than crashing

### Changes Made

**`views/pages/bundle-builder.ejs`** (primary fix)
- `addToCart()`: changed `new FormData()` → `new URLSearchParams()`
- Added explicit `Content-Type: application/x-www-form-urlencoded` header to the fetch call
- Added explanatory comment warning about the multipart/urlencoded distinction
- `URLSearchParams` serialises identically to HTML form POST bodies, so all existing urlencoded middleware parses it correctly

**`src/controllers/cartController.js`** (defensive hardening)
- `recalc()`: changed bare `i.price` → `(parseFloat(i.price) || 0)` in the reduce so NaN can never propagate to `subtotal`
- `add()`: added guard block at top — if `product_id` is missing (body parse failure), return 400 JSON for AJAX or redirect for form POSTs rather than storing garbage
- `add()`: changed `parseFloat(price)` → `parseFloat(price) || 0` so pricef is always a valid number
- `add()`: changed `slug, name` → `slug: slug || '', name: name || ''` so string fields are always strings

**`views/pages/cart.ejs`** (defensive rendering)
- `item.price.toLocaleString(...)` → `(parseFloat(item.price)||0).toLocaleString(...)` (line 38)
- `item.qty * item.price` → `item.qty * (parseFloat(item.price)||0)` (line 59)
- `cart.subtotal.toLocaleString(...)` → `(parseFloat(cart.subtotal)||0).toLocaleString(...)` (lines 71, 79, both uses)
- These guards ensure old poisoned sessions render $0.00 rather than crashing

**`views/partials/cart-drawer.ejs`** (2 separate bugs fixed)
- `_total`: changed `parseFloat(_cartItems.total || 0)` → `parseFloat(_cartItems.subtotal || _cartItems.total || 0)` — cart uses `subtotal` not `total`; drawer was always showing $0.00 in footer
- `item.productId` (camelCase) → `item.product_id` (snake_case) in 4 places: hidden input `name="product_id"`, hidden `value=`, and 2 `data-id=` attributes on qty buttons — cart items are stored with snake_case key so camelCase was always undefined

### Future Notes
- Never use `new FormData()` for AJAX POSTs to Express unless you add `multer` middleware to that route. Use `URLSearchParams` or `JSON.stringify` with `Content-Type: application/json` instead.
- The cart drawer qty +/- buttons use `type="button"` with `data-action` attributes — they don't submit the form directly. There must be JS in site.js listening for those (or it needs to be added) for qty changes in the drawer to work.
- `/checkout` route does not exist yet — "Proceed to Checkout" link currently hits the 404 handler.

---

## Task #65 — Stone Material Swatches (Bundle Builder + Tops Collection Sidebar)
**Date:** 2026-08-01

### Problem
- Bundle builder Step 2 (stone tops) showed no material swatches because all 144 top SKUs have `color=NULL` and `model=NULL` — the existing swatch renderer relied on `sku.color`, which is always null for tops.
- `/collections/bathroom-vanity-tops` sidebar had no material filter; shoppers could only browse by width or price.

### Root Cause
Stone tops are a homogeneous category — one SKU per material per size, no colour variants. The existing "finish swatch" system groups by `products.color`, which is unused for stone. A different swatch mechanism is needed: one swatch per unique material, clicking jumps to that top.

### Matching Strategy — Name Keyword Overlap
JM ships "Stone Sample - <Material>" products (`category_id=10`) with photo swatches. To connect tops to samples:
1. Extract material from top name via regex: `/,\s*\d+(?:\.\d+)?\s*CM\s+(.+?)\s+w\/\s*Sink/i` → "Carrara White Marble"
2. Strip "Stone Sample - " prefix from sample name
3. Score overlap by counting words > 3 chars that appear in both strings
4. Best-score sample's image becomes `stone_image` on the top row
5. Unmatched tops get `stone_image: null` → grey `#C9B89A` fallback swatch

New fields added to top rows at server-render time: `stone_material`, `stone_image`.

### Changes Made

**`src/controllers/bundleController.js`**
- Added `getStoneSamples()` — queries `category_id=10`, `name LIKE 'Stone Sample -%'`, brand=JM
- Added `extractTopMaterial(topName)` — regex extract between ", N CM " and " w/ Sink"
- Added `wordOverlapScore(a, b)` — counts overlapping words > 3 chars
- Added `enrichTopsWithMaterial(topRows, sampleRows)` — attaches `stone_material` + `stone_image` to each top row
- `getBundleBuilder()`: now fetches stone samples in parallel (`Promise.all`), calls `enrichTopsWithMaterial` before `groupByModel`

**`views/pages/bundle-builder.ejs`**
- Added `topMatSwatchHtml(material, imgUrl, topIdx, isActive)` — renders `<button class="bb-swatch bb-swatch--topmat">` with `data-top-idx`; uses sample image background or grey fallback
- Added `renderTopMatSwatches()` — calls `activeTops()`, deduplicates by `stone_material`, renders one swatch per unique material at its first `activeTops()` index; also updates `bb-finish-top` span with current material name
- Modified `renderViewer(step)` swatch block: branches on `step === 'top'` → calls `renderTopMatSwatches()` instead of standard colour-swatch loop
- Added `pickTopMat(topIdx)` — sets `gIdx.top = topIdx` and re-renders Step 2
- `onPageClick` handler: `.bb-swatch--topmat` match added BEFORE `.bb-swatch[data-step]` check to avoid interference
- `unlockTopStep()`: picker label changed from `"Finish"` → `"Stone Material"` for tops card

**`src/controllers/collectionsController.js`**
- For `category.id === 7` (tops): reads `req.query.countertop_material`, injects into `attrFilters['countertop_material']` so `Product.findByCategory()` applies it as an EAV EXISTS subquery (no changes to Product.js needed)
- Fetches stone samples for sidebar swatch display; builds `stoneMaterialSwatches` array: `[{ material, imgUrl }]`
- Passes `stoneMaterialSwatches` + `stoneMaterialActive` to template render call

**`views/pages/collection.ejs`**
- Added "Stone Material" filter group before Price Range, gated on `category.id === 7`
- Renders `.stone-mat-grid` (2-column CSS grid) of `.stone-mat-sw` buttons with `data-material`, `title`, and `style="background-image:..."` (or grey fallback)
- Active material hidden inputs preserve selection when other filters fire `form.submit()`
- Hover tooltip via CSS `::after` with `content: attr(title)` — no extra markup needed

**`public/js/site.js`**
- Added IIFE stone material swatch handler (mirrors colour filter IIFE pattern)
- Reads `window.location.search` → URLSearchParams → `getAll('countertop_material')`
- Toggle logic: clicking active swatch removes it; clicking inactive appends it
- Calls `navigate(materials)` which rebuilds URL, resets `page=`, navigates

**`public/css/site2.css`**
- `.bb-swatch--topmat` — CSS tooltip via `::after` + `content:attr(title)`; inherits size/border/active from `.bb-swatch`
- `.stone-mat-grid` — `grid-template-columns: repeat(2, 1fr); gap: .5rem`
- `.stone-mat-sw` — square (aspect-ratio: 1, max-width: 52px), rounded, `background-size:cover`; hover scale + border darken; active amber border + outline
- `.stone-mat-sw::after` — same tooltip pattern as bundle builder

### Key Design Decisions
- **No `attribute_definitions` DB row needed** for `countertop_material` — the controller injects it directly into `attrFilters` for category 7. `Product.findByCategory()` handles arbitrary EAV keys.
- **"Stone Material" label** used throughout (bundle builder Step 2 picker + sidebar group header) instead of "Finish" — per user direction 2026-08-01.
- **Composite tops excluded** from both surfaces — `SLUG_DEFAULT_PRODUCT_TYPES` gates `/collections/bathroom-vanity-tops` to `product_type = 'Stone Top'` only (Task #60). Composite tops appear only in combo product displays.
- **Grey fallback** `#C9B89A` used when no stone sample image matches a top; no separate "Other" grouping.

### EAV Filter Flow (countertop_material)
```
URL: ?countertop_material=Carrara+White+Marble
→ collectionsController: attrFilters['countertop_material'] = ['Carrara White Marble']
→ mergedAttrFilters includes it
→ Product.findByCategory() adds: AND EXISTS (
    SELECT 1 FROM product_attribute_values
    WHERE product_id = p.id
      AND attr_key   = 'countertop_material'
      AND value_text IN ('Carrara White Marble')
  )
```

### Future Notes
- If new stone materials are added via JM feed re-import, their "Stone Sample -" products auto-appear in the sidebar with no code changes.
- The word-overlap matching is case-insensitive and ignores short words (≤3 chars). If a material name has very short words only, it falls back to grey swatch.
- Multi-select is supported (clicking multiple swatches adds multiple `countertop_material` params).

---

---

## Scope — Universal Swatch & Chip Layout (Rule 13)
**Date:** 2026-07-21

### Summary
Established a universal, locked-in layout standard for size chips and color swatches across ALL card types on the site. This resolved a series of card-by-card discrepancies that accumulated across sessions.

### Changes Made

**`public/css/site2.css`** (at v13 after all changes):
- Labels: `.model-card-swatches-label` / `.model-card-sizes-label` — `font-size: .68rem`, `font-weight: 600`, `min-width: 5rem`, `color: #9CA3AF`, `text-transform: uppercase`
- Swatches row: `.model-card-swatches` — `gap: .35rem`, `margin-bottom: .5rem`
- Swatch shift: `.model-card-swatches .model-card-swatch:first-of-type` — `margin-left: -.5rem`
- Sizes row: `.model-card-sizes-row` — `gap: .35rem`, `margin-bottom: .5rem`
- Chip container shift: `.model-card-size-chips` — `margin-left: -.55rem`
- Chip button: `.model-card-size-btn` — `padding: .13rem`, `font-size: .68rem`, `font-weight: 600`, `border-radius: 3px`

**`views/pages/collection.ejs`:**
- Removed `"` from all size chip button visible text (model-group cards + product cards)
- Restored `FINISHES:` / `SIZES:` labels on all card types
- Removed 5-chip cap (+N overflow) — all sizes now shown
- Model-group chip template updated to use `sz.key` / `sz.label` (bucketed objects from SIZE_BUCKETS)

**`views/pages/index.ejs`:**
- Removed `"` from all size chip button visible text (carousel + featured product cards)
- Restored `FINISHES:` / `SIZES:` labels
- Removed 5-chip cap (+N overflow)

**`src/controllers/collectionsController.js`:**
- Applied SIZE_BUCKETS bucketing to model-group `m.sizes` (was raw numbers; now `{label, key}` objects)
- Fixed model-group filter options query: added `AND p.category_id = ?` scope
- Fixed model-group main WHERE: added `AND p.category_id = ?` scope

### Permanent Rule
See **Rule 13** in `BVO_AUDIT_BRIEF.md` for the canonical values and violation checklist.

---

## Scope 1 — Bug 3: Listing Grid Mobile Breakpoint + Pagination Fix
**Commit:** `7f292fb` — *"Bug 3: fix listing-grid mobile breakpoint + increase PER_PAGE to 24"*

### Problem
- On phones (≤480px), product cards in collection pages (e.g. `/collections/bathroom-vanities`) were showing 1 per row at full width, stretching the card layout.
- Pagination was 354 pages for 4,237 JM products — far too many.

### Changes
**`public/css/site.css`** — Added `listing-grid` to the existing `@media (max-width: 480px)` block:
```css
@media (max-width: 480px) {
  .category-grid { grid-template-columns: 1fr; }
  .product-grid  { grid-template-columns: 1fr; }
  .listing-grid  { grid-template-columns: 1fr; }   ← ADDED
  .value-bar     { grid-template-columns: 1fr; }
  .trust-band    { grid-template-columns: 1fr; }
  .footer-grid   { grid-template-columns: 1fr; }
  .parallax-title { font-size: 2rem; }
}
```

**`src/models/Product.js` line 5:**
```js
// BEFORE:
const PER_PAGE = 12;
// AFTER:
const PER_PAGE = 24;
```
→ Reduces pagination from 354 pages to ~177 pages for 4,237 JM products.

### To Reverse
- Revert `PER_PAGE` back to `12` in `src/models/Product.js`
- Remove the `.listing-grid { grid-template-columns: 1fr; }` line from the `@media (max-width: 480px)` block in `site.css`

---

## Scope 2 — Mobile Layout: Carousel, Filter Drawer, Related Products Grid
**Commit:** `fb1159b` — *"Mobile layout: responsive carousel, filter drawer, fix related products grid"*

### Problem
Three separate mobile layout issues observed in phone screenshots:
1. Related products section on product detail page always showed 4 columns on mobile (hardcoded inline style overriding all CSS media queries)
2. Homepage featured-models carousel showed 4 tiny cards on phone (~57px each), text completely clipped
3. Filter sidebar stacked above products on mobile, pushing all products far down the page

### Changes

**`views/pages/product.ejs` line 324** — Removed hardcoded inline style:
```html
<!-- BEFORE -->
<div class="product-grid" style="grid-template-columns:repeat(4,1fr)">
<!-- AFTER -->
<div class="product-grid">
```
→ Allows existing CSS breakpoints to work: 4 cols desktop, 3 at ≤1100px, 2 at ≤860px, 1 at ≤480px.

**`public/js/site.js`** — Made carousel `VISIBLE` responsive (was hardcoded `var VISIBLE = 4`):
```js
// BEFORE:
var VISIBLE = 4;
var GAP = 20;
function sizeCards() {
  var trackW = track.offsetWidth;
  if (!trackW) return;
  var cardW = Math.floor((trackW - (VISIBLE - 1) * GAP) / VISIBLE);

// AFTER:
var GAP = 20;
function sizeCards() {
  var trackW = track.offsetWidth;
  if (!trackW) return;
  var vw = window.innerWidth;
  var VISIBLE = vw < 520 ? 1.2 : vw < 768 ? 2 : 4;
  var cardW = Math.floor((trackW - (VISIBLE - 1) * GAP) / VISIBLE);
```
→ 4 cards on desktop, 2 on tablet, 1.2 on phone (full card + peek of next).

**`views/pages/collection.ejs`** — Added filter overlay div, close button, and mobile "Filters" toggle button:
```html
<!-- overlay (before .listing-layout) -->
<div class="filter-overlay" id="filterOverlay" aria-hidden="true"></div>

<!-- close button (inside .filter-header) -->
<button type="button" class="filter-close-btn" id="filterCloseBtn" aria-label="Close filters">
  <svg viewBox="0 0 24 24" width="18" height="18" ...><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
</button>

<!-- mobile toggle button (first element in .listing-toolbar) -->
<button type="button" class="mobile-filter-btn" id="mobileFilterBtn" aria-label="Open filters">
  <svg ...>...</svg>
  Filters<% if (hasActiveFilters) { %> <span class="mobile-filter-dot">●</span><% } %>
</button>
```

**`public/css/site.css`** — Appended mobile filter drawer CSS (now in site2.css after Scope 3 split):
```css
.mobile-filter-btn, .filter-close-btn, .filter-overlay { display: none; }

@media (max-width: 720px) {
  .filter-panel {
    position: fixed !important;
    top: 0; left: 0;
    width: 82%; max-width: 300px; height: 100%;
    transform: translateX(-110%);
    transition: transform .28s ease;
    z-index: 600;
    overflow-y: auto;
    border-radius: 0;
    box-shadow: 4px 0 24px rgba(24,40,64,.18);
    padding: 20px;
  }
  .filter-panel.is-open { transform: translateX(0); }
  .filter-overlay { display: block; position: fixed; inset: 0; background: rgba(24,40,64,.45); z-index: 599; opacity: 0; pointer-events: none; transition: opacity .28s ease; }
  .filter-overlay.is-open { opacity: 1; pointer-events: auto; }
  .mobile-filter-btn { display: inline-flex; ... }
  .filter-close-btn { display: inline-flex; ... }
}
```

**`public/js/site.js`** — Appended mobile filter drawer IIFE at end of file:
```js
(function () {
  var panel   = document.querySelector('.filter-panel');
  var openBtn = document.getElementById('mobileFilterBtn');
  var closeBtn = document.getElementById('filterCloseBtn');
  var overlay  = document.getElementById('filterOverlay');
  if (!panel || !openBtn) return;
  function openDrawer()  { panel.classList.add('is-open'); if (overlay) overlay.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
  function closeDrawer() { panel.classList.remove('is-open'); if (overlay) overlay.classList.remove('is-open'); document.body.style.overflow = ''; }
  openBtn.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
  if (overlay)  overlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
})();
```

### To Reverse
- `product.ejs` line 324: restore `style="grid-template-columns:repeat(4,1fr)"` on the `.product-grid` div
- `site.js`: restore `var VISIBLE = 4;` as outer constant; remove `var vw = ...` and `var VISIBLE = ...` inside `sizeCards()`
- `collection.ejs`: remove the `filter-overlay` div, `filter-close-btn` button, and `mobile-filter-btn` button
- `site.css` / `site2.css`: remove the mobile filter drawer CSS block
- `site.js`: remove the mobile filter drawer IIFE at the end of the file

---

## Scope 3 — CSS Split: Bypass Hostinger 80KB CDN File Size Limit
**Commit:** *(pending push)* — *"fix: split site.css → site.css + site2.css to bypass Hostinger 80KB CDN limit"*

### Problem Discovered
The Hostinger CDN was silently truncating `public/css/site.css` at approximately **79,600 bytes**. The local file grew to **105,333 bytes** (2,706 lines) over the course of development. Everything past byte 79,600 — approximately line 1,689 onwards — was never served to browsers. This meant the following CSS sections were **completely invisible to the live site**:
- Newsletter section
- Testimonials section  
- Cart drawer
- Cart count badge
- Related products
- Trust band
- Model card swatches (`.model-card-swatches`, `.model-card-swatch`, `.model-card-sizes-row`)
- Favorites / heart button
- **Mobile filter drawer** (added in Scope 2)
- Various responsive breakpoints

This was the root cause of Scope 1 and Scope 2 fixes "not working" after deployment — the CSS was never reaching the browser.

### Changes

**`public/css/site.css`** — Trimmed to lines 1–1688 (77,540 bytes). Ends just before the NEWSLETTER section.

**`public/css/site2.css`** *(new file)* — Lines 1689–2706 of the original site.css (27,793 bytes). Contains:
- NEWSLETTER section
- TESTIMONIALS section
- CART DRAWER
- Cart count badge
- Related products
- Trust band
- Model card swatches + sizes
- Favorites / heart button styles
- Mobile filter drawer CSS (from Scope 2)

**`views/layouts/main.ejs`** — Added second stylesheet link:
```html
<!-- BEFORE -->
<!-- Site CSS -->
<link rel="stylesheet" href="/css/site.css">

<!-- AFTER -->
<!-- Site CSS (split to stay under CDN 80KB file-size limit) -->
<link rel="stylesheet" href="/css/site.css">
<link rel="stylesheet" href="/css/site2.css">
```

### To Reverse
- Concatenate `site.css` + `site2.css` back into a single `site.css`: `cat site.css site2.css > site_full.css && mv site_full.css site.css`
- Delete `site2.css`
- Remove the `site2.css` link from `main.ejs`
- Note: the combined file will exceed the ~79KB CDN limit and the problem will return unless the Hostinger CDN limit is raised or the CSS is minified

### Long-term Recommendation
If the CSS continues to grow, consider one of:
1. **Minify CSS** at deploy time (e.g. `cssnano` or `cleancss`) — a minified version of this file would be ~45–55KB, well under any limit
2. **Raise Hostinger's limit** — check nginx config or CDN settings for `client_max_body_size` / file-size caps
3. **Create a `site3.css`** if/when `site2.css` approaches 79KB

---

## Feature: James Martin Bundle Builder — `/bundle-builder`
**Commits:** `(bundleController)` → `a3ed0a9` (model-viewer redesign)
**Last updated:** 2026-07-30
**Rollback:** `git reset --hard 9d30d47` removes the entire feature (all 4 files)

---

### 1. Purpose

A dedicated page at `/bundle-builder` that lets shoppers assemble a James Martin bathroom set (cabinet + top + optional mirror + optional faucet) and earn a tiered discount — 5% for cabinet+top, 10% if they add a mirror, 15% when faucet is available. Each item is added to the cart individually at the discounted price so standard cart/checkout logic is unchanged.

---

### 2. Files Involved

| File | Role |
|---|---|
| `src/controllers/bundleController.js` | Fetches all JM SKUs for each step, groups by model, passes to view |
| `src/routes/bundle.js` | Registers `GET /bundle-builder` → bundleController.getBundleBuilder |
| `src/server.js` | Mounts bundle router: `app.use('/', bundleRouter)` |
| `views/pages/bundle-builder.ejs` | Full page template + inline client-side JS state machine |
| `public/css/site2.css` | All `.bb-*` styles (lines after the BUNDLE BUILDER comment header) |
| `views/layouts/main.ejs` | CSS version bump (currently `?v=31`) |

---

### 3. Database Layer — bundleController.js

#### Brand constant
```js
const JM_BRAND = 'James Martin Vanities';
// NOTE: never abbreviate to 'James Martin' — that matches zero rows
```

#### CHIP_SQL — color chip photo subquery
Each SKU row includes a `chip_image` column, fetched from the Sample products JM provides:

```sql
(SELECT pi2.url FROM product_images pi2
 INNER JOIN products s ON s.id = pi2.product_id
 WHERE s.brand       = ?          -- param 1: JM_BRAND
   AND s.model       = p.model    -- same collection name
   AND s.color       = p.color    -- same finish/color
   AND s.category_id = 10         -- category_id=10 = Sample products
 ORDER BY pi2.sort_order ASC, pi2.id ASC LIMIT 1) AS chip_image
```

**Key assumption:** JM Sample products (category_id=10, product_type='Sample') are the swatch/chip images JM bundles with every collection. They are matched by exact `brand + model + color` string. If color naming drifts between the regular product catalog and Sample products (e.g. "White" vs "White Glossy"), `chip_image` will return NULL and the swatch falls back to `FAMILY_HEX[color_family]` hex color.

#### IMG_SQL — primary product image
```sql
COALESCE(
  (SELECT pi.url FROM product_images pi
   WHERE pi.product_id = p.id
   ORDER BY pi.sort_order ASC, pi.id ASC LIMIT 1),
  p.primary_image_url
) AS primary_image
```
No bind params — scoped to the product itself via `p.id`.

#### Parameter count per query
Each query has exactly **2 bind params**: `[JM_BRAND, JM_BRAND]`.
- CHIP_SQL: 1 `?` (s.brand = ?)
- Main WHERE: 1 `?` (p.brand = ?)
- IMG_SQL: 0 `?` (no outer bind)

**Bug fixed in commit a3ed0a9:** original code passed `[JM_BRAND, JM_BRAND, JM_BRAND]` (3 params) — MySQL would throw "Parameter count mismatch". Now correctly `[JM_BRAND, JM_BRAND]`.

#### Three queries

**Step 1 — Cabinets:**
```sql
WHERE p.brand        = ?
  AND c.slug         = 'vanities'
  AND p.product_type = 'Cabinet Only'
  AND p.is_active    = 1
ORDER BY p.model ASC, p.width_in ASC, p.price ASC
```
`product_type = 'Cabinet Only'` mirrors exactly what the megamenu "Cabinet Only" link sends (`?type=Cabinet+Only`). The collectionsController maps `req.query.type` → `p.product_type` in a WHERE clause.

**Step 2 — Tops:**
```sql
WHERE p.brand      = ?
  AND c.slug       = 'vanity-tops'
  AND p.is_active  = 1
  AND (
    p.name         LIKE '%Quartz%'
    OR p.name      LIKE '%Marble%'
    OR p.product_type LIKE '%Quartz%'
    OR p.product_type LIKE '%Marble%'
  )
ORDER BY p.model ASC, p.width_in ASC, p.price ASC
```
**Assumption:** We only offer quartz/marble tops in the bundle. The LIKE filter is intentionally broad — it catches both product name and product_type. If JM introduces tops with different material names (e.g. "Granite"), this query will silently exclude them. **TODO: revisit once we verify all JM top product_type values in the DB.**

Width filtering for tops happens **client-side**, not in SQL — all tops are fetched up front, then the JS `activeTops()` function filters `TOP_MODELS` to only include models that have a SKU matching the selected cabinet's `width_in`. This avoids an extra round-trip when the cabinet selection changes.

**Step 3 — Mirrors:**
```sql
WHERE p.brand         = ?
  AND (c.slug = 'accessories' OR c.slug = 'mirrors')
  AND p.product_type  LIKE '%Mirror%'
  AND p.is_active     = 1
ORDER BY p.model ASC, p.width_in ASC, p.price ASC
```
**Assumption:** Mirrors live in either `accessories` or `mirrors` category slugs. If the import puts them elsewhere, this returns zero results. Verify with `SELECT DISTINCT c.slug FROM products p JOIN categories c ON c.id=p.category_id WHERE p.brand='James Martin Vanities' AND p.product_type LIKE '%Mirror%'`.

#### groupByModel(rows)
Converts a flat array of SKU rows into an array of `{ model, skus[] }` objects, sorted alphabetically by model name:
```js
[
  { model: 'Brookfield', skus: [{ id, slug, name, model, price, width_in, color, color_family, primary_image, chip_image }, ...] },
  { model: 'Hudson',     skus: [...] },
  ...
]
```
The `model` column in the DB = JM's "Collection Name" (e.g. "Hudson", "Brookfield", "De Soto"). Models with NULL model are grouped under key `'Other'`.

#### View render call
```js
res.render('pages/bundle-builder', {
  cabinetModels: groupByModel(cabinets),   // array of { model, skus[] }
  topModels:     groupByModel(tops),       // same shape
  mirrorModels:  groupByModel(mirrors),    // same shape
  familyHex:     FAMILY_HEX,              // { white: '#f5f5f3', cream: '#e8d9b8', ... }
});
```

`FAMILY_HEX` is built from `src/config/colorFamilies.js` FAMILIES array. Each key maps to a hex color used as swatch background fallback when `chip_image` is NULL. Also adds `key + '_border'` entry for border color (currently same as fill for most families).

---

### 4. EJS Template — bundle-builder.ejs

The template does **no server-side rendering of product state** beyond injecting the three `*Models` arrays and `familyHex` as JSON into JS constants. All display logic is client-side.

```html
<script>
var CABINET_MODELS = <%- JSON.stringify(cabinetModels) %>;
var TOP_MODELS     = <%- JSON.stringify(topModels) %>;
var MIRROR_MODELS  = <%- JSON.stringify(mirrorModels) %>;
var FAMILY_HEX     = <%- JSON.stringify(familyHex) %>;
</script>
```

**Breadcrumb:** Uses `<div class="breadcrumb">` (not `<nav>`), matching the pattern in `collection.ejs`. Site.css already styles `.breadcrumb` at `.78rem` / `var(--muted)` color.

**Tier bar:** 3 entries only — "Vanity + Top = 5%", "+ Mirror = 10%", "+ Faucet = 15%". No "0% Vanity only" entry. Active tier highlighted by JS `updateSummary()` toggling `.is-active`.

**Step sections:** Each step has an identical HTML skeleton:
- `.bb-step-hd` — number circle, title/meta text, `‹ N/M ›` navigator (`#bb-vnav-*`), selected badge (`#bb-badge-*`)
- `.bb-mcard` — 2-column grid (`.bb-mcard-img-col` + `.bb-mcard-info`)

Step 2 (Top) starts with `.bb-step--locked` class and a lock message inside `.bb-mcard` instead of the card columns. The card columns are injected by JS `unlockTopStep()` when a cabinet is selected.

**Heart button:** Uses `.heart-btn` class with `data-product-id` and `data-product-slug` attributes. Site.js handles this globally via event delegation at `POST /account/favorites/toggle`. The bundle builder does not need any special heart logic — it just keeps the attributes updated as the displayed SKU changes.

**Size chips:** Use `.model-card-size-btn` class (same as `collection.ejs`) with `data-step` and `data-size` (float) attributes. The `is-active` class is toggled by `pickSize()`.

**Finish swatches:** `.bb-swatch` buttons with `data-step` and `data-color` attributes. Background is either `background-image: url(chip_image)` (JM sample photo) or `background-color: hex` fallback. `title` attribute = color name (shown on browser hover). `is-active` class toggled by `pickColor()`.

---

### 5. Client-Side State Machine

#### Global variables
```js
// Which model index is visible per step (0-based)
var gIdx   = { cabinet: 0, top: 0, mirror: 0 };

// Currently selected size filter per step (null = show all)
// Size persists when navigating between models
var gSize  = { cabinet: null, mirror: null };
// NOTE: top step has no size picker — width is locked to cabinet

// Currently selected color per step (null = show cheapest/first available)
// Color resets when navigating to a different model
var gColor = { cabinet: null, top: null, mirror: null };

// Confirmed selections (the SKU objects the shopper has clicked "Select" on)
var state  = { cabinet: null, top: null, mirror: null };
```

#### Key functions and their responsibilities

**`getModels(step)`** — Returns the right models array for a step. For 'top', returns `activeTops()` (width-filtered) instead of raw `TOP_MODELS`.

**`activeTops()`** — Filters `TOP_MODELS` to only include models that have at least one SKU matching `state.cabinet.width_in`. If no cabinet is selected yet, returns all `TOP_MODELS`. This is the mechanism that makes the top step only show compatible tops.

**`getSizeFilteredSkus(step, model)`** — Returns the SKUs for a model filtered by `gSize[step]`. For 'top', always returns all model.skus (no size filter). If the size filter would result in 0 SKUs (e.g. the user picked 36" but this model only comes in 30" and 48"), falls back to all SKUs — this prevents blank cards when navigating to a model that doesn't carry the selected size.

**`getDisplaySku(step, model)`** — The single SKU whose image/name/price is displayed. Tries to match `gColor[step]` within the size-filtered SKUs. If no color match, returns the first SKU. This is the "currently displayed product" — not necessarily the selected one.

**`renderViewer(step)`** — Full re-render of a step's card. Called after model navigation, size chip picks, and step init. Rebuilds image, name, price, size chips, swatches, select button state, nav counter.

**`updateCard(step, displaySku)`** — Lightweight update (image/name/price/finish label/view link/heart) after a swatch pick, without rebuilding the chip/swatch HTML. Avoids flicker.

**`navModel(step, dir)`** — Advances `gIdx[step]` by +1 or -1, resets `gColor[step]` to null (new model = new color context), calls `renderViewer()`.

**`pickSize(step, size)`** — Toggles `gSize[step]` (clicking active chip de-selects it). Resets `gColor[step]`. Calls `renderViewer()`.

**`pickColor(step, color)`** — Toggles `gColor[step]`. Updates swatch `.is-active` classes in-place. Calls `updateCard()` for a lightweight image/price swap.

**`selectProduct(step)`** — If the displayed SKU is already `state[step]`, clears it (deselect). Otherwise sets `state[step]` to the displayed SKU. If step is 'cabinet' and we're clearing, also calls `lockTopStep()`. If step is 'cabinet' and we're selecting, calls `unlockTopStep()`. Always calls `updateBadge()`, `renderViewer()`, `updateSummary()`.

**`lockTopStep()`** — Clears `state.top`, resets top viewer indices, replaces `.bb-mcard-top` innerHTML with lock message, disables nav buttons, re-adds `.bb-step--locked` to step section.

**`unlockTopStep()`** — Removes `.bb-step--locked`, rebuilds `.bb-mcard-top` innerHTML with full card columns (including all the element IDs the rest of the JS expects), then calls `renderViewer('top')`. Because the top step starts locked, these elements don't exist in the initial HTML — they are injected here.

**`updateBadge(step)`** — Shows/hides the green "Selected ✓ [name]" badge in the step header based on `state[step]`.

**`updateSummary()`** — Rebuilds the sticky summary bar:
  1. Determines `itemCount()` (0–3, faucet always 0 for now)
  2. Looks up `discount()` from `TIERS` array
  3. Highlights the active `.bb-tier`
  4. Updates the badge text and `.has-discount` class
  5. Calculates `orig` total and `final` total with discount applied
  6. Rebuilds each summary row with per-item discounted price + strikethrough original
  7. Enables/disables the "Add Bundle to Cart" button (enabled once cabinet is selected)

**`addToCart()`** — Posts each selected item to `POST /cart/add` in parallel using `Promise.all`. Each POST includes:
  - `product_id`, `slug`, `name`, `image` — standard cart fields
  - `price` — the **discounted** unit price (original × (1 - disc/100)), 2 decimal places
  - `original_price` — unmodified price (for strikethrough in cart)
  - `bundle_discount_pct` — the percentage (5, 10, or 15)
  - `qty: 1`

On success, redirects to `/cart`. On failure, re-enables the button and alerts.

**`onPageClick(e)` (event delegation)** — Single global click handler for all interactive elements. Uses `closest()` to identify:
  - `[id^="bb-prev-"]` / `[id^="bb-next-"]` → `navModel()`
  - `.model-card-size-btn[data-step]` → `pickSize()`
  - `.bb-swatch[data-step]` → `pickColor()`
  - `[id^="bb-select-"]` → `selectProduct()`
  - `#bb-add-cart` → `addToCart()`

Heart buttons (`.heart-btn`) are handled by site.js globally — no special handler needed.

---

### 6. Discount Tiers

```js
var TIERS = [0, 0, 5, 10, 15];
//            ^  ^  ^   ^   ^
//            |  |  |   |   └── 4 items (cab+top+mirror+faucet) = 15%
//            |  |  |   └────── 3 items (cab+top+mirror) = 10%
//            |  |  └────────── 2 items (cab+top) = 5%
//            |  └───────────── 1 item (cabinet only) = 0%
//            └──────────────── 0 items = 0%
```

`discount()` = `TIERS[Math.min(itemCount(), 4)]`. Faucet is "coming soon" so `itemCount()` maxes at 3 for now → max live discount is 10%. When faucet is added, simply increment the counter logic; the TIERS array already has 15% at index 4.

---

### 7. CSS — site2.css `.bb-*` Block

The entire bundle builder CSS lives in one contiguous block in `site2.css`, starting at the `BUNDLE BUILDER` comment. The `.bt-*` bundle teaser section (homepage cards) immediately follows and must **not** be touched when editing bundle builder CSS.

**Key classes:**
- `.bb-wrap` — max-width 1280px page wrapper
- `.bb-hero` — centered hero with eyebrow/title/subtitle/tier bar
- `.bb-tiers` / `.bb-tier` / `.bb-tier-label` / `.bb-tier-pct` / `.bb-tier-arrow` — discount bar
- `.bb-steps` / `.bb-step` / `.bb-step--locked` / `.bb-step--coming-soon` — step containers
- `.bb-step-hd` / `.bb-step-num` / `.bb-step-title` / `.bb-step-meta` — step header
- `.bb-vnav` / `.bb-vnav-btn` / `.bb-vnav-count` — ‹ N/M › navigator
- `.bb-sel-badge` — green "Selected ✓" chip in step header
- `.bb-mcard` — 2-column grid (image | controls), collapses to 1-col at ≤820px
- `.bb-mcard-img-col` — image box with `aspect-ratio: 4/3`, `object-fit: contain`
- `.bb-mcard-img-col .heart-btn` — overlaid absolute heart button (top-right of image)
- `.bb-mcard-info` — flex column of controls
- `.bb-mcard-collection` / `.bb-mcard-name` / `.bb-mcard-price` — product identity
- `.bb-picker-row` / `.bb-picker-lbl` — label + control row layout
- `.bb-size-chips` — wrapping flex for `.model-card-size-btn` chips (reuses collection page class)
- `.bb-swatches-wrap` / `.bb-swatches` / `.bb-swatch` — swatch circles (26px, chip photo or hex)
- `.bb-finish-name` — italic color name that updates next to swatches
- `.bb-view-link` — subtle "View product page ›" text link
- `.bb-select-btn` — full-width Select button; `.is-selected` = green "Selected ✓"
- `.bb-locked-msg` — centered lock icon + text when step is disabled
- `.bb-coming-soon-card` — dashed border card for Step 4 (Faucet)
- `.bb-summary` — sticky bottom bar
- `.bb-sum-*` — summary row/cell classes
- `.bb-cart-btn` / `.bb-cart-note` — Add to Cart button + disclaimer

---

### 8. Key Assumptions & Potential Failure Points

| Assumption | Risk | How to detect |
|---|---|---|
| `product_type = 'Cabinet Only'` matches all JM vanity cabinet SKUs | If importer uses a different value, Step 1 returns zero products | `SELECT DISTINCT product_type FROM products WHERE brand='James Martin Vanities' AND category_id IN (SELECT id FROM categories WHERE slug='bathroom-vanities')` |
| Tops live in `c.slug = 'vanity-tops'` | If importeer maps to different slug, Step 2 empty | `SELECT DISTINCT c.slug FROM products p JOIN categories c ON c.id=p.category_id WHERE p.brand='James Martin Vanities' AND p.product_type LIKE '%Quartz%'` |
| Mirrors in `c.slug = 'accessories'` OR `'mirrors'` | Wrong slug → Step 3 empty | `SELECT DISTINCT c.slug, p.product_type FROM products p JOIN categories c ON c.id=p.category_id WHERE p.brand='James Martin Vanities' AND p.product_type LIKE '%Mirror%'` |
| JM Sample products at `category_id = 10` | category_id might differ; chip_image NULLs everywhere | `SELECT id, name FROM categories WHERE id=10` |
| Sample products matched by exact `color` string | Minor naming inconsistency → NULL chip_image (falls back to hex, still works) | `SELECT DISTINCT s.color FROM products s WHERE s.category_id=10 AND s.brand='James Martin Vanities' LIMIT 20` — compare to regular product color values |
| Top width matching uses exact `width_in` float equality | Floating-point drift (e.g. 36.0 vs 36) could cause tops to not match cabinet | Fixed with `parseFloat()` on both sides in `activeTops()` |
| `POST /cart/add` accepts `original_price` and `bundle_discount_pct` fields | Cart controller may not store these — bundle context lost in cart | Verify `src/controllers/cartController.js` reads and stores these fields |
| Cabinet must be selected before Top step unlocks | This is intentional UX — no bypass needed | N/A |

---

### 9. What Is NOT Yet Done

- **Faucet step** is a "Coming Soon" placeholder. When JM faucets are imported, Step 4 needs a real query added to bundleController, mirror/cabinet viewer logic wired up, and `itemCount()` updated to include `state.faucet`.
- **Homepage bundle teaser section** (`#42` in task list) — the `.bt-*` CSS exists but the homepage section (index.ejs) has not been added yet.
- **No server-side validation** on the cart add payload. A malicious user could POST arbitrary prices. The cart endpoint should re-verify discount eligibility server-side (check that the combination of product IDs legitimately earns the stated bundle_discount_pct).
- **No persistence of bundle state** across page reloads. If the user leaves and returns, their selections are lost. Future: save to `localStorage` or a session key.
- **No analytics events** on step completion or cart add. Consider adding `gtag('event', 'bundle_step_complete', ...)` calls.

---

## Taxonomy Overhaul — 4-Value product_type + New Display Category Slugs
**Commits:** `5d6db53b` (taxonomy overhaul) · `b974e2b2` (SEO slug renames) · pending push (sidebar fix + admin fixes)
**Date:** 2026-07-31 – 2026-08-01
**Rollback:** Revert these commits; run inverse SQL (see "To Reverse" below)

---

### 1. Problem

The old `product_type` system had only 2 meaningful values for vanities (`Single Sink`, `Double Sink`) plus `Cabinet Only`. This made it impossible to distinguish between:
- A vanity *with* a countertop included vs a cabinet-only unit
- A single-sink vs double-sink cabinet

Additionally, the JM feed importer had a silent root bug: `PRODUCT_CATEGORY_MAP` used key `'vanity'` (singular) but the JM feed always sends `'Vanities'` (plural). Result: ALL 4,473 Vanities-category products fell through to `PRODUCT_TYPE_MAP`, where `Product Type='Cabinet'` routed to Storage (category_id=6) with `product_type=NULL`.

---

### 2. New Canonical product_type Values (bathroom-vanities products only)

| Old value | New value | Trigger condition |
|---|---|---|
| `Single Sink` | `Single Sink Vanity With Top` | JM: Vanities/Vanity + sink_count=1 |
| `Double Sink` | `Double Sink Vanity With Top` | JM: Vanities/Vanity + sink_count=2 |
| `Cabinet Only` (single) | `Single Sink Cabinet Only` | JM: Vanities/Cabinet or Cabinet/Cabinet + no "Double" in name |
| `Cabinet Only` (double) | `Double Sink Cabinet Only` | JM: Vanities/Cabinet or Cabinet/Cabinet + "Double" in name |

### 3. New Display Category Slugs

| Slug | Display Name | display_mode | Auto-filter applied |
|---|---|---|---|
| `bathroom-vanities-with-tops` | Bathroom Vanities With Tops | `model-group` | `product_type IN ('Single Sink Vanity With Top', 'Double Sink Vanity With Top')` |
| `bathroom-vanity-cabinets` | Bathroom Vanity Cabinets | `model-group` | `product_type IN ('Single Sink Cabinet Only', 'Double Sink Cabinet Only')` |

Products physically remain in `bathroom-vanities` (category_id=1). These are routing/display-only categories.

### 4. Slug Renames (Rule 12)

| Old slug | New slug | New display name |
|---|---|---|
| `mirrors` | `bathroom-mirrors` | Bathroom Mirrors |
| `vanity-tops` | `bathroom-vanity-tops` | Bathroom Vanity Tops |

`vanity-tops` / `bathroom-vanity-tops` is a REAL category containing standalone top SKUs — not a display category. The bundle builder Step 2 queries this slug.

---

### 5. Code Changes

#### `src/jobs/importJamesMartinFeed.js`
- `PRODUCT_CATEGORY_MAP`: `'vanity'` → `'vanities'` (plural — matches live JM feed; fixes root bug)
- `PRODUCT_CATEGORY_MAP`: added `'tops': 7` for JM `'Tops'` Product Category
- `PRODUCT_TYPE_MAP`: `'cabinet': 6` → `'cabinet': 1` (Cabinet was routing to Storage instead of bathroom-vanities)
- `PRODUCT_TYPE_MAP`: added `'knobs & legs': 4`, `'metal sample': 10`, `'stone sample': 10`, `'wood sample': 10`
- `product_type` assignment block: full replacement from old 2-value to new 4-value system:
  ```js
  if (categoryId === 1) {
    const sinkCount = cleanNum(row['Number of Sinks Included (0, 1, or 2)']);
    if (catLower === 'vanities' && productTypLower === 'vanity') {
      if (sinkCount === 2)      productType = 'Double Sink Vanity With Top';
      else if (sinkCount === 1) productType = 'Single Sink Vanity With Top';
    } else if (
      (catLower === 'vanities' && productTypLower === 'cabinet') || catLower === 'cabinet'
    ) {
      if (/double/i.test(nameLower)) productType = 'Double Sink Cabinet Only';
      else                           productType = 'Single Sink Cabinet Only';
    } else if (catLower === 'vanity') {
      // Legacy older-feed format
      if (sinkCount === 2)      productType = 'Double Sink Vanity With Top';
      else if (sinkCount === 1) productType = 'Single Sink Vanity With Top';
    }
  } else {
    productType = CATEGORY_TYPE_MAP[catLower] || CATEGORY_TYPE_MAP[productTypLower] || null;
  }
  ```
- `CATEGORY_TYPE_MAP`: now dual-key lookup (`catLower || productTypLower`) — fixes General Products rows
- Comment references updated: `mirrors` → `bathroom-mirrors`, `vanity-tops` → `bathroom-vanity-tops`

#### `src/controllers/collectionsController.js`
- `const mgActiveTypes` → `let mgActiveTypes` (must be reassignable for auto-injection)
- Added `SLUG_DEFAULT_TYPES` map and auto-injection block:
  ```js
  const SLUG_DEFAULT_TYPES = {
    'bathroom-vanities-with-tops': ['Single Sink Vanity With Top', 'Double Sink Vanity With Top'],
    'bathroom-vanity-cabinets':    ['Single Sink Cabinet Only',    'Double Sink Cabinet Only'],
  };
  if (SLUG_DEFAULT_TYPES[slug] && mgActiveTypes.length === 0) {
    mgActiveTypes = SLUG_DEFAULT_TYPES[slug];
  }
  ```
- `mgCsRows` WHERE clause made dynamic — adds `AND p.product_type IN (...)` when `mgActiveTypes.length > 0`:
  ```js
  let mgCsWhere = `p.is_active = 1 AND p.category_id = ? AND p.model IN (...) AND p.color IS NOT NULL`;
  if (mgActiveTypes.length) {
    mgCsWhere += ` AND p.product_type IN (${mgActiveTypes.map(() => '?').join(',')})`;
    mgCsParams.push(...mgActiveTypes);
  }
  ```
- `mgAvailTypes` sidebar scoping fix (2026-08-01) — prevents cabinet types appearing on `bathroom-vanities-with-tops` and vice versa:
  ```js
  // BEFORE (bug):
  const mgAvailTypes = [...new Set(mgOptRows.map(r => r.product_type).filter(Boolean))].sort();

  // AFTER (fix):
  const mgRawAvailTypes = [...new Set(mgOptRows.map(r => r.product_type).filter(Boolean))].sort();
  const mgAvailTypes    = SLUG_DEFAULT_TYPES[slug]
    ? mgRawAvailTypes.filter(t => SLUG_DEFAULT_TYPES[slug].includes(t))
    : mgRawAvailTypes;
  ```

#### `src/controllers/bundleController.js`
- `getCabinets()`: `AND p.product_type = 'Cabinet Only'` → `AND p.product_type IN ('Single Sink Cabinet Only', 'Double Sink Cabinet Only')`
- `getTops()`: `c.slug = 'vanity-tops'` → `c.slug = 'bathroom-vanity-tops'`
- `getMirrors()`: `c.slug = 'mirrors'` → `c.slug = 'bathroom-mirrors'` (alongside existing `accessories` fallback)

#### `src/services/themeSettings.js` (code defaults only — live settings come from DB `app_settings` table)
- Nav link: `/collections/mirrors` → `/collections/bathroom-mirrors`
- Footer link: `/collections/mirrors` → `/collections/bathroom-mirrors`
- `vanities_mega.links` updated to new taxonomy URLs

#### `src/services/rflposSync.js`
- `CAT_MAP`: `'mirror'`, `'mirrors'`, `'bathroom mirror'` → `'bathroom-mirrors'`

#### `views/pages/collection.ejs`
- Configuration sidebar filter (regular collection path): replaced 3-option mixed `sink_count`/`type` filter with 4-option pure `product_type` filter. Removed `sink_count` EAV from sidebar.
- `_mgTypeLabel` map (model-group path): updated from old 3 values to new 4 canonical values

#### `data/theme_settings.json` *(gitignored — does NOT deploy via git)*
- Nav + footer mirror URLs: `/collections/mirrors` → `/collections/bathroom-mirrors`
- `vanities_mega.links` — 3 Shop By Type links updated to:
  - `Single Sink Vanity With Top` → `/collections/bathroom-vanities-with-tops?type=Single+Sink+Vanity+With+Top`
  - `Double Sink Vanity With Top` → `/collections/bathroom-vanities-with-tops?type=Double+Sink+Vanity+With+Top`
  - `Cabinet Only` → `/collections/bathroom-vanity-cabinets`
- ⚠️ **Must update live server manually** via Admin → Theme Editor → Navigation after push

---

### 6. DB Changes Required (Script 1 — run in phpMyAdmin)

```sql
-- 1. Add new display categories
INSERT INTO categories (name, slug, display_mode, is_active) VALUES
  ('Bathroom Vanities With Tops', 'bathroom-vanities-with-tops', 'model-group', 1),
  ('Bathroom Vanity Cabinets',    'bathroom-vanity-cabinets',    'model-group', 1)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 2. Slug renames
UPDATE categories SET slug='bathroom-mirrors',     name='Bathroom Mirrors'     WHERE slug='mirrors';
UPDATE categories SET slug='bathroom-vanity-tops', name='Bathroom Vanity Tops' WHERE slug='vanity-tops';

-- 3. Update existing vanity-with-top product_type values
UPDATE products SET product_type='Single Sink Vanity With Top' WHERE product_type='Single Sink';
UPDATE products SET product_type='Double Sink Vanity With Top' WHERE product_type='Double Sink';

-- 4. Split Cabinet Only → Single / Double by name
UPDATE products SET product_type='Double Sink Cabinet Only'
  WHERE product_type='Cabinet Only' AND name LIKE '%Double%';
UPDATE products SET product_type='Single Sink Cabinet Only'
  WHERE product_type='Cabinet Only' AND name NOT LIKE '%Double%';

-- 5. Move JM cabinet SKUs stranded in Storage → bathroom-vanities
UPDATE products SET category_id=1
  WHERE category_id=6
    AND brand='James Martin Vanities'
    AND (name LIKE '%Cabinet%'
         OR product_type IN ('Single Sink Cabinet Only','Double Sink Cabinet Only'));
```

---

### 7. To Reverse

**Code:** Revert commits `5d6db53b`, `b974e2b2`, and the pending push.

**DB inverse SQL:**
```sql
-- Reverse slug renames
UPDATE categories SET slug='mirrors',     name='Mirrors'     WHERE slug='bathroom-mirrors';
UPDATE categories SET slug='vanity-tops', name='Vanity Tops' WHERE slug='bathroom-vanity-tops';

-- Remove new display categories
DELETE FROM categories WHERE slug IN ('bathroom-vanities-with-tops','bathroom-vanity-cabinets');

-- Reverse product_type values
UPDATE products SET product_type='Single Sink'  WHERE product_type='Single Sink Vanity With Top';
UPDATE products SET product_type='Double Sink'  WHERE product_type='Double Sink Vanity With Top';
UPDATE products SET product_type='Cabinet Only' WHERE product_type IN ('Single Sink Cabinet Only','Double Sink Cabinet Only');
```

---

## Admin Fixes — Theme Editor URL Input + Category Image Nested Form Bug
**Commits:** `e2840b6` (category-edit AJAX, local only — deploys with next push) · pending push
**Date:** 2026-08-01

### 1. Theme Editor Nav Link URL Input Box (admin-theme-editor.css + theme.ejs)

**Problem:** The nav link row in the Theme Editor used `te4-row3` (3-column CSS grid) but had 4 children (Label, URL, Highlight toggle, Mega menu toggle). The URL input was the 4th child squeezed into a 3-column grid — rendered ~2 characters wide, non-functional.

**Fix — `public/css/admin-theme-editor.css`:**
```css
/* Added after .te4-row3 rule */
.te4-nav-link-row {
  display: grid;
  grid-template-columns: 1fr 2fr auto auto;
  gap: 8px;
  align-items: end;
}
```
Label: 1fr, URL: 2fr (double-wide), Highlight toggle: auto, Mega menu toggle: auto.

**Fix — `views/pages/admin/theme.ejs` (2 locations):**
- Line 499 (live nav link rows): `te4-array-fields te4-row3` → `te4-array-fields te4-nav-link-row`
- Line 512 (new-row template): `te4-array-fields te4-row3` → `te4-array-fields te4-nav-link-row`
- Line 210: `admin-theme-editor.css` → `admin-theme-editor.css?v=2` (cache bust)

**To reverse:** Change `te4-nav-link-row` back to `te4-row3` in theme.ejs (2 places); remove `.te4-nav-link-row` rule from admin-theme-editor.css.

---

### 2. Category Image Nested Form Bug (category-edit.ejs)

**Problem:** The category edit admin page had a standard HTML `<form enctype="multipart/form-data">` for image upload nested inside the main `catEditForm`. Browsers silently ignore nested forms — clicking "Upload image" submitted the outer save form instead, which saved the category record without an image, clearing `image_url` to NULL. This caused all category card images to disappear after any admin category edit.

**Root cause of missing category images on homepage:** The `categories.image_url` column was being set to NULL by this bug each time the admin opened and saved a category.

**Fix — `views/pages/admin/category-edit.ejs`:**
- Image upload converted to AJAX (`fetch POST /admin/categories/:id/image/ajax`) instead of a nested form
- File input uses `type="file"` without a wrapping `<form>` element
- Image remove button also uses `fetch POST /admin/categories/:id/image/remove`
- Danger zone delete form moved entirely outside `catEditForm` to its own standalone `<form>`
- Comment added: *"Upload via AJAX — avoids nested-form bug (this card is inside catEditForm)"*

**To reverse:** Replace AJAX fetch with a nested `<form enctype="multipart/form-data">` around the file input. Not recommended — this reintroduces the image-clearing bug.

---

## Scope — Stone/Composite Top Distinction + Bundle Builder Faucet Step
**Date:** 2026-08-01

### Summary
Introduced a two-type top taxonomy (Stone vs Composite), added a stone-top-compatibility depth filter to the bundle builder Step 1, wired up the faucet step with real products, and pinned category card CTAs to card bottom.

---

### Top Material Types (new product_type values)

Two new canonical `product_type` values replace the generic `'Vanity Top'` for products in `category_id=7`:

| Type | Detection | Value stored |
|---|---|---|
| Stone | Name or `countertop_material` EAV contains "Quartz" or "Marble" | `'Stone Top'` |
| Composite | All other tops in category 7 (not Backsplash) | `'Composite Top'` |

Backsplash SKUs in category 7 are unaffected — they continue to receive `product_type = 'Backsplash'`.

---

### Stone-Top Compatibility Rule (James Martin Vanities only)

**Rule:** James Martin vanity cabinets with `depth_in >= 22.5"` accept the 23–23.5" stone tops (Quartz/Marble). Cabinets shallower than 22.5" require Composite tops.

**Scope:** This rule is JM-SPECIFIC. The 23–23.5" stone tops are exclusive to JM cabinets. Other brands added to BVO in future will have different depth specs and must NOT be filtered by the 22.5" threshold.

---

### Files Changed

**`src/jobs/importJamesMartinFeed.js`**
- Added dedicated `else if (categoryId === 7)` branch before the generic `else` block
- Backsplash sub-type detected first via `CATEGORY_TYPE_MAP` (`'Backsplash'` pass-through)
- All other tops: `isStone = /quartz|marble/i.test(nameLower || matField)` → `'Stone Top'` or `'Composite Top'`
- Added full rule comment with JM-only scope caveat

**`src/controllers/bundleController.js`**
- `getCabinets()`: Added `INNER JOIN product_attribute_values pav_depth ON attr_key='depth_in' AND value_num >= 22.5` — only shows stone-top-compatible cabinets in bundle builder. Added rule comment.
- `getTops()`: Changed filter from fragile `name LIKE '%Quartz%' OR '%Marble%'` to clean `product_type = 'Stone Top'`
- Added `getFaucets()`: Queries `c.slug = 'faucets'`, all brands (no JM restriction). No `CHIP_SQL` (faucets are not JM products).
- `getBundleBuilder()`: Added `getFaucets()` to `Promise.all`, passes `faucetModels` to template.

**`views/pages/bundle-builder.ejs`**
- Step 1 meta text: updated to "Stone-top-compatible cabinets"
- Step 4: Replaced "coming soon" placeholder with full viewer card (image, swatches, size chips, select button)
- Added `.bb-compat-note` above faucet card: "James Martin vanities use standard 8" widespread faucet holes — compatible with any brand. Mix and match freely."
- `FAUCET_MODELS` server data variable added
- `gIdx`, `gSize`, `gColor`, `state` all extended to include `'faucet'`
- `getModels()` returns `FAUCET_MODELS` for `step === 'faucet'`
- `itemCount()` includes `state.faucet`
- `updateSummary()` totals and row rendering include faucet
- `addToCart()` items array includes faucet
- `init()` calls `renderViewer('faucet')`
- Summary bar static faucet row updated (removed "Coming soon" placeholder)

**`public/css/site2.css`**
- Added `.bb-compat-note` styles (blue info box with icon, shown above faucet viewer card)

**`public/css/site.css`**
- `.cat-card`: `display: block` → `display: flex; flex-direction: column` (pins CTA to bottom)
- `.cat-body`: added `flex: 1; display: flex; flex-direction: column`
- `.cat-link`: added `margin-top: auto; display: block` (pins "Shop Now →" to bottom of card)

---

### DB Script — Update Existing Tops

Run AFTER Script 1 (slug renames). Updates `product_type` for all existing top SKUs in category 7:

```sql
-- 1. Mark stone tops (Quartz/Marble — by name or countertop_material EAV)
UPDATE products p
SET p.product_type = 'Stone Top'
WHERE p.category_id = 7
  AND (
    p.name LIKE '%Quartz%' OR p.name LIKE '%Marble%'
    OR EXISTS (
      SELECT 1 FROM product_attribute_values pav
      WHERE pav.product_id = p.id
        AND pav.attr_key   = 'countertop_material'
        AND (pav.value_text LIKE '%Quartz%' OR pav.value_text LIKE '%Marble%')
    )
  );

-- 2. All remaining category-7 tops that aren't already 'Stone Top' or 'Backsplash'
UPDATE products SET product_type = 'Composite Top'
WHERE category_id = 7
  AND product_type NOT IN ('Stone Top', 'Backsplash');
```

**To reverse:**
```sql
UPDATE products SET product_type = 'Vanity Top'
WHERE category_id = 7 AND product_type IN ('Stone Top', 'Composite Top');
```

---

### Faucet Notes

- Initial brand: Huntington Brass (one SKU added manually)
- Additional brands to be added via import or manual entry over time
- JM vanities use 8" widespread faucet holes — standard universal sizing, any brand fits
- Bundle builder Step 4 does NOT restrict by brand; `getFaucets()` queries all active products in the `faucets` category slug

---

---

## Tasks #71–75 — Product/Cart/Checkout Conversion Improvements
**Date:** 2026-08-01

### Overview
Implemented Phase 1 of the cart page industry analysis recommendations: trust signals, payment logos, Google Reviews, bundle savings callout, a full checkout page, and Clover Hosted Checkout payment integration.

### Files Changed

**`src/services/themeSettings.js`**
- Added `google_reviews_rating` (default `'4.9'`) and `google_reviews_count` (default `'150'`) to `DEFAULTS.global`
- Admin can update these values in the Theme Editor under the global settings panel
- User should look up actual values from Google Business Profile for "Bathroom Vanities Outlet" and update accordingly

**`views/pages/product.ejs`**
- Added three blocks after the `.detail-ctas` div (after wishlist button):
  1. Google Reviews star rating row (conditional on `settings.global.google_reviews_rating > 0`)
  2. Three-item trust bar: 30-Day Returns · Free Shipping · Secure Checkout
  3. Payment logos row: Visa, Mastercard, Amex, PayPal, Apple Pay, Google Pay (inline SVGs)

**`src/controllers/cartController.js`**
- `add()` now captures `original_price` and `bundle_discount_pct` from request body
- Stores both on the cart item so cart.ejs can compute "You save $X" callout
- Backward-compatible: if not sent, defaults to `pricef` / `0`

**`views/pages/cart.ejs`**
- Added bundle savings callout ("🎉 Bundle savings: −$X") in order summary (conditional on items having `bundle_discount_pct > 0`)
- Added three-icon trust row (SSL · Returns · Free Shipping) below Continue Shopping button
- Added payment logos (same 6 brands as product page) in order summary
- Added Google Reviews rating in order summary (conditional)

**`src/controllers/checkoutController.js`** *(new file)*
- `GET /checkout` — renders checkout.ejs, passes cart + optional error message
- `POST /checkout` — validates email, calls Clover Hosted Checkout API, redirects to Clover's payment page
- `GET /checkout/success` — clears cart from session, renders confirmation page
- `GET /checkout/cancel` — renders cancellation page (cart preserved)

**`src/routes/checkout.js`** *(new file)*
- Registers GET `/`, POST `/`, GET `/success`, GET `/cancel` — all handled by checkoutController

**`src/server.js`**
- Added `app.use('/checkout', require('./routes/checkout'))` between `/cart` and `/account`

**`views/pages/checkout.ejs`** *(new file)*
- Two-column layout: left = contact form (email, name, phone) + order item review; right = sticky order summary + submit CTA
- Submit button uses `form="checkout-form"` cross-reference pattern — submits the left-column form from the right column
- Trust row and payment logos repeated in summary sidebar

**`views/pages/checkout-success.ejs`** *(new file)*
- Confirmation page shown after Clover redirects back on successful payment
- Displays customer first name, email, order total from session
- Clears cart and `pendingCheckout` from session on render

**`views/pages/checkout-cancel.ejs`** *(new file)*
- Shown when customer cancels or payment fails on Clover's page
- Cart is NOT cleared — customer can retry

**`public/css/site2.css`**
- Appended all new CSS sections:
  - `.pdp-google-rating` / `.cart-google-rating` — star rating row
  - `.pdp-trust-bar` / `.ptb-item` — 3-item trust bar on product page
  - `.pay-logo` — shared payment logo SVG sizing
  - `.pdp-payment-logos` / `.cart-payment-logos` — logo container rows
  - `.cart-trust-row` / `.ctr-item` — compact trust row in cart/checkout summary
  - `.summary-savings` — green savings callout badge
  - `.checkout-page`, `.checkout-layout`, `.checkout-card`, `.checkout-form`, `.checkout-field`, `.checkout-field-row`, `.co-item`, `.co-sum-*`, `.checkout-submit-btn` — full checkout page layout
  - `.checkout-confirm-page`, `.confirm-icon`, `.confirm-heading`, `.confirm-actions` — success/cancel pages
  - Responsive breakpoints at 900px and 600px

### Clover Hosted Checkout Setup

**Required `.env` variables** (add to `.env` on Hostinger before activating payment):
```
CLOVER_API_KEY=your_private_api_key_here
CLOVER_ENV=production
```

**How to get the API key:**
1. Log into your Clover Merchant Dashboard
2. Go to: Account & Setup → Ecommerce API Tokens
3. Copy the **Private API Token**
4. Add as `CLOVER_API_KEY` in `.env`

**Payment flow:**
1. Customer fills email on `/checkout`
2. POST → server calls `POST https://scl.clover.com/invoicingcheckout/v1/checkouts`
3. Clover returns `{ href: "https://checkout.clover.com/v1/checkout/SESSION_ID" }`
4. Server redirects customer to Clover's PCI-compliant hosted payment page
5. Clover collects card + shipping → processes payment
6. On success → Clover redirects to `https://bathroomvanitiesoutlet.com/checkout/success`
7. On cancel/failure → `https://bathroomvanitiesoutlet.com/checkout/cancel`

**CSP:** No changes needed — `res.redirect()` is a 302 header, not a fetch/iframe.

**Docs:** https://docs.clover.com/dev/docs/hosted-checkout-api

### To Undo
Remove `app.use('/checkout', ...)` from server.js, delete the 5 new files, revert cart.ejs, cartController.js, product.ejs to their previous versions, remove the new CSS block from site2.css, and remove the `google_reviews_*` keys from themeSettings.js defaults.

---

*End of brief*
