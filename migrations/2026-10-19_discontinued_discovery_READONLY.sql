/* 2026-10-19 — discovery for the JMV discontinued sheet of 2026-10-13
 *
 * READ ONLY. No INSERT, no UPDATE, no DDL. Safe on production.
 *
 * WHY THIS RUNS FIRST. We have never retired a vanity, so nothing about the
 * current state is known: these five SKUs may already be inactive (if JM also
 * marked them discontinued in the nightly feed, the importer would have caught
 * it at importJamesMartinFeed.js:1172), or they may be live and orderable.
 * Those two situations need different responses and one of them is urgent.
 *
 * The five, verbatim from the sheet:
 *   242-MO28-NAT      ESCA 28IN MIRROR NATURAL
 *   650-V60S-BKO      60" single Brittany vanity in Black Onyx
 *                       -- Replacement SKU 650-V60S-M-BKO   <- the only one
 *                                                              with a stated
 *                                                              replacement
 *   963-M30-SL-DB     TANGENT 30IN MIRROR SILVER W/DELFT BLUE
 *   CS-368-GW         59IN DBL TOP COMP STONE GW FINISH
 *   P983V48BNKPULLS   PT: 48IN 59IN CLMBIA SET OF DR AND DRWR PULLS IN BNK
 */

/* ── 1. DO THEY EXIST, AND ARE THEY LIVE? ────────────────────────────────
   is_active is what gates the whole storefront — every Product.js query
   carries `WHERE p.is_active = 1`, so is_active = 0 already means invisible
   and unorderable. slug is needed to build the redirect's old_path.

   Read it as: rows missing entirely = nothing to do for that SKU.
               is_active = 0        = already handled, redirect still wanted.
               is_active = 1        = LIVE AND ORDERABLE RIGHT NOW. */
/* ⚠️ STOCK IS NOT ON products. There is no products.qty — on-hand lives in
   the `inventory` table (product_id, qty_on_hand, qty_reserved,
   allow_backorder), one row per product, joined LEFT because a product with
   no inventory row is normal and must still appear in this list. */
SELECT
  p.sku,
  p.slug,
  CONCAT('/products/', p.slug)                AS current_path,
  p.is_active,
  i.qty_on_hand,
  i.allow_backorder,
  p.price,
  p.brand,
  p.product_type,
  c.slug                                      AS category_slug,
  p.updated_at
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN inventory  i ON i.product_id = p.id
WHERE p.sku IN (
  '242-MO28-NAT',
  '650-V60S-BKO',
  '963-M30-SL-DB',
  'CS-368-GW',
  'P983V48BNKPULLS'
)
ORDER BY p.is_active DESC, p.sku;

/* ── 2. THE REPLACEMENT — does it exist, and is it live? ─────────────────
   650-V60S-BKO redirects to 650-V60S-M-BKO only if that SKU is real and
   active. Redirecting to a dead page is worse than redirecting to the
   collection, and legacyRedirects cannot know the difference: its loop
   detection catches self-redirects, not redirects to a 404. */
SELECT
  p.sku,
  p.slug,
  CONCAT('/products/', p.slug)  AS destination_path,
  p.is_active,
  i.qty_on_hand,
  p.price
FROM products p
LEFT JOIN inventory i ON i.product_id = p.id
WHERE p.sku = '650-V60S-M-BKO';

/* ── 3. ARE ANY OF THEM SPOKEN FOR? ──────────────────────────────────────
   Hiding a product does not cancel an order that already contains it. If
   any of these sit in an unfulfilled order, that is a phone call to make,
   not a database change — and it is exactly the "order or fulfillment
   issue" JM's email is warning about. */
/* ⚠️ `qty`, NOT `quantity`. order_items is (id, order_id, product_id, sku,
   name, qty, unit_price, line_total) — this query was written with
   `oi.quantity` and failed #1054 on 2026-10-19. The schema dump is the
   authority; the column name that reads naturally is not. */
SELECT
  o.id              AS order_id,
  o.order_number,
  o.status,
  o.created_at,
  oi.sku,
  oi.qty,
  oi.unit_price
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE oi.sku IN (
        '242-MO28-NAT','650-V60S-BKO','963-M30-SL-DB',
        'CS-368-GW','P983V48BNKPULLS')
ORDER BY o.created_at DESC;

/* ── 4. ALREADY REDIRECTED? ──────────────────────────────────────────────
   url_redirects already holds ~501 rows from the Shopify cutover. If one of
   these paths is already a redirect source or destination, adding another
   row could build a chain — two hops, which gate_301 forbids and which
   bleeds link equity. Checked before writing, not after. */
SELECT
  r.old_path,
  r.destination,
  r.status_code,
  r.is_active
FROM url_redirects r
WHERE r.old_path IN (
        '/products/242-mo28-nat','/products/650-v60s-bko',
        '/products/963-m30-sl-db','/products/cs-368-gw',
        '/products/p983v48bnkpulls')
   OR r.destination LIKE '%/products/242-mo28-nat'
   OR r.destination LIKE '%/products/650-v60s-bko'
   OR r.destination LIKE '%/products/963-m30-sl-db'
   OR r.destination LIKE '%/products/cs-368-gw'
   OR r.destination LIKE '%/products/p983v48bnkpulls';

/* ── 5. COLLATERAL — do these appear inside anything composite? ──────────
   A discontinued cabinet or top that is still referenced by the bundle
   builder or a saved bundle would keep offering a combination that can no
   longer be fulfilled. Harmless if empty; important if not. */
/* ⚠️ product_components is SKU-to-SKU, not id-to-id: its columns are
   (id, parent_sku, component_sku, component_role, seq). There is no
   product_id to join on — this query was written expecting one. */
SELECT 'product_components' AS where_found,
       pc.parent_sku,
       pc.component_sku     AS referenced_sku,
       pc.component_role
FROM product_components pc
WHERE pc.component_sku IN (
        '242-MO28-NAT','650-V60S-BKO','963-M30-SL-DB',
        'CS-368-GW','P983V48BNKPULLS');

/* ── 6. WHAT THE FEED ITSELF SAYS ────────────────────────────────────────
   If the latest JMV snapshot still carries these SKUs, the nightly import
   will keep re-upserting them — which is precisely why the override has to
   live in its own table rather than in a one-off UPDATE to is_active.
   Confirms the constraint rather than assuming it. */
SELECT
  s.sku,
  s.snapshot_date,
  s.qty,
  s.msrp
FROM jmv_snapshots s
WHERE s.sku IN (
        '242-MO28-NAT','650-V60S-BKO','963-M30-SL-DB',
        'CS-368-GW','P983V48BNKPULLS')
  AND s.snapshot_date >= DATE_SUB(CURDATE(), INTERVAL 3 DAY)
ORDER BY s.sku, s.snapshot_date DESC;
